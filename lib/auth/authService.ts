/**
 * authService — register, login, verifyOtp, refresh, logout.
 *
 * All functions call DB/session libs in-process (no self-fetch per Issue 002/003 rule).
 * Error enum strings are safe to log; never disclose email existence to callers.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { consume } from './otp';
import { hash as hashPassword, verify as verifyPassword, dummyVerify, needsRehash } from './password';
import { createSession, rotateRefresh, revokeSession } from './session';
import { verify as verifyRefreshToken } from './refreshToken';
import { backfillGuestBookingsByEmail } from '@/lib/booking';
import { asProvenEmail } from '@/lib/core/validation/provenEmail';
import { checkCustomerActive } from './assertCustomerActive';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
  csrf: string;
  customer: {
    id: string;
    email: string | null;
    displayName: string | null;
  };
}

export type AuthError =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'OTP_MISMATCH'
  | 'OTP_GONE'
  | 'OTP_LOCKED_OUT'
  | 'OTP_RATE_LIMITED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_REUSE'
  | 'REFRESH_INVALID';

export class AuthServiceError extends Error {
  constructor(public readonly code: AuthError) {
    super(code);
    this.name = 'AuthServiceError';
  }
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  let customer: { id: string; email: string | null; displayName: string | null };
  try {
    customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        // emailVerifiedAt: the caller (POST /api/auth/register) gates on a single-use
        // OTP proof matching this email before register() runs, so ownership is proven
        // at creation time (P13). No separate verification-link step for the password path.
        data: {
          email,
          passwordHash,
          displayName: input.displayName ?? null,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true, displayName: true },
      });
      if (created.email) {
        // Email ownership was proven upstream (the register route validates an OTP
        // proof matching this email), so it is safe to brand as ProvenEmail (P22).
        await backfillGuestBookingsByEmail(tx, created.id, asProvenEmail(created.email));
      }
      return created;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AuthServiceError('EMAIL_TAKEN');
    }
    throw err;
  }

  const session = await createSession(customer.id, null);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken: session.access,
    refreshToken: session.refreshToken,
    refreshHash: session.refreshHash,
    csrf: session.csrf,
    customer,
  };
}

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const customer = await prisma.customer.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, displayName: true, passwordHash: true, suspendedAt: true },
  });

  // P8: a suspended customer must not mint a session even with the right password.
  // Fold it into the pre-verify guard (with dummyVerify for timing parity) and keep
  // the error uniform as INVALID_CREDENTIALS — never leak suspension state pre-auth.
  // Uses the shared checkCustomerActive so this can't drift from requireCustomerAuth
  // (deletedAt is already excluded by the `where` above, so pass it as null).
  if (
    !customer ||
    !customer.passwordHash ||
    !checkCustomerActive({ suspendedAt: customer.suspendedAt, deletedAt: null }).active
  ) {
    await dummyVerify();
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(customer.passwordHash, input.password);
  if (!valid) {
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  const session = await createSession(customer.id, null);

  // Rehash-on-verify (P19): upgrade a legacy scrypt hash to argon2id on a successful
  // login. Best-effort — never block login if the upgrade or its write fails. Only
  // persist when the new hash is actually argon2 (argon2 unavailable → hash() returns
  // scrypt → needsRehash still true → skip, no pointless churn).
  let upgradedHash: string | undefined;
  if (needsRehash(customer.passwordHash)) {
    try {
      const rehashed = await hashPassword(input.password);
      if (!needsRehash(rehashed)) upgradedHash = rehashed;
    } catch {
      // ignore — login proceeds on the existing hash
    }
  }

  try {
    await prisma.customer.update({
      // When upgrading the hash, guard on the value we just verified so a concurrent
      // changePassword committed between the read and here isn't silently clobbered — the
      // update then misses (P2025) instead of overwriting the new hash. When not upgrading,
      // the where is just { id } and never misses. Best-effort: the session is already
      // minted, so a lost rehash race (or transient write) must not fail the login.
      where: upgradedHash
        ? { id: customer.id, passwordHash: customer.passwordHash }
        : { id: customer.id },
      data: { lastLoginAt: new Date(), ...(upgradedHash ? { passwordHash: upgradedHash } : {}) },
    });
  } catch {
    // ignore — rehash + lastLoginAt are best-effort; login proceeds on the minted session.
  }

  return {
    accessToken: session.access,
    refreshToken: session.refreshToken,
    refreshHash: session.refreshHash,
    csrf: session.csrf,
    customer: { id: customer.id, email: customer.email, displayName: customer.displayName },
  };
}

// ---------------------------------------------------------------------------
// createCustomerSession — OAuth callback session mint (DS-033 L4)
// ---------------------------------------------------------------------------

/**
 * Mint a customer session for an already-authenticated identity (Google OAuth callback).
 * Mirrors the tail of login(): createSession + stamp lastLoginAt. The caller sets bb_rt;
 * the access token is re-minted via /api/auth/refresh on landing (a 302 has no body).
 */
export async function createCustomerSession(
  customerId: string
): Promise<{ accessToken: string; refreshToken: string; refreshHash: string; csrf: string }> {
  const session = await createSession(customerId, null);
  await prisma.customer.update({
    where: { id: customerId },
    data: { lastLoginAt: new Date() },
  });
  return {
    accessToken: session.access,
    refreshToken: session.refreshToken,
    refreshHash: session.refreshHash,
    csrf: session.csrf,
  };
}

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------

export interface VerifyOtpResult {
  status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap';
  otpId?: string;
}

export async function verifyOtp(rawEmail: string, code: string): Promise<VerifyOtpResult> {
  const email = rawEmail.trim().toLowerCase();
  return consume(email, code);
}

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------

export async function refresh(rawToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
  csrf: string;
  displayName: string | null;
  email: string | null;
}> {
  const verified = verifyRefreshToken(rawToken);
  if (!verified) throw new AuthServiceError('REFRESH_INVALID');

  let result: Awaited<ReturnType<typeof rotateRefresh>>;
  try {
    result = await rotateRefresh(verified.hash, null);
  } catch (err) {
    if (err instanceof Error && err.message === 'SESSION_NOT_FOUND') {
      throw new AuthServiceError('SESSION_NOT_FOUND');
    }
    throw err;
  }
  if ('reuse' in result) {
    throw new AuthServiceError('SESSION_REUSE');
  }
  // #464: rotate re-checked the customer and found them suspended/deleted — the
  // family is already revoked; deny the refresh (client must re-login → login blocks).
  if ('inactive' in result) {
    throw new AuthServiceError('SESSION_NOT_FOUND');
  }

  // Rehydrate the client's display name / email on a full page load — SessionBootstrap only
  // has the refresh cookie, so without this the account menu falls back to "Khách hàng" (QA F1).
  const customer = await prisma.customer.findFirst({
    where: { id: result.customerId, deletedAt: null },
    select: { displayName: true, email: true },
  });

  return {
    accessToken: result.access,
    refreshToken: result.refreshToken,
    refreshHash: result.refreshHash,
    csrf: result.csrf,
    displayName: customer?.displayName ?? null,
    email: customer?.email ?? null,
  };
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export async function logout(rawToken: string): Promise<void> {
  const verified = verifyRefreshToken(rawToken);
  if (!verified) return;
  await revokeSession(verified.hash);
}
