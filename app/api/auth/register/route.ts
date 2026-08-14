/**
 * POST /api/auth/register
 * Body: { email, otpProof, password, displayName? }
 *
 * Flow: validate otpProof JWT (issued by /api/auth/otp/verify) →
 *       create Customer + Session → return access token + set cookie.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { registerInput } from '@/lib/core/validation/auth';
import { register, AuthServiceError, verifyOtpProof } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { clientIp } from '@/lib/core/http/clientIp';
import { customerRegisterRatelimit } from '@/lib/ratelimit';
import { z } from 'zod';

const registerBodySchema = registerInput.extend({
  otpProof: z.string().min(1),
});

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

async function handler(req: NextRequest): Promise<Response> {
  // Per-IP registration throttle (#465, DS-003 §6.1: 5/15min/IP). Register was wide open —
  // login was limited but this path had no limiter, leaving mass account creation / OTP-bomb.
  const rl = await customerRegisterRatelimit.limit(`customer-register:${clientIp(req.headers)}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    // #479: surface a distinct WEAK_PASSWORD code when the ONLY validation failure is the
    // password policy, so the client shows a specific reason instead of a generic
    // "Đăng ký thất bại". Derive a CODE from the issue paths — never echo zodError.issues
    // across the boundary (SEC-ZOD-LEAK #566).
    const onlyPasswordFailed = parsed.error.issues.every((i) => i.path[0] === 'password');
    return NextResponse.json(
      { error: onlyPasswordFailed ? 'WEAK_PASSWORD' : 'INVALID' },
      { status: 400 },
    );
  }

  const { email, otpProof, password, displayName } = parsed.data;

  const proof = await verifyOtpProof(otpProof, 'otp_proof');
  if (!proof) {
    return NextResponse.json({ error: 'otp_proof_invalid' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (proof.email !== normalizedEmail) {
    return NextResponse.json({ error: 'otp_proof_invalid' }, { status: 400 });
  }

  let result;
  try {
    result = await register(
      { email, password, displayName },
      { ip: clientIp(req.headers), userAgent: req.headers.get('user-agent') },
    );
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === 'EMAIL_TAKEN') {
      // DS-003 §6.1 / FI-016: 409 with the AC-verbatim code EMAIL_TAKEN (FD-012 maps it to
      // "Email đã được đăng ký"). Not `invalid_credentials` — register is not a login path.
      return NextResponse.json({ error: 'EMAIL_TAKEN' }, { status: 409 });
    }
    throw err;
  }

  const cookieStore = await cookies();
  cookieStore.set('bb_rt', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return NextResponse.json(
    {
      accessToken: result.accessToken,
      customer: result.customer,
    },
    { status: 201 }, // DS-003 §6.1: register creates a Customer → 201 Created
  );
}

export const POST = withErrorHandler(handler);
