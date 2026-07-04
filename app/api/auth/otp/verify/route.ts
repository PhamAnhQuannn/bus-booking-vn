/**
 * POST /api/auth/otp/verify
 * Body: { email, code }
 * Response: { otpProof: string } | { error: 'invalid' | 'expired' | 'already_used' }
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { otpVerifyInput } from '@/lib/core/validation/auth';
import { verifyOtp } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { issueOtpProof } from '@/lib/auth';

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

  const { email, code } = parsed.data;
  const result = await verifyOtp(email, code);

  if (result.status === 'gone') {
    return NextResponse.json({ error: 'expired' }, { status: 400 });
  }
  if (result.status === 'mismatch') {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (result.status === 'attempt_cap') {
    return NextResponse.json({ error: 'attempt_cap' }, { status: 429 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otpProof = await issueOtpProof(normalizedEmail, 'otp_proof');

  return NextResponse.json({ otpProof });
}

export const POST = withErrorHandler(handler);
