/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Response: 200 { ok: true, retryAfter?: number } always (no email enumeration).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { forgotPassword } from '@/lib/account';
import { clientIp } from '@/lib/core/http/clientIp';
import { otpSendPerIpRatelimit } from '@/lib/ratelimit';
import { z } from 'zod';

const schema = z.object({
  email: z.string().trim().email().max(254),
});

async function handler(req: NextRequest): Promise<Response> {
  // Per-IP OTP-send throttle (#470) — shares the entry-point IP bucket with /otp/send so one
  // IP cannot spray reset emails across many inboxes. IP-keyed → no email enumeration leak.
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const result = await forgotPassword(parsed.data.email);
  return NextResponse.json({ ok: true, ...(result.retryAfter != null && { retryAfter: result.retryAfter }) });
}

export const POST = withErrorHandler(handler);
