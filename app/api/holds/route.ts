/**
 * POST /api/holds
 *
 * Creates a seat hold for a trip. Pipeline:
 * 1. Rate-limit by IP (429 + Retry-After on breach)
 * 2. Parse + validate JSON body with holdInputSchema (400 on breach)
 * 3. Atomic createHold() — advisory-lock + conditional INSERT (409 SOLD_OUT if no seats)
 * 4. Set bb_hold HttpOnly cookie (HMAC-signed)
 * 5. Return 200 { holdId, expiresAt }
 *
 * Response bodies never echo raw input (leak risk per AGENTS.md rule 4).
 * Wrapped in withErrorHandler — 500 scrubbed.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { holdInputSchema } from '@/lib/validation/hold';
import { createHold } from '@/lib/db/holdRepo';
import { buildSetCookieHeader } from '@/lib/security/holdCookie';
import { ratelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';
import { track, sessionIdFromRequest } from '@/lib/analytics/track';

async function handler(req: NextRequest): Promise<Response> {
  // ---- 1. Rate limit by IP ----
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  const rl = await ratelimit.limit(ip);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: 'TOO_MANY_REQUESTS' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfter),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // ---- 2. Parse and validate body ----
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = holdInputSchema.safeParse(body);
  if (!parsed.success) {
    // Never echo raw input — return generic INVALID (no field details to avoid enumeration)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const { tripId, ticketCount, buyerName, buyerPhone, buyerEmail } = parsed.data;

  // ---- 3. Atomic hold insert ----
  const result = await createHold({
    tripId,
    ticketCount,
    customerPhone: buyerPhone,
    customerName: buyerName,
    customerEmail: buyerEmail,
  });

  if (!result) {
    logger.info({ tripId, ticketCount }, 'Hold creation failed: sold out or trip unavailable');
    return NextResponse.json({ error: 'SOLD_OUT' }, { status: 409 });
  }

  const { holdId, expiresAt } = result;
  const expiresAtISO = expiresAt.toISOString();

  logger.info({ holdId, tripId, ticketCount }, 'Hold created');

  // Funnel: hold_created (fire-and-forget)
  void track('hold_created', {
    sessionId: sessionIdFromRequest(req),
    tripId,
    context: { holdId, ticketCount },
  });

  // ---- 4. Set bb_hold cookie ----
  const setCookieHeader = buildSetCookieHeader(holdId, expiresAtISO);

  // ---- 5. Return 200 ----
  return new Response(
    JSON.stringify({ holdId, expiresAt: expiresAtISO }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': setCookieHeader,
      },
    }
  );
}

export const POST = withErrorHandler(handler);
