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
import { holdInputSchema } from '@/lib/core/validation/hold';
import { createHold } from '@/lib/core/db/holdRepo';
import { validatePickupSelection } from '@/lib/booking';
import { HoldCapExceededError } from '@/lib/core/db/holdErrors';
import { buildSetCookieHeader } from '@/lib/security';
import { ratelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getOrCreateRequestId, loggerForRequest } from '@/lib/observability';
import { track, sessionIdFromRequest } from '@/lib/analytics';

async function handler(req: NextRequest): Promise<Response> {
  const logger = loggerForRequest(getOrCreateRequestId(req.headers));

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

  const { tripId, ticketCount, buyerName, buyerPhone, buyerEmail, pickupKind, pickupDetail } =
    parsed.data;

  // ---- 2b. Resolve + validate pickup (Issue 107/111) ----
  // The client-supplied pickupKind selects the branch; the resulting fields are always
  // SERVER-validated (custom detail length). Anything not 'custom' falls through to station.
  // NB: customPickupRequested is NOT tracked here — createHold (lib/core/db/holdRepo)
  // derives it authoritatively in SQL as (pickupKind = 'custom'), the single source of truth.
  let pickup: {
    pickupKind: 'station' | 'custom';
    pickupDetail: string | null;
  } = {
    pickupKind: 'station',
    pickupDetail: null,
  };

  if (pickupKind === 'custom') {
    const check = validatePickupSelection({ kind: 'custom', detail: pickupDetail });
    if (!check.ok) {
      return NextResponse.json({ error: check.code }, { status: 422 });
    }
    pickup = {
      pickupKind: 'custom',
      pickupDetail: check.pickupDetail,
    };
  }

  // ---- 3. Atomic hold insert ----
  let result: Awaited<ReturnType<typeof createHold>>;
  try {
    result = await createHold({
      tripId,
      ticketCount,
      customerPhone: buyerPhone,
      customerName: buyerName,
      customerEmail: buyerEmail,
      pickupKind: pickup.pickupKind,
      pickupDetail: pickup.pickupDetail,
    });
  } catch (e) {
    if (e instanceof HoldCapExceededError) {
      logger.warn({ tripId }, 'Hold cap exceeded for phone');
      return NextResponse.json({ error: 'HOLD_CAP_EXCEEDED' }, { status: 429 });
    }
    throw e;
  }

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
