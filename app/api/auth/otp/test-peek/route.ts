/**
 * GET /api/auth/otp/test-peek?phone=...
 *
 * TEST-ONLY endpoint: returns the last OTP code sent to `phone` from the in-memory
 * eSMS stub sink. Disabled in production (returns 404).
 *
 * Used by E2E specs to complete the verify → register round trip without a real SMS provider.
 *
 * Dual-guard rationale: NODE_ENV !== 'production' alone is insufficient — on Docker/Railway
 * deployments NODE_ENV may be unset or 'development' even in a live environment.
 * The second guard OTP_PEEK_ENABLED='true' requires an explicit opt-in that must NOT be set
 * in production. Both conditions must be true to enable this endpoint.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { getTestOtp } from '@/lib/notifications/esms';

export function GET(req: NextRequest): Response {
  // Dual guard: non-production NODE_ENV AND explicit opt-in env var required.
  // OTP_PEEK_ENABLED must NOT be set in production deployments.
  const peekEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.OTP_PEEK_ENABLED === 'true';
  if (!peekEnabled) {
    return new Response(null, { status: 404 });
  }

  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) {
    return NextResponse.json({ error: 'phone param required' }, { status: 400 });
  }

  const code = getTestOtp(phone);
  if (!code) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ code });
}
