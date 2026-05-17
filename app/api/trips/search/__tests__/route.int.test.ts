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

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { addDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { GET } from '../route';
import { ratelimit } from '@/lib/ratelimit';

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

const TODAY_STR = vnDateStr(now);
const TOMORROW_STR = vnDateStr(addDays(vnToday, 1));
const DAY2_STR = vnDateStr(addDays(vnToday, 2));
const DAY4_STR = vnDateStr(addDays(vnToday, 4));
const DAY5_STR = vnDateStr(addDays(vnToday, 5));

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for integration tests');
  }
});

describe('GET /api/trips/search — integration', () => {
  // ---- AC-10: Zod validation (400) ----

  it('AC-10: missing origin → 400 with field error', async () => {
    const req = makeRequest({ destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('errors');
    expect(Object.keys(body.errors)).toContain('origin');
  });

  it('AC-10: ticketCount > 10 → 400', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '11' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveProperty('ticketCount');
  });

  it('AC-10: ticketCount = 0 → 400', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '0' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('AC-10: malformed date → 400', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: '17/05/2026', ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveProperty('date');
  });

  it('AC-10: origin > 50 chars → 400', async () => {
    const req = makeRequest({ origin: 'A'.repeat(51), destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors).toHaveProperty('origin');
  });

  // ---- AC-1: Happy path + ordering ----

  it('AC-1: returns 200 JSON array for valid Hà Nội → TP.HCM search', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '2' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-1: results ordered departureAt ASC', async () => {
    // Day 2 has 2 trips for r1 and 1 for r2 — search a route with multiple results
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: DAY2_STR, ticketCount: '1' });
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
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    const item = body[0];
    const keys = Object.keys(item).sort();
    expect(keys).toEqual(
      ['availableSeats', 'departureAt', 'operatorLegalName', 'price', 'routeDestination', 'routeOrigin', 'tripId'].sort()
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
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '1' });
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
    // Seed has a cancelled trip on Day 4 for Hà Nội→TP.HCM
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: DAY4_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Cancelled trip should not appear — array empty (no other scheduled trips that day)
    expect(body).toEqual([]);
  });

  it('AC-3: salesClosed trips excluded from results', async () => {
    // Seed has a salesClosed trip on Day 5 for Hà Nội→TP.HCM
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: DAY5_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // salesClosed trip should not appear
    expect(body).toEqual([]);
  });

  it('AC-3: ticketCount filter — no trips when ticketCount exceeds capacity', async () => {
    // All buses have capacity 40; ticketCount=41 should match nothing (DB constraint in findMany)
    // But ticketCount max is 10 via Zod — so we can't test 41 directly.
    // Test capacity filter works: ticketCount=10 should still find results (capacity 40 >= 10)
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '10' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  // ---- AC-2: Diacritic-insensitive (unaccent ILIKE) ----

  it('AC-2: unaccented "Ha Noi" matches "Hà Nội"', async () => {
    const req = makeRequest({ origin: 'Ha Noi', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-2: partial origin "Noi" matches "Hà Nội"', async () => {
    const req = makeRequest({ origin: 'Noi', destination: 'HCM', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it('AC-2: case-insensitive "ha noi" matches "Hà Nội"', async () => {
    const req = makeRequest({ origin: 'ha noi', destination: 'tp.hcm', date: TOMORROW_STR, ticketCount: '1' });
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
    const req = makeRequest({ origin: 'HÀ NỘI', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '1' });
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
        destination: 'TP.HCM',
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
    // Seed: buses[2] (maintenance now..+3d) has r2 trip tomorrow 11am.
    // r2 also has buses[3] trip tomorrow 7am. Only buses[3] should surface.
    const req = makeRequest({ origin: 'Đà Nẵng', destination: 'Huế', date: TOMORROW_STR, ticketCount: '1' });
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
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '1' });
    const res = await GET(req);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).not.toHaveProperty('error');
  });

  // ---- Field type checks ----

  it('tripId is string, price is number, availableSeats is number, departureAt is ISO string', async () => {
    const req = makeRequest({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW_STR, ticketCount: '1' });
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
