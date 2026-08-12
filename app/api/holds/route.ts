/**
 * POST /api/holds
 *
 * Creates a seat hold for a trip. Pipeline:
 * 1. Rate-limit — session-keyed when bb_sid is present, tighter IP-keyed when it is not (#359)
 * 2. Parse + validate JSON body with holdInputSchema (400 on breach)
 * 3. Atomic createHold() — advisory-lock + conditional INSERT (409 SOLD_OUT if no seats),
 *    enforcing the per-session seat cap and the per-phone hold cap
 * 4. Set bb_hold HttpOnly cookie (HMAC-signed)
 * 5. Return 200 { holdId, expiresAt }
 *
 * Response bodies never echo raw input (leak risk per AGENTS.md rule 4).
 * Wrapped in withErrorHandler — 500 scrubbed.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { holdInputSchema } from '@/lib/core/validation/hold';
import { createHold, HOLD_TTL_MINUTES } from '@/lib/core/db/holdRepo';
import { prisma } from '@/lib/core/db/client';
import { parseBoardingSchedule } from '@/lib/trips';
import { validatePickupSelection } from '@/lib/booking';
import {
  HoldCapExceededError,
  SessionSeatCapExceededError,
  SeatMapBusyError,
  RequestInFlightError,
  SESSION_SEAT_CAP,
} from '@/lib/core/db/holdErrors';

/**
 * Seconds to advertise on a contended seat map. Deliberately short and deliberately
 * NOT HOLD_TTL_MINUTES: contention clears when the competing transaction commits.
 * This is an estimate, not a tuned value — revisit after a real load test (#362).
 */
const SEAT_MAP_BUSY_RETRY_AFTER_SECONDS = '2';
import { buildSetCookieHeader } from '@/lib/security';
import { holdsRatelimit, holdsAnonRatelimit } from '@/lib/ratelimit';
import { clientIp } from '@/lib/core/http/clientIp';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { getOrCreateRequestId, loggerForRequest } from '@/lib/observability';
import { track, sessionIdFromRequest } from '@/lib/analytics';

async function handler(req: NextRequest): Promise<Response> {
  const logger = loggerForRequest(getOrCreateRequestId(req.headers));

  // ---- 1. Rate limit — session-keyed when we have a session, IP-keyed when we don't ----
  // The generic 60/min/IP edge limit is irrelevant to seat squatting: the phone cap allows
  // 5 holds × 10 seats = 50 seats, so a whole 45-seat trip locks in FIVE requests. This
  // limiter is about the rate; the seat cap in createHold is about the ceiling (#359).
  const ip = clientIp(req.headers);
  const sessionId = sessionIdFromRequest(req);

  const rl = sessionId
    ? await holdsRatelimit.limit(`hold:${sessionId}`)
    : await holdsAnonRatelimit.limit(`hold-anon:${ip}`);
  if (!rl.allowed) {
    logger.warn(
      { keyed: sessionId ? 'session' : 'anon-ip', retryAfter: rl.retryAfter },
      'hold.denied.rate_limited'
    );
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

  const {
    tripId,
    ticketCount,
    buyerName,
    buyerPhone,
    buyerEmail,
    pickupKind,
    pickupDetail,
    boardingPoint,
  } = parsed.data;

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

  // ---- 2c. Validate the chosen boarding point against the route schedule ----
  // The point comes from the results card; a mismatch means a stale or tampered
  // value. Drop it to null (never 422) so a legitimate booking never fails when a
  // schedule was edited — but garbage never lands on the Hold/Booking row. The
  // stored time is the schedule's authoritative time, not the client's.
  let boarding: { point: string; time: string | null } | null = null;
  if (boardingPoint) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { route: { select: { boardingSchedule: true } } },
    });
    const match = parseBoardingSchedule(trip?.route.boardingSchedule).find(
      (s) => s.point === boardingPoint,
    );
    if (match) {
      boarding = { point: match.point, time: match.time };
    } else {
      logger.warn({ tripId, boardingPoint }, 'hold.boarding_point_mismatch — dropped');
    }
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
      boardingPoint: boarding?.point ?? null,
      boardingTime: boarding?.time ?? null,
      sessionId,
    });
  } catch (e) {
    // Both caps carry Retry-After. Without it the client falls back to a fabricated 60s
    // (lib/api/holdsClient.ts) and cannot tell a cap from a throttle. A cap clears when the
    // caller's own holds expire, so HOLD_TTL_MINUTES is the honest wait — not a guess.
    const capRetryAfter = String(HOLD_TTL_MINUTES * 60);

    if (e instanceof SessionSeatCapExceededError) {
      logger.warn(
        { tripId, ticketCount, cap: SESSION_SEAT_CAP },
        'hold.denied.session_seat_cap — session already holds its seat allowance'
      );
      return NextResponse.json(
        { error: 'SESSION_SEAT_CAP_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': capRetryAfter } }
      );
    }
    if (e instanceof HoldCapExceededError) {
      logger.warn({ tripId }, 'hold.denied.phone_hold_cap');
      return NextResponse.json(
        { error: 'HOLD_CAP_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': capRetryAfter } }
      );
    }
    // Contention, NOT a cap — and the Retry-After reflects that. Seconds, not the
    // hold TTL: the seat map frees as soon as the competing transaction commits,
    // whereas a cap only frees when this caller's own holds expire (#362).
    if (e instanceof SeatMapBusyError) {
      logger.warn({ tripId, ticketCount }, 'hold.denied.seat_map_busy — trip lock contended');
      return NextResponse.json(
        { error: 'SEAT_MAP_BUSY' },
        { status: 429, headers: { 'Retry-After': SEAT_MAP_BUSY_RETRY_AFTER_SECONDS } }
      );
    }
    // Same 429 shape, deliberately DIFFERENT code: the caller is contending with their
    // own in-flight request (double-click, second tab), not with other buyers. Reporting
    // "many people are booking this trip" to a solo user would be false — the exact
    // class of lie the caps-vs-busy split already exists to prevent.
    if (e instanceof RequestInFlightError) {
      logger.info({ tripId, ticketCount }, 'hold.denied.request_in_flight — self-contention');
      return NextResponse.json(
        { error: 'REQUEST_IN_FLIGHT' },
        { status: 429, headers: { 'Retry-After': SEAT_MAP_BUSY_RETRY_AFTER_SECONDS } }
      );
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
    sessionId,
    tripId,
    context: { holdId, ticketCount },
  });

  // ---- 4. Set bb_hold cookie ----
  const setCookieHeader = buildSetCookieHeader(holdId, expiresAtISO);

  // ---- 5. Return 200 ----
  // Echo the SERVER-resolved boarding point (null if the chosen one was dropped as
  // stale/mismatched) so the client can tell the traveler their pickup wasn't kept.
  return new Response(
    JSON.stringify({
      holdId,
      expiresAt: expiresAtISO,
      boardingPoint: boarding?.point ?? null,
      boardingTime: boarding?.time ?? null,
    }),
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
