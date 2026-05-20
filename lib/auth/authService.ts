/**
 * authService — register, login, verifyOtp, refresh, logout.
 *
 * All functions call DB/session libs in-process (no self-fetch per Issue 002/003 rule).
 * Error enum strings are safe to log; never disclose phone/email existence to callers.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { normalizePhone } from './phoneNormalize';
import { consume } from './otp';
import { hash as hashPassword, verify as verifyPassword, dummyVerify } from './password';
import { createSession, rotateRefresh, revokeSession } from './session';
import { verify as verifyRefreshToken } from './refreshToken';
import { backfillGuestBookingsForCustomer } from '@/lib/booking/attachGuestBookingByPhone';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterInput {
  phone: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
  csrf: string;
  customer: {
    id: string;
    phone: string;
    displayName: string | null;
  };
}

export type AuthError =
  | 'INVALID_CREDENTIALS'
  | 'PHONE_TAKEN'
  | 'OTP_MISMATCH'
  | 'OTP_GONE'
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
  const phone = normalizePhone(input.phone);
  const passwordHash = await hashPassword(input.password);

  let customer: { id: string; phone: string; displayName: string | null };
  try {
    customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: { phone, passwordHash, displayName: input.displayName ?? null },
        select: { id: true, phone: true, displayName: true },
      });
      // Issue 009 AC(a): attach pre-existing guest bookings made with this phone.
      await backfillGuestBookingsForCustomer(tx, created.id, created.phone);
      return created;
    });
  } catch (err) {
    // Prisma unique constraint violation on Customer.phone
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AuthServiceError('PHONE_TAKEN');
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
  const phone = normalizePhone(input.phone);

  const customer = await prisma.customer.findUnique({
    where: { phone },
    select: { id: true, phone: true, displayName: true, passwordHash: true },
  });

  if (!customer || !customer.passwordHash) {
    // Run dummy verify to prevent timing-based phone enumeration
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
    customer: { id: customer.id, phone: customer.phone, displayName: customer.displayName },
  };
}

// ---------------------------------------------------------------------------
// verifyOtp
// ---------------------------------------------------------------------------

export interface VerifyOtpResult {
  status: 'ok' | 'mismatch' | 'gone' | 'attempt_cap';
  otpId?: string;
}

export async function verifyOtp(rawPhone: string, code: string): Promise<VerifyOtpResult> {
  const phone = normalizePhone(rawPhone);
  return consume(phone, code);
}

// ---------------------------------------------------------------------------
// refresh
// ---------------------------------------------------------------------------

export async function refresh(
  rawToken: string
): Promise<{ accessToken: string; refreshToken: string; refreshHash: string; csrf: string }> {
  const verified = verifyRefreshToken(rawToken);
  if (!verified) throw new AuthServiceError('REFRESH_INVALID');

  const result = await rotateRefresh(verified.hash, null);
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
  if (!verified) return; // already invalid, nothing to revoke
  await revokeSession(verified.hash);
}
