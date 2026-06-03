/**
 * Admin session management — refresh token rotation with family-reuse detection.
 *
 * Issue 054: mirrors lib/auth/operatorSession.ts EXACTLY but operates on
 * AdminSession rows. Refresh tokens use the same HMAC structure but carry
 * adminUserId in the payload.
 *
 * issueAdminSession(adminUserId, role, totpVerified=false) — create fresh session (login).
 * rotateAdminRefresh(oldHash, role?, totpVerified?) — atomic rotation inside a Prisma transaction.
 *   - If already revoked → revoke entire family → return { reuse: true }
 *   - Otherwise → revoke old row, create new row, return new tokens
 *   - If not found → throw Error('SESSION_NOT_FOUND')
 * revokeAdminSession(refreshHash) — soft-delete; idempotent.
 * revokeAllAdminSessions(adminUserId) — revoke all sessions for the admin.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { signAdminAccess, type AdminAccessPayload } from './jwt';

type AdminRole = AdminAccessPayload['role'];

// Session expiry: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers — HMAC-based refresh tokens (mirrors operatorSession.ts)
// ---------------------------------------------------------------------------

function getRefreshSecret(): Buffer {
  const raw =
    process.env.REFRESH_TOKEN_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'b'.repeat(32) : null);
  if (!raw) throw new Error('REFRESH_TOKEN_SECRET not configured');
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
  role?: AdminRole,
  totpVerified = false
): Promise<AdminSessionTokens | { reuse: true }> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.adminSession.findUnique({
      where: { refreshTokenHash: oldHash },
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // Reuse detection: already revoked → revoke entire family
    if (session.revokedAt !== null) {
      await tx.adminSession.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: new Date() },
      });
      return { reuse: true as const };
    }

    // Revoke old session row
    await tx.adminSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

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

    await tx.adminSession.create({
      data: {
        adminUserId: session.adminUserId,
        tokenFamily: session.tokenFamily,
        rotationCount: newRotation,
        refreshTokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
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
      totpVerified,
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
