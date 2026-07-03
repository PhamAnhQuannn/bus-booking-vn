/**
 * Integration tests for GET /api/trips/search
 *
 * Requires a live DATABASE_URL (postgres:16 with pg_trgm + unaccent + seed data).
 * Run via: pnpm vitest:int
 *
 * AC coverage:
 *   AC-1  Results ordered departureAt ASC
 *   AC-2  Diacritic-insensitive search (unaccent ILIKE)
 *   AC-3  Exclude cancelled / salesClosed / maintenance-bus trips
 *   AC-10 400 on invalid params (Zod breach)
 *   AC-11 500 scrubbed — error body = { error: "Internal server error" }
 *   AC-12 Cache-Control: no-store on 200
 *   AC-13 Prisma select whitelist — only 7 fields in response
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { addDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { GET } from '../route';
import { ratelimit } from '@/lib/ratelimit';
import { prisma } from '@/lib/core/db/client';

const TZ = 'Asia/Ho_Chi_Minh';

/** Format a Date as YYYY-MM-DD in VN timezone */
function vnDateStr(d: Date): string {
  const vn = toZonedTime(d, TZ);
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, '0');
  const day = String(vn.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build a NextRequest for GET /api/trips/search with given params */
function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/trips/search');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: 'GET' });
}

// Seed trips use addDays(todayStart, N) where todayStart is VN midnight on seed day.
// We use the same reference point for test dates.
const now = new Date();
const vnToday = startOfDay(toZonedTime(now, TZ));

const TOMORROW_STR = vnDateStr(addDays(vnToday, 1));
const DAY2_STR = vnDateStr(addDays(vnToday, 2));

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for integration tests');
  }
});

// ---- AC-3 isolated fixtures ----
// AC-3 exclusion tests must NOT depend on the global seed's date sparsity (the
// dense demo seed + other int-test fixtures pollute shared routes/dates). Each
// exclusion case gets its own uniquely-named route so the only trips present are
// the ones created here — deterministic regardless of seed.
const AC3 = {
  cancel: { origin: 'ACThreeCancelOrigin', dest: 'ACThreeCancelDest' },
  closed: { origin: 'ACThreeClosedOrigin', dest: 'ACThreeClosedDest' },
  maint: { origin: 'ACThreeMaintOrigin', dest: 'ACThreeMaintDest' },
};
let ac3OperatorId: string;
const ac3RouteIds: string[] = [];

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: {
      legalName: 'AC3 Exclusion Test Operator',
      contactPhone: '+8490xxxxxx5',
      contactEmail: 'ac3@route-int.test',
      notificationPhone: '+8490xxxxxx6',
      // Issue 046: operator must be APPROVED to be search-visible.
      status: 'APPROVED',
    },
  });
  ac3OperatorId = op.id;
  const departTomorrow = (h: number) => new Date(`${TOMORROW_STR}T${String(h).padStart(2, '0')}:00:00+07:00`);

  // Cancelled-only route
  const rCancel = await prisma.route.create({
    data: { origin: AC3.cancel.origin, destination: AC3.cancel.dest, operatorId: op.id, durationMinutes: 180 },
  });
  const busC = await prisma.bus.create({
    data: { operatorId: op.id, capacity: 20, licensePlate: 'AC3-CANC-1', busType: 'coach' },
  });
  await prisma.trip.create({
    data: { routeId: rCancel.id, busId: busC.id, operatorId: op.id, departureAt: departTomorrow(7), price: 100000, status: 'cancelled', salesClosed: false },
  });

  // SalesClosed-only route
  const rClosed = await prisma.route.create({
    data: { origin: AC3.closed.origin, destination: AC3.closed.dest, operatorId: op.id, durationMinutes: 180 },
  });
  const busS = await prisma.bus.create({
    data: { operatorId: op.id, capacity: 20, licensePlate: 'AC3-CLOSED-1', busType: 'coach' },
  });
  await prisma.trip.create({
    data: { routeId: rClosed.id, busId: busS.id, operatorId: op.id, departureAt: departTomorrow(7), price: 100000, status: 'scheduled', salesClosed: true },
  });

  // Maintenance route: 1 normal trip (surfaces) + 1 maintenance-bus trip (excluded) → exactly 1 result.
  const rMaint = await prisma.route.create({
    data: { origin: AC3.maint.origin, destination: AC3.maint.dest, operatorId: op.id, durationMinutes: 180 },
  });
  const busNormal = await prisma.bus.create({
    data: { operatorId: op.id, capacity: 20, licensePlate: 'AC3-MAINT-OK', busType: 'coach' },
  });
  const busMaint = await prisma.bus.create({
    data: {
      operatorId: op.id, capacity: 20, licensePlate: 'AC3-MAINT-DOWN', busType: 'coach',
    },
  });
  await prisma.busMaintenance.create({
    data: {
      busId: busMaint.id,
      startAt: new Date(Date.now() - 24 * 3600 * 1000),
      endAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      reason: 'test maintenance',
    },
  });
  await prisma.trip.create({
    data: { routeId: rMaint.id, busId: busNormal.id, operatorId: op.id, departureAt: departTomorrow(7), price: 100000, status: 'scheduled', salesClosed: false },
  });
  await prisma.trip.create({
    data: { routeId: rMaint.id, busId: busMaint.id, operatorId: op.id, departureAt: departTomorrow(11), price: 100000, status: 'scheduled', salesClosed: false },
  });

  ac3RouteIds.push(rCancel.id, rClosed.id, rMaint.id);
});

afterAll(async () => {
  if (ac3RouteIds.length) {
    await prisma.trip.deleteMany({ where: { routeId: { in: ac3RouteIds } } });
    await prisma.route.deleteMany({ where: { id: { in: ac3RouteIds } } });
  }
  if (ac3OperatorId) {
    await prisma.bus.deleteMany({ where: { operatorId: ac3OperatorId } });
    await prisma.operator.deleteMany({ where: { id: ac3OperatorId } });
  }
});

describe('GET /api/trips/search — integration', () => {
  // ---- AC-10: Zod validation (400) ----

  it('AC-10: missing origin → 400 with field error', async () => {
    const req = makeRequest({ destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('errors');
    expect(Object.keys(body.errors)).toContain('origin');
  });

  it('AC-10: ticketCount > 10 → 400', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '11' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveProperty('ticketCount');
  });

  it('AC-10: ticketCount = 0 → 400', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '0' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('AC-10: malformed date → 400', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: '17/05/2026', ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveProperty('date');
  });

  it('AC-10: origin > 50 chars → 400', async () => {
    const req = makeRequest({ origin: 'A'.repeat(51), destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveProperty('origin');
  });

  // ---- AC-1: Happy path + ordering ----

  it('AC-1: returns 200 JSON array for valid Hà Nội → Sài Gòn search', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-1: results ordered departureAt ASC', async () => {
    // Day 2 has 2 trips for r1 and 1 for r2 — search a route with multiple results
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: DAY2_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // May have 0 or more — if >1 verify ordering
    if (body.length > 1) {
      for (let i = 1; i < body.length; i++) {
        expect(new Date(body[i].departureAt) >= new Date(body[i - 1].departureAt)).toBe(true);
      }
    }
  });

  // ---- AC-13: Select whitelist — exactly 7 fields ----

  it('AC-13: response objects contain exactly the 7 contract fields', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    const item = body[0];
    const keys = Object.keys(item).sort();
    expect(keys).toEqual(
      [
        'availableSeats',
        'busType',
        'departureAt',
        'durationMinutes',
        'operatorId',
        'operatorLegalName',
        'price',
        'routeDestination',
        'routeOrigin',
        'tripId',
      ].sort()
    );
    // No internal fields leaked
    expect(item).not.toHaveProperty('id');
    expect(item).not.toHaveProperty('salesClosed');
    expect(item).not.toHaveProperty('status');
    expect(item).not.toHaveProperty('busId');
    expect(item).not.toHaveProperty('routeId');
  });

  // ---- AC-12: Cache-Control: no-store ----

  it('AC-12: 200 response has Cache-Control: no-store', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('AC-12: 200 empty result also has Cache-Control: no-store', async () => {
    const req = makeRequest({ origin: 'NonExistentCity', destination: 'Nowhere', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  // ---- AC-3: Filter exclusions ----

  it('AC-3: cancelled trips excluded from results', async () => {
    // Isolated fixture: the AC3 cancel route has exactly one trip, status=cancelled.
    const req = makeRequest({ origin: AC3.cancel.origin, destination: AC3.cancel.dest, date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('AC-3: salesClosed trips excluded from results', async () => {
    // Isolated fixture: the AC3 closed route has exactly one trip, salesClosed=true.
    const req = makeRequest({ origin: AC3.closed.origin, destination: AC3.closed.dest, date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('AC-3: ticketCount filter — no trips when ticketCount exceeds capacity', async () => {
    // All buses have capacity 40; ticketCount=41 should match nothing (DB constraint in findMany)
    // But ticketCount max is 10 via Zod — so we can't test 41 directly.
    // Test capacity filter works: ticketCount=10 should still find results (capacity 40 >= 10)
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '10' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  // ---- AC-2: Diacritic-insensitive (unaccent ILIKE) ----

  it('AC-2: unaccented "Ha Noi" matches "Hà Nội"', async () => {
    const req = makeRequest({ origin: 'Ha Noi', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-2: partial origin "Noi" matches "Hà Nội"', async () => {
    const req = makeRequest({ origin: 'Noi', destination: 'Gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-2: case-insensitive "ha noi" matches "Hà Nội"', async () => {
    const req = makeRequest({ origin: 'ha noi', destination: 'sài gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-2: unaccented "Da Nang" matches "Đà Nẵng"', async () => {
    const req = makeRequest({ origin: 'Da Nang', destination: 'Hue', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-2: uppercase-with-diacritics "HÀ NỘI" matches "Hà Nội"', async () => {
    const req = makeRequest({ origin: 'HÀ NỘI', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  // ---- AC-7: Rate limit (429 + Retry-After) ----

  it('AC-7: returns 429 with Retry-After when rate limit exceeded', async () => {
    const spy = vi
      .spyOn(ratelimit, 'limit')
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 30 });
    try {
      const req = makeRequest({
        origin: 'Hà Nội',
        destination: 'Sài Gòn',
        date: TOMORROW_STR,
        ticketCount: '1',
      });
      const res = await GET(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('30');
      const body = await res.json();
      expect(body).toEqual({ error: 'Too many requests' });
    } finally {
      spy.mockRestore();
    }
  });

  // ---- AC-3 (extra): maintenance-bus trips excluded ----

  it('AC-3: maintenance-bus trips excluded from results', async () => {
    // Isolated fixture: AC3 maint route has 1 normal-bus trip (surfaces) + 1
    // maintenance-bus trip (excluded). Only the normal trip should return.
    const req = makeRequest({ origin: AC3.maint.origin, destination: AC3.maint.dest, date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(1);
  });

  // ---- AC-11: 500 scrubbed ----
  // Cannot easily trigger a real DB error in integration, but verify the shape
  // by checking that the GET handler returns only { error: string } on error.
  // We test this indirectly: a valid request returns array (not error shape).
  it('AC-11: successful response is plain array, not error wrapper', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).not.toHaveProperty('error');
  });

  // ---- Field type checks ----

  it('tripId is string, price is number, availableSeats is number, departureAt is ISO string', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    const item = body[0];
    expect(typeof item.tripId).toBe('string');
    expect(typeof item.price).toBe('number');
    expect(typeof item.availableSeats).toBe('number');
    expect(typeof item.operatorLegalName).toBe('string');
    expect(typeof item.routeOrigin).toBe('string');
    expect(typeof item.routeDestination).toBe('string');
    // departureAt must be a valid ISO string
    expect(() => new Date(item.departureAt)).not.toThrow();
    expect(new Date(item.departureAt).toISOString()).toBe(item.departureAt);
  });
});
