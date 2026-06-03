/**
 * POST /api/auth/register
 * Body: { phone, otpProof, password, displayName? }
 *
 * Flow: validate otpProof JWT (issued by /api/auth/otp/verify) →
 *       create Customer + Session → return access token + set cookie.
 * Access token in response body (900s TTL).
 * Refresh token in HttpOnly cookie bb_rt (30d).
 *
 * The OTP is consumed once at /api/auth/otp/verify. The register endpoint
 * validates the short-lived otpProof JWT — no second OTP consumption.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { registerInput } from '@/lib/core/validation/auth';
import { register, AuthServiceError } from '@/lib/auth/authService';
import { normalizePhone } from '@/lib/auth/phoneNormalize';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { jwtVerify } from 'jose';
import { z } from 'zod';

// Extend the shared registerInput schema with otpProof (register-only field).
// Single source of truth: phone/password/displayName come from registerInput.
const registerBodySchema = registerInput.extend({
  otpProof: z.string().min(1),
});

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getJwtSecret(): Uint8Array {
  const raw =
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === 'test' ? 'a'.repeat(32) : null);
  if (!raw) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(raw);
}

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

  const { phone, otpProof, password, displayName } = parsed.data;

  // Validate the otpProof JWT issued by /api/auth/otp/verify.
  // The JWT encodes { phone, purpose: 'otp_proof' } and expires in 5 minutes.
  let proofPayload: { phone?: string; purpose?: string };
  try {
    const { payload } = await jwtVerify(otpProof, getJwtSecret());
    proofPayload = payload as { phone?: string; purpose?: string };
  } catch {
    return NextResponse.json({ error: 'otp_proof_invalid' }, { status: 400 });
  }

  if (proofPayload.purpose !== 'otp_proof') {
    return NextResponse.json({ error: 'otp_proof_invalid' }, { status: 400 });
  }

  // The phone in the proof must match the request phone (normalized).
  const normalizedPhone = normalizePhone(phone);
  if (proofPayload.phone !== normalizedPhone) {
    return NextResponse.json({ error: 'otp_proof_invalid' }, { status: 400 });
  }

  let result;
  try {
    result = await register({ phone, password, displayName });
  } catch (err) {
    if (err instanceof AuthServiceError && err.code === 'PHONE_TAKEN') {
      // Generic error — do not reveal phone existence
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
