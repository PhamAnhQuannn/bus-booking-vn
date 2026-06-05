/**
 * POST /api/auth/forgot-password
 * Body: { phone }
 * Response: 200 { ok: true } always (no phone enumeration).
 *
 * Sends OTP to the phone if a non-deleted customer exists.
 * Max 3 resends per 15 min; always-200 even on rate-limit / lockout.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { forgotPassword } from '@/lib/account';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().trim().regex(/^(0|\+84)[35789][0-9]{8}$/),
});

async function handler(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Return 200 even on invalid phone — no enumeration
    return NextResponse.json({ ok: true });
  }

  await forgotPassword(parsed.data.phone);
  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandler(handler);
