/**
 * POST /api/account/phone/init
 * Body: { newPhone }
 * Bearer auth required. Sends OTP to newPhone.
 *
 * AC3 status map:
 *   200 ok — OTP sent (or lockout/ratelimit, but always 200 for no-enumeration)
 *   429 LOCKED_OUT / RATE_LIMITED — explicit when it's our customer's own phone lockout
 *   401 UNAUTHORIZED
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth';
import { sendCustomerAccountOtp } from '@/lib/account/customerOtp';
import { z } from 'zod';
import { phoneSchema } from '@/lib/auth';

const schema = z.object({
  newPhone: phoneSchema,
});

async function handler(req: NextRequest, _auth: { customerId: string }): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const result = await sendCustomerAccountOtp(parsed.data.newPhone);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === 'locked_out' ? 'LOCKED_OUT' : 'RATE_LIMITED', retryAfter: result.retryAfter },
      { status: 429 }
    );
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(requireCustomerAuth()(handler));
