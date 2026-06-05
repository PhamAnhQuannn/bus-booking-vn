/**
 * Session management — refresh token rotation with family-reuse detection.
 *
 * rotateRefresh(oldHash, ip) — atomic rotation inside a Prisma transaction.
 *   - Finds session by refreshTokenHash
 *   - If already revoked → revoke entire family → return { reuse: true }
 *   - Otherwise → revoke old row, create new row, return new tokens
 *   - If not found → throw Error('SESSION_NOT_FOUND')
 *
 * createSession(customerId, ip) — create fresh session (login/register/otp-verify).
 *
 * revokeSession(refreshHash) — soft-delete; idempotent.
 *
 * No PII (no OTP code, no password) is ever logged.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/core/db/client';
import { signAccess } from './jwt';
import { produce, generateFamily } from './refreshToken';
import { generateToken as generateCsrf } from './csrf';

// Session expiry: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionTokens {
  access: string;
  refreshToken: string;
  refreshHash: string;
  csrf: string;
}

export interface CreateSessionResult extends SessionTokens {
  family: string;
}

// ---------------------------------------------------------------------------
// rotateRefresh
// ---------------------------------------------------------------------------

export async function rotateRefresh(
  oldHash: string,
  _ip: string | null
): Promise<SessionTokens | { reuse: true }> {
  return prisma.$transaction(async (tx) => {
    // 1. Find the session by refreshTokenHash
    const session = await tx.session.findUnique({
      where: { refreshTokenHash: oldHash },
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // 2. Reuse detection: session was already revoked → revoke entire family
    if (session.revokedAt !== null) {
      await tx.session.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: new Date() },
      });
      return { reuse: true as const };
    }

    // 3. Revoke the old session row
    await tx.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // 4. Generate new refresh token
    const tokenId = crypto.randomUUID();
    const newRotation = session.rotationCount + 1;
    const iat = Math.floor(Date.now() / 1000);
    const { token: newRefreshToken, hash: newRefreshHash } = produce({
      tokenId,
      family: session.tokenFamily,
      customerId: session.customerId,
      iat,
      rotation: newRotation,
    });

    // 5. Insert new Session row
    await tx.session.create({
      data: {
        customerId: session.customerId,
        tokenFamily: session.tokenFamily,
        rotationCount: newRotation,
        refreshTokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
      },
    });

    // 6. Generate new access token and CSRF
    const access = await signAccess({ sub: session.customerId, role: 'customer' });
    const csrf = generateCsrf();

    return { access, refreshToken: newRefreshToken, refreshHash: newRefreshHash, csrf };
  });
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

export async function createSession(
  customerId: string,
  _ip: string | null
): Promise<CreateSessionResult> {
  const family = generateFamily();
  const tokenId = crypto.randomUUID();
  const iat = Math.floor(Date.now() / 1000);

  const { token: refreshToken, hash: refreshHash } = produce({
    tokenId,
    family,
    customerId,
    iat,
    rotation: 0,
  });

  await prisma.session.create({
    data: {
      customerId,
      tokenFamily: family,
      rotationCount: 0,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    },
  });

  const access = await signAccess({ sub: customerId, role: 'customer' });
  const csrf = generateCsrf();

  return { access, refreshToken, refreshHash, csrf, family };
}

// ---------------------------------------------------------------------------
// revokeSession
// ---------------------------------------------------------------------------

export async function revokeSession(refreshHash: string): Promise<void> {
  try {
    await prisma.session.update({
      where: { refreshTokenHash: refreshHash },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Idempotent — ignore "not found" errors
  }
}
