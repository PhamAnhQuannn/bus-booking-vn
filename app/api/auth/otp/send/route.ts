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
import { clientIp } from '@/lib/core/http/clientIp';
import { otpSendPerIpRatelimit } from '@/lib/ratelimit';

async function handler(req: NextRequest): Promise<Response> {
  // Per-IP OTP-send throttle (#470) — the per-identifier budget inside sendOtp caps hits on
  // ONE inbox; this caps one IP spraying MANY inboxes. Enumeration-safe (IP-keyed).
  const ipRl = await otpSendPerIpRatelimit.limit(`otp-send-ip:${clientIp(req.headers)}`);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfter: ipRl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(ipRl.retryAfter) } }
    );
  }

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
