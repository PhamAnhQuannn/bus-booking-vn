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
import { z } from 'zod';

const registerBodySchema = registerInput.extend({
  otpProof: z.string().min(1),
});

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
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
    result = await register({ email, password, displayName });
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === 'EMAIL_TAKEN') {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 409 });
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

  return NextResponse.json({
    accessToken: result.accessToken,
    customer: result.customer,
  });
}

export const POST = withErrorHandler(handler);
