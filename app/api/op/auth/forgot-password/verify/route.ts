/**
 * POST /api/op/auth/forgot-password/verify
 * Body: { phone, code }
 * Response: 200 { otpProof } (HS256 5min JWT, purpose='op_pwd_reset')
 *
 * Errors:
 *   400 INVALID — malformed body
 *   400 INVALID_CODE — wrong OTP code
 *   400 EXPIRED — OTP expired or not found
 *   429 LOCKED_OUT — 3 failed verifications in 15 min
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordVerifySchema } from '@/lib/auth/types';
import { verifyOperatorOtp } from '@/lib/auth/operatorOtp';
import { issueOtpProof } from '@/lib/auth/otpProof';
import { normalizePhone } from '@/lib/core/validation/phone';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = ForgotPasswordVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { phone, code } = parsed.data;
  const result = await verifyOperatorOtp(phone, code);

  if (result.status === 'locked_out') {
    return NextResponse.json({ error: 'LOCKED_OUT' }, { status: 429 });
  }
  if (result.status === 'gone') {
    return NextResponse.json({ error: 'EXPIRED' }, { status: 400 });
  }
  if (result.status === 'mismatch' || result.status === 'attempt_cap') {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 });
  }

  // status === 'ok' — issue short-lived OTP proof JWT
  const normalizedPhone = normalizePhone(phone);
  const otpProof = await issueOtpProof(normalizedPhone, 'op_pwd_reset');

  return NextResponse.json({ otpProof });
}

export const POST = withErrorHandler(handler);
