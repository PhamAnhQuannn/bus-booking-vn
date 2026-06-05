/**
 * POST /api/bookings/initiate — online (momo | zalopay | card) initiation.
 *
 * Online-only (Issue 039): the cash / pay-on-board rail was removed. A
 * `paymentMethod: 'cash'` body is now rejected at the zod-enum layer (400 INVALID).
 *
 * Pipeline:
 *   1. Rate-limit by IP (429 + Retry-After)
 *   2. Parse + validate body — { holdId, paymentMethod: 'momo'|'zalopay'|'card' } (400 INVALID)
 *   3. Verify bb_hold cookie matches body.holdId (403 FORBIDDEN)
 *   4. initiateOnlineBooking(method) → { bookingId, payUrl }
 *   5. Map orchestrator result to HTTP status
 *
 * baseUrl derived from incoming request headers (x-forwarded-proto + host) —
 * never from env fallback (per AGENTS.md mistake log).
 *
 * Wrapped in withErrorHandler — 500 scrubbed on unexpected throw.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initiateOnlineBooking } from '@/lib/booking';
import { CONSENT_VERSION } from '@/lib/booking';
import { extractHoldCookie } from '@/lib/security';
import { getCustomerOptional } from '@/lib/auth';
import { ratelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { track, sessionIdFromRequest } from '@/lib/analytics';

const initiateInputSchema = z.object({
  holdId: z.string().min(1).max(128),
  paymentMethod: z.enum(['momo', 'zalopay', 'card']),
  // Issue 089: checkout consent block. Shape-validated here; the value gate
  // (both true + matching version) is enforced below so the failure surfaces as
  // 422 consent_required, not a generic 400 INVALID.
  consents: z.object({
    noRefund: z.boolean(),
    piiStorage: z.boolean(),
    version: z.string().min(1).max(32),
  }),
});

async function handler(req: NextRequest): Promise<Response> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rl = await ratelimit.limit(ip);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
      },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  const parsed = initiateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  const { holdId, paymentMethod, consents } = parsed.data;

  // Issue 089 consent gate (AC1/AC5): block initiate until BOTH consents are
  // accepted AND the client echoed the current consent text version. A stale
  // client showing old copy is rejected so we never record consent against text
  // the buyer didn't actually see.
  if (
    consents.noRefund !== true ||
    consents.piiStorage !== true ||
    consents.version !== CONSENT_VERSION
  ) {
    return NextResponse.json({ error: 'consent_required' }, { status: 422 });
  }

  const verified = extractHoldCookie(req.headers.get('cookie'));
  if (!verified || verified.holdId !== holdId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // Optional auth: a signed-in buyer stamps Booking.customerId at creation
  // (Issue 031). Guests stay null and link later only via OTP-proven register
  // backfill — never via the spoofable phone-match attach.
  const customerId = await getCustomerOptional(req);

  const proto =
    req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(/:$/, '');
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const baseUrl = `${proto}://${host}`;

  // ---------------------------------------------------------------------------
  // Online path (momo | zalopay | card) — stub gateway locally, real in Phase 2
  // ---------------------------------------------------------------------------
  const result = await initiateOnlineBooking({
    holdId,
    baseUrl,
    method: paymentMethod,
    customerId,
    consentVersion: consents.version,
  });

  if (result.ok) {
    void track('payment_initiated', {
      sessionId: sessionIdFromRequest(req),
      bookingId: result.bookingId,
      context: { paymentMethod },
    });
    return NextResponse.json(
      { bookingId: result.bookingId, payUrl: result.payUrl },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  switch (result.error) {
    case 'hold_not_found':
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    case 'hold_expired':
      return NextResponse.json({ error: 'HOLD_EXPIRED' }, { status: 409 });
    case 'trip_departed':
      return NextResponse.json({ error: 'TRIP_DEPARTED' }, { status: 409 });
    case 'operator_not_bookable':
      // Issue 046: operator suspended/rejected/unapproved between search and
      // initiate. 409 Conflict — the trip's bookability changed under the buyer
      // (same race-state family as TRIP_DEPARTED / HOLD_EXPIRED above).
      return NextResponse.json({ error: 'OPERATOR_NOT_BOOKABLE' }, { status: 409 });
    case 'ref_collision':
      return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
    case 'gateway_error':
      return NextResponse.json({ error: 'GATEWAY_ERROR' }, { status: 502 });
  }
}

export const POST = withErrorHandler(handler);
