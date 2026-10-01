/**
 * Integration tests for the Asia/Ho_Chi_Minh (UTC+7) midnight-rollover boundary
 * on customer trip search (GitHub issue #777).
 *
 * Business dates are VN-local. Trip.departureAt is stored in UTC, and searchTrips
 * turns the requested VN date into a UTC window via fromZonedTime(startOfDay/endOfDay,
 * 'Asia/Ho_Chi_Minh'). The bug class this suite guards against is a UTC-vs-local
 * collision at the 23:59 -> 00:00 VN boundary: a departure whose UTC calendar date
 * differs from its VN calendar date must be bucketed by its VN date, not its UTC date.
 *
 * The two boundary instants exercised (their UTC date differs from, or sits at the
 * edge of, their VN date):
 *   - 00:00:00.000 VN = 17:00 UTC on the PREVIOUS calendar day. A UTC-day filter would
 *     wrongly place it on the previous day; the VN-day window must keep it on its VN date
 *     (inclusive lower edge).
 *   - 23:59:59.999 VN = 16:59:59.999 UTC same day, the last millisecond of the VN day. It
 *     must stay on its VN date and never leak into the next VN date's window (inclusive
 *     upper edge).
 *
 * "Now" is NOT frozen: searchTrips floors its window lower bound at the current instant
 * (an already-departed same-day trip is unbookable), and it reads `new Date()` internally
 * with no injectable clock. The fixtures are seeded ~30 days in the future so that floor
 * is always a no-op, isolating the VN-day WINDOW math (the thing under test) from wall time.
 * Test dates are derived through the canonical VN-local helper (vnLocalDate), never via
 * `.toISOString().slice(0, 10)` — see lesson 2026-05-19-servicedate-utc-vs-local-test.
 *
 * Run with: pnpm vitest:int
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/core/db/client';
import { searchTrips } from '../searchTrips';
import { makeOperator, makeBus, makeRoute, makeTrip, vnLocalDate } from '@/test/helpers';

const DAY_MS = 86_400_000;

// A per-run suffix makes the route origin/destination unique, so the search matches
// ONLY this suite's trips — deterministic regardless of seed data or rows leaked by a
// prior crashed run (whose suffix differs and therefore never matches this search).
const RUN = randomUUID().slice(0, 8);
const ORIGIN = `TzBoundaryOrigin${RUN}`;
const DEST = `TzBoundaryDest${RUN}`;

// Base instant ~30 days out so searchTrips' now-floor never trims the window.
const BASE = Date.now() + 30 * DAY_MS;
const D = vnLocalDate(BASE); // the VN service date under test
const D_PREV = vnLocalDate(BASE - DAY_MS); // previous VN date (adjacent UTC day)
const D_NEXT = vnLocalDate(BASE + DAY_MS); // next VN date

// Boundary departure instants, expressed with the +07:00 offset the filter uses.
//   early: VN D 00:00:00.000  = UTC (D-1) 17:00  -> UTC date is the PREVIOUS day
//   late:  VN D 23:59:59.999  = UTC D 16:59:59.999 -> last millisecond of the VN day
const EARLY_DEPARTURE = new Date(`${D}T00:00:00.000+07:00`);
const LATE_DEPARTURE = new Date(`${D}T23:59:59.999+07:00`);

let operatorId: string;
let routeId: string;
let busId: string;
let earlyTripId: string;
let lateTripId: string;

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: makeOperator({
      legalName: `Tz Boundary Op ${RUN}`,
      contactPhone: '+8490xxxxxx1',
      contactEmail: `tzb-${RUN}@test.invalid`,
      notificationPhone: '+8490xxxxxx2',
      // Issue 046: only APPROVED operators are search-visible.
      status: 'APPROVED',
    }),
  });
  operatorId = op.id;

  const route = await prisma.route.create({
    data: makeRoute({ origin: ORIGIN, destination: DEST, operatorId, durationMinutes: 180 }),
  });
  routeId = route.id;

  const bus = await prisma.bus.create({
    data: makeBus({ operatorId, capacity: 30, licensePlate: `TZB-${RUN}` }),
  });
  busId = bus.id;

  const early = await prisma.trip.create({
    data: makeTrip({ routeId, busId, operatorId, departureAt: EARLY_DEPARTURE, price: 100_000 }),
  });
  earlyTripId = early.id;

  const late = await prisma.trip.create({
    data: makeTrip({ routeId, busId, operatorId, departureAt: LATE_DEPARTURE, price: 100_000 }),
  });
  lateTripId = late.id;
});

afterAll(async () => {
  // Guard: if beforeAll threw before operatorId was assigned, Prisma would drop the
  // undefined filter and delete ALL rows.
  if (operatorId) {
    await prisma.trip.deleteMany({ where: { operatorId } });
    await prisma.route.deleteMany({ where: { operatorId } });
    await prisma.bus.deleteMany({ where: { operatorId } });
    await prisma.operator.deleteMany({ where: { id: operatorId } });
  }
  await prisma.$disconnect();
});

describe('searchTrips — VN midnight-rollover boundary (Asia/Ho_Chi_Minh, #777)', () => {
  it('sanity: both boundary instants derive to the VN service date under test', () => {
    // If these fail, the fixture is wrong, not the query — guard against a mis-seeded run.
    expect(vnLocalDate(EARLY_DEPARTURE)).toBe(D);
    expect(vnLocalDate(LATE_DEPARTURE)).toBe(D);
    // The early trip's UTC calendar date is the PREVIOUS day (the collision case).
    expect(EARLY_DEPARTURE.toISOString().slice(0, 10)).toBe(D_PREV);
  });

  it('returns exactly the two boundary trips for their VN service date', async () => {
    const { trips } = await searchTrips({ origin: ORIGIN, destination: DEST, date: D, ticketCount: 1 });
    const ids = trips.map((t) => t.tripId).sort();
    expect(ids).toEqual([earlyTripId, lateTripId].sort());
  });

  it('excludes the 00:00-VN trip from the previous VN date (the adjacent UTC day it falls in)', async () => {
    const { trips } = await searchTrips({ origin: ORIGIN, destination: DEST, date: D_PREV, ticketCount: 1 });
    expect(trips).toEqual([]);
  });

  it('excludes the 23:59:59.999-VN trip from the next VN date', async () => {
    const { trips } = await searchTrips({ origin: ORIGIN, destination: DEST, date: D_NEXT, ticketCount: 1 });
    expect(trips).toEqual([]);
  });
});
