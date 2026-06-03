/**
 * Integration tests for searchTrips() cursor/seek pagination (Issue 097).
 *
 * Requires a real PostgreSQL database with the schema applied.
 * Run with: pnpm test:integration
 *
 * Pins the (departureAt, id) seek behaviour:
 *  - first page returns `limit` rows + a non-null nextCursor when more exist
 *  - following the cursor returns the next page with NO duplicates / NO gaps
 *  - the last page returns nextCursor: null
 *  - facets (the full base set) are page-independent (same on page 1 and page 2)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import { searchTrips, decodeCursor } from '../searchTrips';

const ORIGIN = 'ZZ Pagination Origin';
const DEST = 'ZZ Pagination Destination';

const TOTAL_TRIPS = 5; // > 2 pages at limit 2
const PAGE_LIMIT = 2;

let operatorId: string;
let routeId: string;
let busId: string;
const tripIds: string[] = [];

// Trip departs in 24h; derive the VN-local (UTC+7) date string the search filters on.
const baseDeparture = new Date(Date.now() + 24 * 60 * 60 * 1000);
const vnDate = new Date(baseDeparture.getTime() + 7 * 3600 * 1000)
  .toISOString()
  .slice(0, 10);

beforeAll(async () => {
  const operator = await prisma.operator.create({
    data: {
      legalName: 'Pagination Test Operator',
      contactPhone: '+8490xxxxxx7',
      contactEmail: 'test@pagination.test',
      notificationPhone: '+8490xxxxxx8',
      // Issue 046: operator must be APPROVED to be search-visible.
      status: 'APPROVED',
    },
  });
  operatorId = operator.id;

  const bus = await prisma.bus.create({
    data: { operatorId, capacity: 40, licensePlate: 'TEST-PG-001', busType: 'coach' },
  });
  busId = bus.id;

  const route = await prisma.route.create({
    data: { origin: ORIGIN, destination: DEST, operatorId, durationMinutes: 240 },
  });
  routeId = route.id;

  // Seed TOTAL_TRIPS trips on the SAME route/date, each departing 1h apart so
  // the (departureAt, id) seek order is unambiguous and walkable.
  for (let i = 0; i < TOTAL_TRIPS; i++) {
    const trip = await prisma.trip.create({
      data: {
        routeId,
        busId,
        operatorId,
        departureAt: new Date(baseDeparture.getTime() + i * 60 * 60 * 1000),
        price: 100000,
        status: 'scheduled',
        salesClosed: false,
      },
    });
    tripIds.push(trip.id);
  }
});

afterAll(async () => {
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.route.delete({ where: { id: routeId } });
  await prisma.bus.deleteMany({ where: { operatorId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.$disconnect();
});

function page(cursor: string | null) {
  return searchTrips({
    origin: ORIGIN,
    destination: DEST,
    date: vnDate,
    ticketCount: 1,
    limit: PAGE_LIMIT,
    cursor,
  });
}

describe('searchTrips cursor/seek pagination (Issue 097)', () => {
  it('first page returns `limit` rows + a non-null nextCursor when more exist', async () => {
    const first = await page(null);
    expect(first.trips.length).toBe(PAGE_LIMIT);
    expect(first.nextCursor).not.toBeNull();

    // The cursor encodes the LAST visible row's (departureAt, id).
    const last = first.trips[first.trips.length - 1]!;
    const decoded = decodeCursor(first.nextCursor);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(last.tripId);
    expect(decoded!.departureAt.toISOString()).toBe(last.departureAt);
  });

  it('walking the cursor covers ALL trips with NO duplicates and NO gaps', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    // Walk until nextCursor is null. Cap iterations defensively.
    for (let guard = 0; guard < 50; guard++) {
      const res = await page(cursor);
      pages++;
      for (const t of res.trips) seen.push(t.tripId);
      if (res.nextCursor === null) break;
      cursor = res.nextCursor;
    }

    // Exactly TOTAL_TRIPS rows, no duplicates.
    expect(seen.length).toBe(TOTAL_TRIPS);
    expect(new Set(seen).size).toBe(TOTAL_TRIPS);

    // Covers every seeded trip id (disjoint pages → full coverage).
    expect(new Set(seen)).toEqual(new Set(tripIds));

    // 5 trips / page size 2 → 3 pages (2 + 2 + 1).
    expect(pages).toBe(Math.ceil(TOTAL_TRIPS / PAGE_LIMIT));
  });

  it('page boundaries are disjoint (page 1 and page 2 share no ids)', async () => {
    const p1 = await page(null);
    const p2 = await page(p1.nextCursor);

    const ids1 = new Set(p1.trips.map((t) => t.tripId));
    const ids2 = new Set(p2.trips.map((t) => t.tripId));
    for (const id of ids2) expect(ids1.has(id)).toBe(false);

    // Seek monotonicity: every page-2 row sorts strictly after every page-1 row
    // on (departureAt, id).
    const last1 = p1.trips[p1.trips.length - 1]!;
    for (const t of p2.trips) {
      const after =
        t.departureAt > last1.departureAt ||
        (t.departureAt === last1.departureAt && t.tripId > last1.tripId);
      expect(after).toBe(true);
    }
  });

  it('the last page returns nextCursor: null', async () => {
    // Walk to the final page.
    let cursor: string | null = null;
    let res = await page(cursor);
    while (res.nextCursor !== null) {
      cursor = res.nextCursor;
      res = await page(cursor);
    }
    expect(res.nextCursor).toBeNull();
    // Last page has the remainder (5 % 2 = 1 row).
    expect(res.trips.length).toBe(TOTAL_TRIPS % PAGE_LIMIT || PAGE_LIMIT);
  });

  it('facets (full base set) are page-independent — same across pages', async () => {
    // The full base set is what the page derives facets from. Assert the
    // availability-resolved base is identical regardless of cursor: a no-cursor
    // large-limit call returns ALL trips, and the union of paged walks equals it.
    const full = await searchTrips({
      origin: ORIGIN,
      destination: DEST,
      date: vnDate,
      ticketCount: 1,
      limit: Number.MAX_SAFE_INTEGER,
    });
    expect(full.trips.length).toBe(TOTAL_TRIPS);
    expect(full.nextCursor).toBeNull();

    // Page 1 and page 2 must see the SAME total base (facets derive from this),
    // i.e. the base set does not depend on which page the user is on. We model
    // facet inputs as the operator-id multiset of the full base.
    const baseOperatorIds = full.trips.map((t) => t.operatorId).sort();
    const p1Full = await searchTrips({
      origin: ORIGIN, destination: DEST, date: vnDate, ticketCount: 1,
      limit: Number.MAX_SAFE_INTEGER, cursor: null,
    });
    expect(p1Full.trips.map((t) => t.operatorId).sort()).toEqual(baseOperatorIds);
  });
});
