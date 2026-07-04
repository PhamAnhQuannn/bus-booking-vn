/**
 * POST /api/auth/forgot-password/verify
 * Body: { email, code }
 * Response: 200 { otpProof } (HS256 5min JWT, purpose='reset_password')
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { CustomerForgotPasswordVerifySchema } from '@/lib/auth';
import { verifyCustomerAccountOtp } from '@/lib/account';
import { issueOtpProof } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = CustomerForgotPasswordVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { email, code } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const result = await verifyCustomerAccountOtp(normalizedEmail, code);

  if (result.status === 'locked_out') {
    return NextResponse.json({ error: 'OTP_LOCKED_OUT' }, { status: 429 });
  }
  if (result.status === 'gone') {
    return NextResponse.json({ error: 'OTP_EXPIRED' }, { status: 400 });
  }
  if (result.status === 'mismatch' || result.status === 'attempt_cap') {
    return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 });
  }

  const otpProof = await issueOtpProof(normalizedEmail, 'reset_password');

  return NextResponse.json({ otpProof });
}

export const POST = withErrorHandler(handler);
