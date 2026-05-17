/**
 * Server-side trip search query.
 *
 * Shared between the RSC /search page and the API route handler.
 * Returns the same TripResult shape as the API response.
 *
 * AC-2: unaccent_immutable ILIKE for diacritic-insensitive search.
 * AC-3: excludes cancelled / salesClosed / maintenance-bus trips.
 * AC-13: select whitelist via searchResultSelect.
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

  return trips.map(toTripResult);
}
