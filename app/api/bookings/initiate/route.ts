/**
 * POST /api/bookings/initiate (cash path).
 *
 * Pipeline:
 *   1. Rate-limit by IP (429 + Retry-After)
 *   2. Parse + validate body — { holdId, paymentMethod: 'cash' } (400 INVALID)
 *   3. Verify bb_hold cookie matches body.holdId (403 FORBIDDEN)
 *   4. Delegate to initiateCashBooking orchestrator
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
import { initiateCashBooking } from '@/lib/booking/initiateBooking';
import { extractHoldCookie } from '@/lib/security/holdCookie';
import { ratelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';

const initiateInputSchema = z.object({
  holdId: z.string().min(1).max(128),
  paymentMethod: z.literal('cash'),
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
  const { holdId } = parsed.data;

  const verified = extractHoldCookie(req.headers.get('cookie'));
  if (!verified || verified.holdId !== holdId) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const proto =
    req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(/:$/, '');
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const baseUrl = `${proto}://${host}`;

  const result = await initiateCashBooking({ holdId, baseUrl });

  if (result.ok) {
    return NextResponse.json(
      { bookingId: result.bookingId, confirmationToken: result.confirmationToken },
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
    case 'ref_collision':
      return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 503 });
  }
}

export const POST = withErrorHandler(handler);
