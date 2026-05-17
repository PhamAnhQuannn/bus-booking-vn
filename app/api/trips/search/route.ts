/**
 * GET /api/trips/search
 *
 * Pipeline:
 * 1. Zod parse query params (400 on breach — AC-10)
 * 2. Rate-limit by x-forwarded-for IP (429 + Retry-After — AC-7)
 * 3. Prisma findMany with Prisma.sql unaccent_immutable ILIKE fragment (AC-1, AC-2)
 * 4. Filter: scheduled + not salesClosed + availableSeats >= ticketCount (AC-3)
 * 5. Return departureAt-ascending JSON, Cache-Control: no-store
 *
 * Wrapped in withErrorHandler — 500 scrubbed (AC-11)
 * Node runtime (NOT Edge) — required for pg driver
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { searchParamsSchema } from '@/lib/validation/search';
import { searchResultSelect, toTripResult } from '@/lib/db/selects';
import { ratelimit } from '@/lib/ratelimit';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { fromZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

const TZ = 'Asia/Ho_Chi_Minh';

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

  // ---- 3. Convert date (YYYY-MM-DD VN wall-clock) to UTC range ----
  // Parse the VN date string as a local date in Asia/Ho_Chi_Minh timezone
  const [year, month, day] = date.split('-').map(Number);
  const vnDate = new Date(year, month - 1, day); // local date object
  const startUtc = fromZonedTime(startOfDay(vnDate), TZ);
  const endUtc = fromZonedTime(endOfDay(vnDate), TZ);

  // ---- 4. Query with unaccent_immutable ILIKE for diacritic insensitivity (AC-2) ----
  // We use Prisma.sql parameterized template — never string concat (AC-13)
  const normalizedOrigin = Prisma.sql`unaccent_immutable(lower(${origin}))`;
  const normalizedDest = Prisma.sql`unaccent_immutable(lower(${destination}))`;

  // Raw SQL to find matching route IDs via trigram-insensitive search
  const matchingRouteIds = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "Route"
      WHERE unaccent_immutable(lower(origin)) ILIKE '%' || ${normalizedOrigin} || '%'
        AND unaccent_immutable(lower(destination)) ILIKE '%' || ${normalizedDest} || '%'
    `
  );

  if (matchingRouteIds.length === 0) {
    return NextResponse.json([], {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const routeIds = matchingRouteIds.map((r) => r.id);

  // ---- 5. Find trips matching the criteria ----
  const trips = await prisma.trip.findMany({
    where: {
      routeId: { in: routeIds },
      departureAt: {
        gte: startUtc,
        lte: endUtc,
      },
      status: 'scheduled',
      salesClosed: false,
      // availableSeats >= ticketCount: for Issue 001, bus.capacity is the proxy
      // (no Booking model yet — corrected in Issue 002)
      bus: {
        capacity: {
          gte: ticketCount,
        },
        // AC-3: exclude buses whose maintenance window overlaps the trip day [startUtc, endUtc].
        // Include iff maintenance is unset, ended before window, or starts after window.
        OR: [
          { maintenanceStart: null },
          { maintenanceEnd: { lt: startUtc } },
          { maintenanceStart: { gt: endUtc } },
        ],
      },
    },
    select: searchResultSelect,
    orderBy: { departureAt: 'asc' },
  });

  const results = trips.map(toTripResult);

  return NextResponse.json(results, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const GET = withErrorHandler(handler);
