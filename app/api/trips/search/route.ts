/**
 * GET /api/trips/search
 *
 * Pipeline:
 * 1. Zod parse query params (400 on breach — AC-10)
 * 2. Rate-limit by x-forwarded-for IP (429 + Retry-After — AC-7)
 * 3. Delegate to searchTrips() (diacritic-insensitive, maintenance-aware, hold-aware)
 * 4. Return departureAt-ascending JSON, Cache-Control: no-store
 *
 * Wrapped in withErrorHandler — 500 scrubbed (AC-11)
 * Node runtime (NOT Edge) — required for pg driver
 *
 * searchTrips() always subtracts active holds + paid/pending bookings
 * from capacity (never raw capacity). (Issue 040 removed the blockedSeats term.)
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { searchParamsSchema } from '@/lib/validation/search';
import { searchTrips } from '@/lib/db/searchTrips';
import { ratelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { track, sessionIdFromRequest } from '@/lib/analytics/track';

async function handler(request: NextRequest): Promise<Response> {
  // ---- 1. Parse and validate query params ----
  const { searchParams } = new URL(request.url);
  const raw = {
    origin: searchParams.get('origin') ?? '',
    destination: searchParams.get('destination') ?? '',
    date: searchParams.get('date') ?? '',
    ticketCount: searchParams.get('ticketCount') ?? '',
  };

  const parsed = searchParamsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (key) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ errors: fieldErrors }, { status: 400 });
  }

  const { origin, destination, date, ticketCount } = parsed.data;

  // Issue 097: optional opaque seek cursor for the next page. Absent → first page.
  const cursor = searchParams.get('cursor');

  // ---- 2. Rate limit by IP ----
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  const rl = await ratelimit.limit(ip);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rl.retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    });
  }

  // ---- 3. Search trips (always holds-aware; availability never raw capacity) ----
  // Issue 097: returns one seek-paginated page. The JSON body stays a plain
  // TripResult[] (unchanged contract); the next-page cursor rides an X-Next-Cursor
  // header so existing array-shape consumers keep working.
  const { trips, nextCursor } = await searchTrips({ origin, destination, date, ticketCount, cursor });

  // Funnel: search_performed (fire-and-forget, never blocks the response)
  void track('search_performed', {
    sessionId: sessionIdFromRequest(request),
    context: { origin, destination, date, ticketCount, results: trips.length },
  });

  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (nextCursor) headers['X-Next-Cursor'] = nextCursor;

  return NextResponse.json(trips, { status: 200, headers });
}

export const GET = withErrorHandler(handler);
