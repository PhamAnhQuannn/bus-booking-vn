/**
 * GET /api/auth/otp/test-peek?email=...
 *
 * TEST-ONLY endpoint: returns the last OTP code sent to the given email (or phone)
 * from the in-memory test sink. Disabled in production (returns 404).
 *
 * Dual-guard: NODE_ENV !== 'production' AND OTP_PEEK_ENABLED='true'.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { getTestOtp } from '@/lib/notification';

export function GET(req: NextRequest): Response {
  const peekEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.OTP_PEEK_ENABLED === 'true';
  if (!peekEnabled) {
    return new Response(null, { status: 404 });
  }

  const email = req.nextUrl.searchParams.get('email');
  const phone = req.nextUrl.searchParams.get('phone');
  const key = email || phone;
  if (!key) {
    return NextResponse.json({ error: 'email or phone param required' }, { status: 400 });
  }

  const code = getTestOtp(key);
  if (!code) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ code });
}
