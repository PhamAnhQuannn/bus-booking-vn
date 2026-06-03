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
 * Availability is ALWAYS computed as:
 *   capacity - SUM(active hold ticketCounts) - SUM(paid/pending booking ticketCounts)
 * never raw capacity. (P1 fix 2026-06-01: the prior SEARCH_USE_BLOCKED_SEATS flag defaulted false
 * and shipped raw capacity in the default config — an oversell gap. Flag removed.)
 *
 * Issue 040: the blockedSeats term was removed from availability — the block-seats
 * feature is retired. The Trip.blockedSeats column is dropped in a later wave (Phase B);
 * until then it is simply not read here.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { searchResultSelect } from '@/lib/db/selects';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';
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
  operatorId: string;
  busType: 'coach' | 'sleeper' | 'limousine';
  durationMinutes: number;
  routeOrigin: string;
  routeDestination: string;
}

export async function searchTrips(input: TripSearchInput): Promise<TripResult[]> {
  const { origin, destination, date, ticketCount } = input;

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
        AND "deactivatedAt" IS NULL
        -- Issue 069: admin-disabled routes are hidden from search (moderate = disable).
        AND "moderatedAt" IS NULL
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
      // Issue 069: admin-disabled trips are hidden from search (moderate = disable).
      // The route-level gate above also excludes trips on an admin-disabled route.
      moderatedAt: null,
      // Issue 046: approval gate — only show trips of search-visible operators
      // (today exactly APPROVED). Set is derived from the Issue 045 capability
      // helper (SEARCH_VISIBLE_STATUSES) so there is no duplicated status literal.
      // disabledAt IS NULL kept belt-and-suspenders (status is canonical).
      operator: { status: { in: SEARCH_VISIBLE_STATUSES }, disabledAt: null },
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

  // Compute available seats accounting for live active-hold sums and paid/pending
  // booking sums, then filter by ticketCount.
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

  // Aggregate paid (or pending-cash) booking ticketCount sums per trip.
  // Mirrors holdRepo's capacity subtraction so search results never show seats
  // that are reserved by a booking but not by an active hold.
  type BookingSum = { tripId: string; bookedSeats: bigint };
  const bookingSums = await prisma.$queryRaw<BookingSum[]>(
    Prisma.sql`
      SELECT "tripId", SUM("ticketCount") AS "bookedSeats"
      FROM "Booking"
      WHERE "tripId" = ANY(${tripIds}::text[])
        AND status IN (
          'pending_cash_payment'::"BookingStatus",
          'paid'::"BookingStatus",
          'completed'::"BookingStatus"
        )
      GROUP BY "tripId"
    `
  );
  const bookingSumMap = new Map<string, number>();
  for (const row of bookingSums) {
    bookingSumMap.set(row.tripId, Number(row.bookedSeats));
  }

  const results: TripResult[] = [];
  for (const trip of trips) {
    const heldSeats = holdSumMap.get(trip.id) ?? 0;
    const bookedSeats = bookingSumMap.get(trip.id) ?? 0;
    const available = trip.bus.capacity - heldSeats - bookedSeats;
    if (available >= ticketCount) {
      results.push({
        tripId: trip.id,
        departureAt: trip.departureAt.toISOString(),
        price: trip.price,
        availableSeats: available,
        operatorLegalName: trip.bus.operator.legalName,
        operatorId: trip.bus.operatorId,
        busType: trip.bus.busType,
        durationMinutes: trip.route.durationMinutes,
        routeOrigin: trip.route.origin,
        routeDestination: trip.route.destination,
      });
    }
  }

  return results;
}
