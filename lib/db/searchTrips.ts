/**
 * Server-side trip search query.
 *
 * Shared between the RSC /search page and the API route handler.
 * Returns the same TripResult shape as the API response.
 *
 * AC-2: unaccent_immutable ILIKE for diacritic-insensitive search.
 * AC-3: excludes cancelled / salesClosed / maintenance-bus trips.
 * AC-13: select whitelist via searchResultSelect.
 *
 * Issue 002: When SEARCH_USE_BLOCKED_SEATS=true, available seats are computed as:
 *   capacity - blockedSeats - SUM(active hold ticketCounts)
 * Default is false until Steps 7+9 ship to production.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { searchResultSelect, toTripResult } from '@/lib/db/selects';
import { fromZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';

const TZ = 'Asia/Ho_Chi_Minh';

export interface TripSearchInput {
  origin: string;
  destination: string;
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh wall-clock time */
  date: string;
  ticketCount: number;
}

export interface TripResult {
  tripId: string;
  departureAt: string;
  price: number;
  availableSeats: number;
  operatorLegalName: string;
  routeOrigin: string;
  routeDestination: string;
}

export async function searchTrips(input: TripSearchInput): Promise<TripResult[]> {
  const { origin, destination, date, ticketCount } = input;
  const useBlockedSeats = process.env.SEARCH_USE_BLOCKED_SEATS === 'true';

  // Convert VN wall-clock date to UTC range
  const [year, month, day] = date.split('-').map(Number);
  const vnDate = new Date(year, month - 1, day);
  const startUtc = fromZonedTime(startOfDay(vnDate), TZ);
  const endUtc = fromZonedTime(endOfDay(vnDate), TZ);

  // Parameterized unaccent ILIKE fragments (AC-2, never string concat — AC-13)
  const normalizedOrigin = Prisma.sql`unaccent_immutable(lower(${origin}))`;
  const normalizedDest = Prisma.sql`unaccent_immutable(lower(${destination}))`;

  const matchingRouteIds = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "Route"
      WHERE unaccent_immutable(lower(origin)) ILIKE '%' || ${normalizedOrigin} || '%'
        AND unaccent_immutable(lower(destination)) ILIKE '%' || ${normalizedDest} || '%'
    `
  );

  if (matchingRouteIds.length === 0) return [];

  const routeIds = matchingRouteIds.map((r) => r.id);

  const trips = await prisma.trip.findMany({
    where: {
      routeId: { in: routeIds },
      departureAt: { gte: startUtc, lte: endUtc },
      status: 'scheduled',
      salesClosed: false,
      bus: {
        capacity: { gte: ticketCount },
        // AC-3: maintenance window must not overlap trip day [startUtc, endUtc]
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

  if (!useBlockedSeats) {
    return trips.map(toTripResult);
  }

  // When SEARCH_USE_BLOCKED_SEATS=true: compute available seats accounting for
  // blockedSeats (denormalised) and live active-hold sums, then filter by ticketCount.
  if (trips.length === 0) return [];

  const tripIds = trips.map((t) => t.id);

  // Aggregate active hold ticketCount sums per trip in one query
  type HoldSum = { tripId: string; heldSeats: bigint };
  const holdSums = await prisma.$queryRaw<HoldSum[]>(
    Prisma.sql`
      SELECT "tripId", SUM("ticketCount") AS "heldSeats"
      FROM "Hold"
      WHERE "tripId" = ANY(${tripIds}::text[])
        AND status = 'active'::"HoldStatus"
        AND "expiresAt" > NOW()
      GROUP BY "tripId"
    `
  );

  const holdSumMap = new Map<string, number>();
  for (const row of holdSums) {
    holdSumMap.set(row.tripId, Number(row.heldSeats));
  }

  // Fetch blockedSeats for all matched trips (not in select whitelist per AC-13)
  type BlockedRow = { id: string; blockedSeats: number };
  const blockedRows = await prisma.$queryRaw<BlockedRow[]>(
    Prisma.sql`
      SELECT id, "blockedSeats"
      FROM "Trip"
      WHERE id = ANY(${tripIds}::text[])
    `
  );
  const blockedMap = new Map<string, number>();
  for (const row of blockedRows) {
    blockedMap.set(row.id, row.blockedSeats);
  }

  const results: TripResult[] = [];
  for (const trip of trips) {
    const blocked = blockedMap.get(trip.id) ?? 0;
    const heldSeats = holdSumMap.get(trip.id) ?? 0;
    const available = trip.bus.capacity - blocked - heldSeats;
    if (available >= ticketCount) {
      results.push({
        tripId: trip.id,
        departureAt: trip.departureAt.toISOString(),
        price: trip.price,
        availableSeats: available,
        operatorLegalName: trip.bus.operator.legalName,
        routeOrigin: trip.route.origin,
        routeDestination: trip.route.destination,
      });
    }
  }

  return results;
}
