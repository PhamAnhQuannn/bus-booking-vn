/**
 * Operator session management — refresh token rotation with family-reuse detection.
 *
 * Mirrors lib/auth/session.ts but operates on OperatorSession rows.
 * Refresh tokens use the same HMAC structure as customer tokens but include
 * operatorUserId in the payload.
 *
 * issueOperatorSession(operatorUserId) — create fresh session (login).
 * rotateOperatorRefresh(oldHash) — atomic rotation inside a Prisma transaction.
 *   - If already revoked → revoke entire family → return { reuse: true }
 *   - Otherwise → revoke old row, create new row, return new tokens
 *   - If not found → throw Error('SESSION_NOT_FOUND')
 * revokeOperatorSession(refreshHash) — soft-delete; idempotent.
 * revokeAllOperatorSessions(operatorUserId, excludeSessionId?) — revoke all sessions.
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { signOperatorAccess } from './jwt';

// Session expiry: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Reuse-detection grace window (#589, mirrors session.ts #519). A concurrent double-refresh
// of the same token serializes on the FOR UPDATE lock; the loser re-reads the just-revoked
// row. Within this window, if the immediate successor is still live, that is a benign race
// (two tabs), NOT token theft — mint a fresh access token instead of nuking the family.
const REUSE_GRACE_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers — HMAC-based refresh tokens (mirrors refreshToken.ts pattern)
// ---------------------------------------------------------------------------

function getRefreshSecret(): Buffer {
  const raw =
    process.env.REFRESH_TOKEN_SECRET_OPERATOR ??
    (process.env.NODE_ENV === 'test' ? 'o'.repeat(32) : null);
  if (!raw) throw new Error('REFRESH_TOKEN_SECRET_OPERATOR not configured');
  return Buffer.from(raw, 'utf8');
}

interface OpRefreshPayload {
  tokenId: string;
  family: string;
  operatorUserId: string;
  iat: number;
  rotation: number;
}

function produceOpRefresh(payload: OpRefreshPayload): { token: string; hash: string } {
  const secret = getRefreshSecret();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  const token = `${payloadB64}.${hmac}`;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

function verifyOpRefresh(token: string): { payload: OpRefreshPayload; hash: string } | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const hmac = token.slice(dotIdx + 1);
    if (!payloadB64 || !hmac) return null;
    const secret = getRefreshSecret();
    const expectedHmac = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
    const hmacBuf = Buffer.from(hmac, 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    if (hmacBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(hmacBuf, expectedBuf)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as OpRefreshPayload;
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { payload, hash };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OperatorSessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
}

export interface IssueOperatorSessionResult extends OperatorSessionTokens {
  family: string;
}

// ---------------------------------------------------------------------------
// issueOperatorSession
// ---------------------------------------------------------------------------

export async function issueOperatorSession(
  operatorUserId: string,
  requiresPasswordChange = false,
  operatorId?: string,
  role?: 'admin' | 'staff'
): Promise<IssueOperatorSessionResult> {
  const family = crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);

  const { token: refreshToken, hash: refreshHash } = produceOpRefresh({
    tokenId,
    family,
    operatorUserId,
    iat,
    rotation: 0,
  });

  await prisma.operatorSession.create({
    data: {
      operatorUserId,
      tokenFamily: family,
      rotationCount: 0,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    },
  });

  // Issue 011: operatorId claim is required. Resolve from DB if caller didn't pass it.
  // Issue 016: role claim also resolved from DB if not passed by caller.
  let resolvedOperatorId = operatorId;
  let resolvedRole = role;
  if (!resolvedOperatorId || !resolvedRole) {
    const user = await prisma.operatorUser.findUnique({
      where: { id: operatorUserId },
      select: { operatorId: true, role: true },
    });
    if (!user) throw new Error('OPERATOR_USER_NOT_FOUND');
    resolvedOperatorId ??= user.operatorId;
    resolvedRole ??= user.role as 'admin' | 'staff';
  }

  const accessToken = await signOperatorAccess({
    sub: operatorUserId,
    scope: 'operator',
    // Issue 016: role claim — defensive fallback to 'admin' for one-release grace period.
    role: resolvedRole ?? 'admin',
    requiresPasswordChange,
    operatorId: resolvedOperatorId,
  });

  return { accessToken, refreshToken, refreshHash, family };
}

// ---------------------------------------------------------------------------
// rotateOperatorRefresh
// ---------------------------------------------------------------------------

export async function rotateOperatorRefresh(
  oldHash: string,
  requiresPasswordChange = false,
  operatorId?: string
): Promise<
  | OperatorSessionTokens
  | { reuse: true }
  | { expired: true }
  | { raced: true; accessToken: string }
> {
  return prisma.$transaction(async (tx) => {
    // #589: lock the session row FOR UPDATE. Without the lock two concurrent refreshes of
    // the same still-valid token both read revokedAt=null and both rotate — forking the
    // token family into two live leaves and defeating reuse-detection. The lock serializes
    // them; the loser sees the committed revoke below. (Mirrors session.ts #463.)
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        operatorUserId: string;
        tokenFamily: string;
        rotationCount: number;
        revokedAt: Date | null;
        expiresAt: Date;
      }>
    >(Prisma.sql`
      SELECT id, "operatorUserId", "tokenFamily", "rotationCount", "revokedAt", "expiresAt"
      FROM "OperatorSession"
      WHERE "refreshTokenHash" = ${oldHash}
      FOR UPDATE
    `);
    const session = rows[0];

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const now = new Date();

    // Already revoked. Two causes, opposite responses (#589, mirrors session.ts #519):
    //   (a) benign race — a concurrent refresh of the SAME token rotated first; the immediate
    //       successor (rotationCount+1) is still live and the revoke is fresh. Mint a fresh
    //       access token off the successor; leave the family and the (already-rotated) cookie.
    //   (b) genuine reuse — an old token replayed after its window. Cascade-revoke the family.
    if (session.revokedAt !== null) {
      if (session.revokedAt.getTime() > now.getTime() - REUSE_GRACE_MS) {
        const successor = await tx.operatorSession.findFirst({
          where: {
            tokenFamily: session.tokenFamily,
            rotationCount: session.rotationCount + 1,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true },
        });
        if (successor) {
          // Resolve the same operatorId/role claims the normal path mints (Issue 011/016).
          let racedOperatorId = operatorId;
          let racedRole: 'admin' | 'staff' | undefined;
          if (!racedOperatorId || !racedRole) {
            const user = await tx.operatorUser.findUnique({
              where: { id: session.operatorUserId },
              select: { operatorId: true, role: true },
            });
            if (!user) throw new Error('OPERATOR_USER_NOT_FOUND');
            racedOperatorId ??= user.operatorId;
            racedRole ??= user.role as 'admin' | 'staff';
          }
          const accessToken = await signOperatorAccess({
            sub: session.operatorUserId,
            scope: 'operator',
            role: racedRole ?? 'admin',
            requiresPasswordChange,
            operatorId: racedOperatorId,
          });
          return { raced: true as const, accessToken };
        }
      }
      await tx.operatorSession.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: now },
      });
      return { reuse: true as const };
    }

    // #589: an expired session must not rotate — the 30-day idle cap was never enforced.
    // Revoke it and deny via an `expired` sentinel (returning, not throwing, so the revoke
    // COMMITS; a throw would roll the tx back and leave the row live forever).
    if (session.expiresAt <= now) {
      await tx.operatorSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return { expired: true as const };
    }

    // Guarded revoke of the old row (#589). Under the lock this is belt-and-suspenders; a
    // count of 0 means a concurrent rotation already revoked it → treat as reuse.
    const revoked = await tx.operatorSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (revoked.count === 0) {
      await tx.operatorSession.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: now },
      });
      return { reuse: true as const };
    }

    const tokenId = crypto.randomUUID();
    const newRotation = session.rotationCount + 1;
    const iat = Math.floor(Date.now() / 1000);

    const { token: newRefreshToken, hash: newRefreshHash } = produceOpRefresh({
      tokenId,
      family: session.tokenFamily,
      operatorUserId: session.operatorUserId,
      iat,
      rotation: newRotation,
    });

    await tx.operatorSession.create({
      data: {
        operatorUserId: session.operatorUserId,
        tokenFamily: session.tokenFamily,
        rotationCount: newRotation,
        refreshTokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
      },
    });

    // Issue 011: operatorId must be present in the new token.
    // Issue 016: role claim also required in the new token.
    let resolvedOperatorId = operatorId;
    let resolvedRole: 'admin' | 'staff' | undefined;
    if (!resolvedOperatorId || !resolvedRole) {
      const user = await tx.operatorUser.findUnique({
        where: { id: session.operatorUserId },
        select: { operatorId: true, role: true },
      });
      if (!user) throw new Error('OPERATOR_USER_NOT_FOUND');
      resolvedOperatorId ??= user.operatorId;
      resolvedRole ??= user.role as 'admin' | 'staff';
    }

    const accessToken = await signOperatorAccess({
      sub: session.operatorUserId,
      scope: 'operator',
      // Issue 016: role claim — defensive fallback to 'admin' for one-release grace period.
      role: resolvedRole ?? 'admin',
      requiresPasswordChange,
      operatorId: resolvedOperatorId,
    });

    return { accessToken, refreshToken: newRefreshToken, refreshHash: newRefreshHash };
  });
}

// ---------------------------------------------------------------------------
// revokeOperatorSession
// ---------------------------------------------------------------------------

export async function revokeOperatorSession(refreshHash: string): Promise<void> {
  try {
    await prisma.operatorSession.update({
      where: { refreshTokenHash: refreshHash },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Idempotent — ignore "not found"
  }
}

// ---------------------------------------------------------------------------
// revokeAllOperatorSessions
// ---------------------------------------------------------------------------

export async function revokeAllOperatorSessions(
  operatorUserId: string,
  excludeSessionId?: string
): Promise<void> {
  const where = excludeSessionId
    ? { operatorUserId, NOT: { id: excludeSessionId } }
    : { operatorUserId };

  await prisma.operatorSession.updateMany({
    where,
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// verifyOpRefreshToken — exported for route handlers
// ---------------------------------------------------------------------------

export { verifyOpRefresh as verifyOpRefreshToken };
