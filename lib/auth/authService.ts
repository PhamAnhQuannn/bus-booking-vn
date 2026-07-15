/**
 * authService — register, login, verifyOtp, refresh, logout.
 *
 * All functions call DB/session libs in-process (no self-fetch per Issue 002/003 rule).
 * Error enum strings are safe to log; never disclose email existence to callers.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';
import { consume } from './otp';
import { hash as hashPassword, verify as verifyPassword, dummyVerify } from './password';
import { createSession, rotateRefresh, revokeSession } from './session';
import { verify as verifyRefreshToken } from './refreshToken';
import { backfillGuestBookingsByEmail } from '@/lib/booking';

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
        data: { email, passwordHash, displayName: input.displayName ?? null },
        select: { id: true, email: true, displayName: true },
      });
      if (created.email) {
        await backfillGuestBookingsByEmail(tx, created.id, created.email);
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
    select: { id: true, email: true, displayName: true, passwordHash: true },
  });

  if (!customer || !customer.passwordHash) {
    await dummyVerify();
    throw new AuthServiceError('INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(customer.passwordHash, input.password);
  if (!valid) {
    throw new AuthServiceError('INVALID_CREDENTIALS');
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
    customer: { id: customer.id, email: customer.email, displayName: customer.displayName },
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

export async function refresh(
  rawToken: string
): Promise<{ accessToken: string; refreshToken: string; refreshHash: string; csrf: string }> {
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

  return {
    accessToken: result.access,
    refreshToken: result.refreshToken,
    refreshHash: result.refreshHash,
    csrf: result.csrf,
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
