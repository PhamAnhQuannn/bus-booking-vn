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
import { prisma } from '@/lib/db/client';
import { signOperatorAccess } from './jwt';

// Session expiry: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers — HMAC-based refresh tokens (mirrors refreshToken.ts pattern)
// ---------------------------------------------------------------------------

function getRefreshSecret(): Buffer {
  const raw =
    process.env.REFRESH_TOKEN_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'b'.repeat(32) : null);
  if (!raw) throw new Error('REFRESH_TOKEN_SECRET not configured');
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
  operatorId?: string
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
  let resolvedOperatorId = operatorId;
  if (!resolvedOperatorId) {
    const user = await prisma.operatorUser.findUnique({
      where: { id: operatorUserId },
      select: { operatorId: true },
    });
    if (!user) throw new Error('OPERATOR_USER_NOT_FOUND');
    resolvedOperatorId = user.operatorId;
  }

  const accessToken = await signOperatorAccess({
    sub: operatorUserId,
    scope: 'operator',
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
): Promise<OperatorSessionTokens | { reuse: true }> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.operatorSession.findUnique({
      where: { refreshTokenHash: oldHash },
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // Reuse detection: already revoked → revoke entire family
    if (session.revokedAt !== null) {
      await tx.operatorSession.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: new Date() },
      });
      return { reuse: true as const };
    }

    // Revoke old session row
    await tx.operatorSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

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
    let resolvedOperatorId = operatorId;
    if (!resolvedOperatorId) {
      const user = await tx.operatorUser.findUnique({
        where: { id: session.operatorUserId },
        select: { operatorId: true },
      });
      if (!user) throw new Error('OPERATOR_USER_NOT_FOUND');
      resolvedOperatorId = user.operatorId;
    }

    const accessToken = await signOperatorAccess({
      sub: session.operatorUserId,
      scope: 'operator',
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
