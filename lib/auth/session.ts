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
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';
import { signAccess } from './jwt';
import { produce, generateFamily } from './refreshToken';
import { generateToken as generateCsrf } from './csrf';
import { checkCustomerActive } from './assertCustomerActive';

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
  customerId: string;
}

export interface CreateSessionResult extends SessionTokens {
  family: string;
}

/**
 * Request-derived forensics captured on a Session row (#477): the client's current IP and
 * User-Agent, for login-history / active-devices. Both optional — server-to-server mints
 * (none today) pass nothing. IP is intentionally NOT globally log-redacted (rate-limit
 * forensics log it deliberately); userAgent IS redacted (never logged elsewhere).
 */
export interface SessionContext {
  ip?: string | null;
  userAgent?: string | null;
}

// ---------------------------------------------------------------------------
// rotateRefresh
// ---------------------------------------------------------------------------

export async function rotateRefresh(
  oldHash: string,
  ctx: SessionContext = {}
): Promise<SessionTokens | { reuse: true } | { inactive: true }> {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the session row FOR UPDATE (#463). Without the lock two concurrent
    //    refreshes of the same still-valid token both read revokedAt=null and both
    //    rotate — forking the token family into two live leaves and defeating
    //    reuse-detection. The lock serializes them; the loser sees the committed
    //    revoke below and is caught as reuse. (Repo read-then-write FOR-UPDATE rule.)
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        customerId: string;
        tokenFamily: string;
        rotationCount: number;
        revokedAt: Date | null;
        expiresAt: Date;
      }>
    >(Prisma.sql`
      SELECT id, "customerId", "tokenFamily", "rotationCount", "revokedAt", "expiresAt"
      FROM "Session"
      WHERE "refreshTokenHash" = ${oldHash}
      FOR UPDATE
    `);
    const session = rows[0];

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const now = new Date();

    // 2. Reuse detection: session was already revoked → revoke entire family
    if (session.revokedAt !== null) {
      await tx.session.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: now },
      });
      return { reuse: true as const };
    }

    // 2b. Expired session must not rotate (#476). Session.expiresAt was written but
    //     never enforced. Revoke it and deny.
    if (session.expiresAt <= now) {
      await tx.session.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new Error('SESSION_NOT_FOUND');
    }

    // 2c. Re-check the customer is still active (#464). suspendCustomer revokes
    //     sessions at suspend time, but a token rotated after that instant would keep
    //     rotating forever with no gate (refresh never re-checked). Revoke the whole
    //     family and RETURN an `inactive` sentinel — returning (not throwing) so the
    //     family-revoke COMMITS (a throw rolls back the tx). refresh() maps the
    //     sentinel to a denial.
    const customer = await tx.customer.findUnique({
      where: { id: session.customerId },
      select: { suspendedAt: true, deletedAt: true },
    });
    if (
      !customer ||
      !checkCustomerActive({ suspendedAt: customer.suspendedAt, deletedAt: customer.deletedAt }).active
    ) {
      await tx.session.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: now },
      });
      return { inactive: true as const };
    }

    // 3. Revoke the old session row, GUARDED on revokedAt:null (#463). Under the
    //    FOR UPDATE lock this is belt-and-suspenders; a count of 0 means a concurrent
    //    rotation already revoked it → treat as reuse (revoke the family).
    const revoked = await tx.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (revoked.count === 0) {
      await tx.session.updateMany({
        where: { tokenFamily: session.tokenFamily },
        data: { revokedAt: now },
      });
      return { reuse: true as const };
    }

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

    // 5. Insert new Session row (carry the caller's current IP/UA forward — #477).
    await tx.session.create({
      data: {
        customerId: session.customerId,
        tokenFamily: session.tokenFamily,
        rotationCount: newRotation,
        refreshTokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
      },
    });

    // 6. Generate new access token and CSRF
    const access = await signAccess({ sub: session.customerId, role: 'customer' });
    const csrf = generateCsrf();

    return {
      access,
      refreshToken: newRefreshToken,
      refreshHash: newRefreshHash,
      csrf,
      customerId: session.customerId,
    };
  });
}

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

export async function createSession(
  customerId: string,
  ctx: SessionContext = {}
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
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });

  const access = await signAccess({ sub: customerId, role: 'customer' });
  const csrf = generateCsrf();

  return { access, refreshToken, refreshHash, csrf, family, customerId };
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
