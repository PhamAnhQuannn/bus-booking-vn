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
 * searchTrips() always subtracts blockedSeats + active holds + paid/pending bookings
 * from capacity (never raw capacity).
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
  const results = await searchTrips({ origin, destination, date, ticketCount });

  // Funnel: search_performed (fire-and-forget, never blocks the response)
  void track('search_performed', {
    sessionId: sessionIdFromRequest(request),
    context: { origin, destination, date, ticketCount, results: results.length },
  });

  return NextResponse.json(results, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET = withErrorHandler(handler);
