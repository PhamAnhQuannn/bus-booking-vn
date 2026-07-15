/**
 * POST /api/auth/login/verify-otp
 * Body: { loginChallenge, code }
 *
 * Step 2 of operator 2FA login. Verifies the OTP code sent to operator email,
 * then issues a full session (access + refresh tokens).
 *
 * The loginChallenge JWT (5min TTL, purpose 'op_login', one-shot via jti)
 * proves that password was verified in step 1. The JWT's email claim carries
 * the operatorUserId.
 *
 * 200 → { accessToken, operator, requiresPasswordChange }
 *   + Set-Cookie bb_op_access (15min) + bb_op_refresh (30d)
 * 400 → invalid_code / expired / invalid_challenge
 * 429 → OTP locked out
 */

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifyOtpProof, verifyOperatorLoginOtp, operatorLoginStep2, AuthServiceError } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const ACCESS_COOKIE_MAX_AGE = 15 * 60;

const verifyOtpInput = z.object({
  loginChallenge: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
});

async function handler(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = verifyOtpInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { loginChallenge, code } = parsed.data;

  // Verify the loginChallenge JWT (one-shot, 5min TTL)
  const proof = await verifyOtpProof(loginChallenge, 'op_login');
  if (!proof) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 400 });
  }

  // proof.email carries the operatorUserId (set by issueOtpProof in step 1)
  const operatorUserId = proof.email;
  if (!operatorUserId) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 400 });
  }

  // Look up the user's email to verify OTP against
  const { prisma } = await import('@/lib/core/db/client');
  const user = await prisma.operatorUser.findUnique({
    where: { id: operatorUserId },
    select: { email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 400 });
  }

  // Verify the OTP code
  const otpResult = await verifyOperatorLoginOtp(user.email, code);

  if (otpResult.status === 'locked_out') {
    return NextResponse.json({ error: 'OTP_LOCKED_OUT' }, { status: 429 });
  }
  if (otpResult.status === 'gone') {
    return NextResponse.json({ error: 'expired' }, { status: 400 });
  }
  if (otpResult.status === 'mismatch' || otpResult.status === 'attempt_cap') {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  // OTP verified — issue full session
  let result;
  try {
    result = await operatorLoginStep2(operatorUserId);
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === 'INVALID_CREDENTIALS') {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    throw err;
  }

  const cookieStore = await cookies();

  cookieStore.set('bb_op_access', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  cookieStore.set('bb_op_refresh', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return NextResponse.json({
    accessToken: result.accessToken,
    operator: result.operator,
    requiresPasswordChange: result.requiresPasswordChange,
  });
}

export const POST = withErrorHandler(handler);
