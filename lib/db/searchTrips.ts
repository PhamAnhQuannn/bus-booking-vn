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
 *
 * Issue 097 — cursor/seek pagination on results.
 *
 * DESIGN — facets-vs-pagination tension (the AC requires BOTH "facets from the
 * unfiltered base set" AND "no N+1 — one base query per page"):
 *
 *   availableSeats is NOT a SQL column — it is `capacity - SUM(active holds) -
 *   SUM(paid/pending bookings)`, computed in-memory after the trip query from two
 *   bounded aggregate queries (GROUP BY tripId). A trip can therefore be dropped
 *   AFTER the row query returns (remaining seats < ticketCount). That makes a
 *   DB-level `take = limit + 1` UNSAFE: any availability-excluded row inside the
 *   page window would silently shrink the page below `limit` and corrupt the seek
 *   (the next cursor would skip the trips that "should" have filled the page).
 *
 *   Resolution: the base load (matching, scheduled, bookable, ticketCount-fitting
 *   trips ordered by the stable seek key) is the ONE allowed bounded full scan —
 *   it backs BOTH the page AND the facets, page-independently. We then apply the
 *   compound seek predicate `(departureAt, id) > (cursorDeparture, cursorId)` and
 *   `take = limit + 1` IN-MEMORY over that availability-resolved, stably-ordered
 *   list. "One base query per page / no N+1" is satisfied: a fixed 3 queries total
 *   (route-id lookup + trip rows + hold-sum + booking-sum = bounded, NOT per-row).
 *   No per-trip query is ever issued.
 *
 *   The page rows come from searchTrips({ ..., cursor, limit }); facets are derived
 *   by the caller from searchTrips({ ... }) WITHOUT cursor/limit (the full base set)
 *   via applyTripFilters — so facets reflect ALL matching trips, not the page.
 *
 * Seek key: `(departureAt ASC, id ASC)` — departureAt alone is not unique (two
 * trips can depart at the same instant), so id is the deterministic tiebreaker.
 * Cursor encoding: opaque `${departureAtISO}_${id}` (see encode/decodeCursor).
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { searchResultSelect } from '@/lib/db/selects';
import { SEARCH_VISIBLE_STATUSES } from '@/lib/onboarding';
import { fromZonedTime } from 'date-fns-tz';
import { startOfDay, endOfDay } from 'date-fns';
import { encodeCursor, decodeCursor } from '@/lib/db/searchCursor';
export { encodeCursor, decodeCursor } from '@/lib/db/searchCursor';

const TZ = 'Asia/Ho_Chi_Minh';

/** Default page size for customer search results (Issue 097). */
export const SEARCH_PAGE_LIMIT = 20;

export interface TripSearchInput {
  origin: string;
  destination: string;
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh wall-clock time */
  date: string;
  ticketCount: number;
  /**
   * Max result rows to return for this page (Issue 097). Defaults to
   * SEARCH_PAGE_LIMIT. Omit (or pass with cursor) when you want a page; when
   * deriving facets, call WITHOUT cursor — facets must reflect the full base set.
   */
  limit?: number;
  /**
   * Opaque seek cursor from a previous page's `nextCursor` (Issue 097). When
   * present, only rows strictly after `(departureAt, id)` of the cursor are
   * returned. `null`/`undefined` → first page.
   */
  cursor?: string | null;
}

/**
 * Paginated search result (Issue 097). `trips` is at most `limit` rows in stable
 * `(departureAt, id)` order. `nextCursor` is an opaque string to pass back as
 * `cursor` for the next page, or `null` when this is the last page.
 */
export interface TripSearchPage {
  trips: TripResult[];
  nextCursor: string | null;
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

/**
 * Search trips for a route/date, paginated by a stable `(departureAt, id)` seek
 * cursor (Issue 097). Returns at most `limit` rows + a `nextCursor`.
 *
 * Call WITHOUT `cursor`/`limit` (or with a large `limit`) to materialise the full
 * base set for facet derivation — pagination of the rendered page is then applied
 * by the caller, but facets stay page-independent (see module DESIGN note).
 */
export async function searchTrips(input: TripSearchInput): Promise<TripSearchPage> {
  const { origin, destination, date, ticketCount } = input;
  const limit = input.limit ?? SEARCH_PAGE_LIMIT;
  const seek = decodeCursor(input.cursor);

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

  if (matchingRouteIds.length === 0) return { trips: [], nextCursor: null };

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
    // Stable seek order (Issue 097): departureAt is not unique, so id is the
    // deterministic tiebreaker. This SAME order backs both the page slice and
    // the facet base set, guaranteeing no-dup/no-gap paging.
    orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
  });

  // Compute available seats accounting for live active-hold sums and paid/pending
  // booking sums, then filter by ticketCount.
  if (trips.length === 0) return { trips: [], nextCursor: null };

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

  // Availability-resolved base set, still in stable (departureAt, id) order
  // (the DB orderBy is preserved by this in-order loop). This list backs BOTH
  // the page (after the seek slice below) and the caller's facet derivation when
  // called without a cursor — see module DESIGN note.
  const ordered: TripResult[] = [];
  for (const trip of trips) {
    const heldSeats = holdSumMap.get(trip.id) ?? 0;
    const bookedSeats = bookingSumMap.get(trip.id) ?? 0;
    const available = trip.bus.capacity - heldSeats - bookedSeats;
    if (available >= ticketCount) {
      ordered.push({
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

  // Compound seek (Issue 097): keep only rows strictly AFTER the cursor's
  // (departureAt, id). Compare on the same ISO/id keys we encode the cursor from.
  let afterCursor = ordered;
  if (seek) {
    const cursorMs = seek.departureAt.getTime();
    afterCursor = ordered.filter((t) => {
      const tMs = new Date(t.departureAt).getTime();
      if (tMs !== cursorMs) return tMs > cursorMs;
      return t.tripId > seek.id; // tie on instant → break by id
    });
  }

  // take = limit + 1: peek one extra row to decide if there's a next page, then
  // pop it. nextCursor encodes the LAST VISIBLE row's seek key (listOperatorBookings
  // convention).
  const hasMore = afterCursor.length > limit;
  const pageTrips = hasMore ? afterCursor.slice(0, limit) : afterCursor;
  const last = pageTrips[pageTrips.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.departureAt, last.tripId) : null;

  return { trips: pageTrips, nextCursor };
}
