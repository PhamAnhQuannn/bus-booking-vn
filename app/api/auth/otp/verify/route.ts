/**
 * POST /api/auth/otp/verify
 * Body: { phone, code }
 * Response: { otpProof: string } | { error: 'invalid' | 'expired' | 'already_used' }
 *
 * otpProof is a short-lived HS256 JWT signed with JWT_SECRET that the register
 * endpoint validates before creating the customer account.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { otpVerifyInput } from '@/lib/core/validation/auth';
import { verifyOtp } from '@/lib/auth/authService';
import { normalizePhone } from '@/lib/auth/phoneNormalize';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { issueOtpProof } from '@/lib/auth/otpProof';

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = otpVerifyInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { phone, code } = parsed.data;
  const result = await verifyOtp(phone, code);

  if (result.status === 'gone') {
    return NextResponse.json({ error: 'expired' }, { status: 400 });
  }
  if (result.status === 'mismatch') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (result.status === 'attempt_cap') {
    return NextResponse.json({ error: 'attempt_cap' }, { status: 429 });
  }

  // status === 'ok' — issue short-lived OTP proof JWT via shared util
  const normalizedPhone = normalizePhone(phone);
  const otpProof = await issueOtpProof(normalizedPhone, 'otp_proof');

  return NextResponse.json({ otpProof });
}

export const POST = withErrorHandler(handler);
