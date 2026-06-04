/**
 * POST /api/auth/forgot-password/verify  (Issue 008 AC1)
 * Body: { phone, code }
 * Response: 200 { otpProof } (HS256 5min JWT, purpose='reset_password')
 *
 * Middle leg of the customer forgot-password flow: converts a verified OTP
 * code into a single-use reset_password proof that /api/auth/reset-password
 * consumes. Mirrors /api/op/auth/forgot-password/verify.
 *
 * Pre-auth: CSRF-exempt via the /api/auth/forgot-password prefix in proxy.ts.
 *
 * Errors:
 *   400 INVALID — malformed body
 *   400 OTP_INVALID — wrong OTP code
 *   400 OTP_EXPIRED — OTP expired or not found
 *   429 OTP_LOCKED_OUT — 3 failed verifications in 15 min (AC6)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordVerifySchema } from '@/lib/auth';
import { verifyCustomerAccountOtp } from '@/lib/account/customerOtp';
import { issueOtpProof } from '@/lib/auth';
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
  const result = await verifyCustomerAccountOtp(phone, code);

  if (result.status === 'locked_out') {
    return NextResponse.json({ error: 'OTP_LOCKED_OUT' }, { status: 429 });
  }
  if (result.status === 'gone') {
    return NextResponse.json({ error: 'OTP_EXPIRED' }, { status: 400 });
  }
  if (result.status === 'mismatch' || result.status === 'attempt_cap') {
    return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 });
  }

  // status === 'ok' — issue single-use reset_password proof (normalized phone
  // so resetPassword's findFirst { phone: proof.phone } matches Customer.phone)
  const otpProof = await issueOtpProof(normalizePhone(phone), 'reset_password');

  return NextResponse.json({ otpProof });
}

export const POST = withErrorHandler(handler);
