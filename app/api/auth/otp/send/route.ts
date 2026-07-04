/**
 * POST /api/auth/otp/send
 * Body: { email }
 * Response: { success: true } | { error: 'rate_limited', retryAfter: number }
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { otpSendInput } from '@/lib/core/validation/auth';
import { sendOtp } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = otpSendInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const result = await sendOtp(parsed.data.email);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfter: result.retryAfter },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
    );
  }

  return NextResponse.json({ success: true });
}

export const POST = withErrorHandler(handler);
