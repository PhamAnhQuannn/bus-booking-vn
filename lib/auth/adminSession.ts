/**
 * Admin session management — refresh token rotation with family-reuse detection.
 *
 * Issue 054: mirrors lib/auth/operatorSession.ts EXACTLY but operates on
 * AdminSession rows. Refresh tokens use the same HMAC structure but carry
 * adminUserId in the payload.
 *
 * issueAdminSession(adminUserId, role, totpVerified=false) — create fresh session (login).
 * rotateAdminRefresh(oldHash, role?) — atomic rotation inside a Prisma transaction. TOTP
 *   elevation is preserved from the AdminSession.totpVerifiedAt row (#564), not a caller arg.
 *   - If already revoked → revoke entire family → return { reuse: true }
 *   - Otherwise → revoke old row, create new row, return new tokens
 *   - If not found → throw Error('SESSION_NOT_FOUND')
 * revokeAdminSession(refreshHash) — soft-delete; idempotent.
 * revokeAllAdminSessions(adminUserId) — revoke all sessions for the admin.
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { signAdminAccess, type AdminAccessPayload } from './jwt';

type AdminRole = AdminAccessPayload['role'];

// Session expiry: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Reuse-detection grace window (#589, mirrors session.ts #519). A concurrent double-refresh
// of the same token serializes on the FOR UPDATE lock; the loser re-reads the just-revoked
// row. Within this window, if the immediate successor is still live, that is a benign race
// (two tabs), NOT token theft — mint a fresh access token instead of nuking the family.
const REUSE_GRACE_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers — HMAC-based refresh tokens (mirrors operatorSession.ts)
// ---------------------------------------------------------------------------

function getRefreshSecret(): Buffer {
  const raw =
    process.env.REFRESH_TOKEN_SECRET_ADMIN ??
    (process.env.NODE_ENV === 'test' ? 'd'.repeat(32) : null);
  if (!raw) throw new Error('REFRESH_TOKEN_SECRET_ADMIN not configured');
  return Buffer.from(raw, 'utf8');
}

interface AdminRefreshPayload {
  tokenId: string;
  family: string;
  adminUserId: string;
  iat: number;
  rotation: number;
}

function produceAdminRefresh(payload: AdminRefreshPayload): { token: string; hash: string } {
  const secret = getRefreshSecret();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  const token = `${payloadB64}.${hmac}`;
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

function verifyAdminRefresh(token: string): { payload: AdminRefreshPayload; hash: string } | null {
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
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AdminRefreshPayload;
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    return { payload, hash };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminSessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
}

export interface IssueAdminSessionResult extends AdminSessionTokens {
  family: string;
}

// ---------------------------------------------------------------------------
// issueAdminSession
// ---------------------------------------------------------------------------

export async function issueAdminSession(
  adminUserId: string,
  role: AdminRole,
  totpVerified = false
): Promise<IssueAdminSessionResult> {
  const family = crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);

  const { token: refreshToken, hash: refreshHash } = produceAdminRefresh({
    tokenId,
    family,
    adminUserId,
    iat,
    rotation: 0,
  });

  await prisma.adminSession.create({
    data: {
      adminUserId,
      tokenFamily: family,
      rotationCount: 0,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
      // #564: anchor elevation on the row. A fresh login is unelevated (null); the TOTP-verify
      // path issues with totpVerified=true → stamps now(), so refresh can preserve it.
      totpVerifiedAt: totpVerified ? new Date() : null,
    },
  });

  const accessToken = await signAdminAccess({
    sub: adminUserId,
    scope: 'admin',
    role,
    totpVerified,
  });

  return { accessToken, refreshToken, refreshHash, family };
}

// ---------------------------------------------------------------------------
// rotateAdminRefresh
// ---------------------------------------------------------------------------

export async function rotateAdminRefresh(
  oldHash: string,
  role?: AdminRole
): Promise<
  | AdminSessionTokens
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
        adminUserId: string;
        tokenFamily: string;
        rotationCount: number;
        revokedAt: Date | null;
        expiresAt: Date;
        totpVerifiedAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT id, "adminUserId", "tokenFamily", "rotationCount", "revokedAt", "expiresAt", "totpVerifiedAt"
      FROM "AdminSession"
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
    //       access token off the successor (carrying ITS elevation); leave the family/cookie.
    //   (b) genuine reuse — an old token replayed after its window. Cascade-revoke the family.
    if (session.revokedAt !== null) {
      if (session.revokedAt.getTime() > now.getTime() - REUSE_GRACE_MS) {
        const successor = await tx.adminSession.findFirst({
          where: {
            tokenFamily: session.tokenFamily,
            rotationCount: session.rotationCount + 1,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true, totpVerifiedAt: true },
        });
        if (successor) {
          let racedRole = role;
          if (!racedRole) {
            const admin = await tx.adminUser.findUnique({
              where: { id: session.adminUserId },
              select: { role: true },
            });
            if (!admin) throw new Error('ADMIN_USER_NOT_FOUND');
            racedRole = admin.role as AdminRole;
          }
          const accessToken = await signAdminAccess({
            sub: session.adminUserId,
            scope: 'admin',
            role: racedRole,
            // #564: elevation reflects the LIVE successor row, not the replayed loser.
            totpVerified: successor.totpVerifiedAt !== null,
          });
          return { raced: true as const, accessToken };
        }
      }
      await tx.adminSession.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: now },
      });
      return { reuse: true as const };
    }

    // #589: an expired session must not rotate — the 30-day idle cap was never enforced.
    // Revoke it and deny via an `expired` sentinel (returning, not throwing, so the revoke
    // COMMITS; a throw would roll the tx back and leave the row live forever).
    if (session.expiresAt <= now) {
      await tx.adminSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return { expired: true as const };
    }

    // Guarded revoke of the old row (#589). Under the lock this is belt-and-suspenders; a
    // count of 0 means a concurrent rotation already revoked it → treat as reuse.
    const revoked = await tx.adminSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (revoked.count === 0) {
      await tx.adminSession.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: now },
      });
      return { reuse: true as const };
    }

    const tokenId = crypto.randomUUID();
    const newRotation = session.rotationCount + 1;
    const iat = Math.floor(Date.now() / 1000);

    const { token: newRefreshToken, hash: newRefreshHash } = produceAdminRefresh({
      tokenId,
      family: session.tokenFamily,
      adminUserId: session.adminUserId,
      iat,
      rotation: newRotation,
    });

    // #564: PRESERVE TOTP elevation across rotation. The old code hard-reset it to false, so a
    // TOTP-verified admin silently lost elevation on every ~10-min refresh. Elevation is now
    // anchored on the AdminSession row — carry it forward and derive the claim from it, so a
    // rotation faithfully reflects the session's real elevation state (no self-asserted param).
    const totpVerifiedAt = session.totpVerifiedAt;
    await tx.adminSession.create({
      data: {
        adminUserId: session.adminUserId,
        tokenFamily: session.tokenFamily,
        rotationCount: newRotation,
        refreshTokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        totpVerifiedAt,
      },
    });

    // Resolve role from AdminUser if the caller didn't pass it — the new access
    // token must carry the current role claim.
    let resolvedRole = role;
    if (!resolvedRole) {
      const admin = await tx.adminUser.findUnique({
        where: { id: session.adminUserId },
        select: { role: true },
      });
      if (!admin) throw new Error('ADMIN_USER_NOT_FOUND');
      resolvedRole = admin.role as AdminRole;
    }

    const accessToken = await signAdminAccess({
      sub: session.adminUserId,
      scope: 'admin',
      role: resolvedRole,
      totpVerified: totpVerifiedAt !== null,
    });

    return { accessToken, refreshToken: newRefreshToken, refreshHash: newRefreshHash };
  });
}

// ---------------------------------------------------------------------------
// revokeAdminSession
// ---------------------------------------------------------------------------

export async function revokeAdminSession(refreshHash: string): Promise<void> {
  try {
    await prisma.adminSession.update({
      where: { refreshTokenHash: refreshHash },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Idempotent — ignore "not found"
  }
}

// ---------------------------------------------------------------------------
// revokeAllAdminSessions
// ---------------------------------------------------------------------------

export async function revokeAllAdminSessions(adminUserId: string): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { adminUserId },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// verifyAdminRefreshToken — exported for route handlers
// ---------------------------------------------------------------------------

export { verifyAdminRefresh as verifyAdminRefreshToken };
