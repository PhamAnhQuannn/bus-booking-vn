/**
 * E2E spec: operator booking queue + day-of manifest (Issue 014).
 *
 * Covers ACs:
 *   AC1  dashboard shows unviewed badge count          — GET /api/op/bookings (count)
 *   AC2  filter by contactStatus returns subset        — GET /api/op/bookings?contactStatus=
 *   AC5  depart sets salesClosed=true (no new bookings) — POST /api/op/trips/:id/depart
 *   AC6  manifest rows have NO seatNumber              — GET /api/op/manifest/:tripId
 *   AC7  manifest has generatedAt timestamp            — GET /api/op/manifest/:tripId
 *   Cross-op tenant isolation for all endpoints
 *
 * Issue 039 (online-only): the AC3 call-outcome / AC4 cash-collected / escalation
 * / picked-up mutation routes were deleted; their specs were removed with them.
 *
 * SANDBOX-GATED: set E2E_OP_BOOKING_QUEUE_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Seed operator: phone +8490xxxxxx1, password BBOp2026!,
 *     requiresPasswordChange=false (run prepareQueue() below).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { randomUUID } from 'crypto';
import { normalizePhone } from '../lib/auth/phoneNormalize';

const SANDBOX_ENABLED = process.env.E2E_OP_BOOKING_QUEUE_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = normalizePhone('0901230001');
const SEED_PASSWORD = 'BBOp2026!';
const OP_B_PHONE = '+8490xxxxxx9';
const OP_B_PASSWORD = 'BBOp2026!';

interface PrepareCtx {
  opAId: string;
  opBId: string;
  tripId: string;
  opBTripId: string;
  paidBookingId: string;
  secondBookingId: string;
  opBBookingId: string;
}

/**
 * Seeds the DB with:
 *   - Op A (SEED_PHONE) — one trip in the future, two paid bookings (momo)
 *   - Op B (OP_B_PHONE) — one trip + one booking (tenant isolation)
 */
async function prepareQueue(): Promise<PrepareCtx> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const passwordHash = await hash(SEED_PASSWORD);

    // Reset op A user
    const a = await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = false
       WHERE phone = $2 RETURNING "operatorId"`,
      [passwordHash, SEED_PHONE]
    );
    const opAId: string = a.rows[0].operatorId;
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [SEED_PHONE]
    );

    // Ensure op A has a bus
    const busRow = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 30, 'E2E-QUEUE-BUS1', 'coach')
       ON CONFLICT ("operatorId", "licensePlate") DO UPDATE SET "capacity" = 30
       RETURNING id`,
      [opAId]
    );
    const busId: string = busRow.rows[0].id;

    // Ensure op A has a route
    const routeRow = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'Queue-City-A', 'Queue-City-B', 90, NOW())
       ON CONFLICT DO NOTHING RETURNING id`,
      [opAId]
    );
    let routeId: string;
    if (routeRow.rows.length > 0) {
      routeId = routeRow.rows[0].id;
    } else {
      const r = await client.query(
        `SELECT id FROM "Route" WHERE "operatorId" = $1 AND "origin" = 'Queue-City-A' LIMIT 1`,
        [opAId]
      );
      routeId = r.rows[0].id;
    }

    // Create a fresh trip 2 days from now (avoid leftover-data collisions)
    const depAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const tripRow = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","blockedSeats","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 100000, 'scheduled', false, 0, NOW()) RETURNING id`,
      [routeId, busId, opAId, depAt]
    );
    const tripId: string = tripRow.rows[0].id;

    // Wipe leftover bookings from prior runs. The hardcoded bookingRefs below are
    // globally unique, and each beforeEach creates a *fresh* trip — so a trip-scoped
    // wipe alone leaves last run's rows behind and the re-insert hits
    // Booking_bookingRef_key. Clear by the known refs (children first) too.
    const leftoverRefs = ['BB-2026-eq01-aa11', 'BB-2026-eq01-bb22', 'BB-2026-eqb1-cc33'];
    await client.query(`DELETE FROM "NotificationLog" WHERE "bookingId" IN (SELECT id FROM "Booking" WHERE "tripId" = $1 OR "bookingRef" = ANY($2))`, [tripId, leftoverRefs]);
    await client.query(`DELETE FROM "Booking" WHERE "tripId" = $1 OR "bookingRef" = ANY($2)`, [tripId, leftoverRefs]);

    // Paid booking (paid)
    const paidId = randomUUID();
    await client.query(
      `INSERT INTO "Booking" ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone","ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus","createdAt")
       VALUES ($1, 'BB-2026-eq01-aa11', 'tok-eq01-aa11', $2, 'E2E Queue Buyer', '+8490xxxxxx2', 2, 200000, 'momo', 'paid', false, 'pending', NOW())`,
      [paidId, tripId]
    );

    // Second paid booking (momo)
    const secondId = randomUUID();
    await client.query(
      `INSERT INTO "Booking" ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone","ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus","createdAt")
       VALUES ($1, 'BB-2026-eq01-bb22', 'tok-eq01-bb22', $2, 'E2E Queue Buyer 2', '+8490xxxxxx3', 1, 100000, 'momo', 'paid', false, 'pending', NOW())`,
      [secondId, tripId]
    );

    // ── Op B setup ──────────────────────────────────────────────────────────
    const opBRow = await client.query(
      `SELECT o.id FROM "Operator" o
       JOIN "OperatorUser" u ON u."operatorId" = o.id
       WHERE u.phone = $1 LIMIT 1`,
      [OP_B_PHONE]
    );
    let opBId: string;
    if (opBRow.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail")
         VALUES (gen_random_uuid()::text, 'Op B Queue Test', $1, 'opbqueue@example.test') RETURNING id`,
        [OP_B_PHONE]
      );
      opBId = ins.rows[0].id;
      await client.query(
        `INSERT INTO "OperatorUser" ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName","updatedAt")
         VALUES (gen_random_uuid()::text, $1, $4, $5, $2, $3, 'admin', false, 'Op B Queue Admin', NOW())`,
        [OP_B_PHONE, await hash(OP_B_PASSWORD), opBId, '+8490xxxxxx9', '+8490xxxxxx8']
      );
    } else {
      opBId = opBRow.rows[0].id;
    }

    const opBBusRow = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 20, 'OPB-QUEUE-BUS1', 'coach')
       ON CONFLICT ("operatorId", "licensePlate") DO UPDATE SET "capacity" = 20
       RETURNING id`,
      [opBId]
    );
    const opBBusId: string = opBBusRow.rows[0].id;

    const opBRouteRow = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'OPB-Queue-A','OPB-Queue-B', 60, NOW())
       ON CONFLICT DO NOTHING RETURNING id`,
      [opBId]
    );
    let opBRouteId: string;
    if (opBRouteRow.rows.length > 0) {
      opBRouteId = opBRouteRow.rows[0].id;
    } else {
      const r = await client.query(
        `SELECT id FROM "Route" WHERE "operatorId" = $1 LIMIT 1`,
        [opBId]
      );
      opBRouteId = r.rows[0].id;
    }

    const opBDepAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const opBTripRow = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","blockedSeats","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 80000, 'scheduled', false, 0, NOW()) RETURNING id`,
      [opBRouteId, opBBusId, opBId, opBDepAt]
    );
    const opBTripId: string = opBTripRow.rows[0].id;

    const opBBookingId = randomUUID();
    await client.query(
      `INSERT INTO "Booking" ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone","ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus","createdAt")
       VALUES ($1, 'BB-2026-eqb1-cc33', 'tok-eqb1-cc33', $2, 'Op B Buyer', '+8490xxxxxx4', 1, 80000, 'momo', 'paid', false, 'pending', NOW())`,
      [opBBookingId, opBTripId]
    );

    return { opAId, opBId, tripId, opBTripId, paidBookingId: paidId, secondBookingId: secondId, opBBookingId };
  } finally {
    await client.end();
  }
}

// ────────────────────────────────────────────────────────────────────────────

test.describe('Operator booking queue + manifest (Issue 014)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_BOOKING_QUEUE_ENABLED=true to run');

  let ctx: PrepareCtx;

  test.beforeEach(async () => {
    ctx = await prepareQueue();
  });

  // ── AC1: booking queue list returns paid bookings ──────────────────────

  test('AC1: GET /api/op/bookings returns paid bookings for operator', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get('/api/op/bookings');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.rows)).toBe(true);

    const ids: string[] = json.rows.map((r: { id: string }) => r.id);
    expect(ids).toContain(ctx.paidBookingId);
    expect(ids).toContain(ctx.secondBookingId);
    // Op B booking must NOT appear
    expect(ids).not.toContain(ctx.opBBookingId);
  });

  // ── AC2: filter by contactStatus ─────────────────────────────────────────

  test('AC2: contactStatus filter returns only matching bookings', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Both seeded bookings start with contactStatus='pending' (the call-outcome
    // mutation route was removed in Issue 039 — online-only). Filter the queue
    // by the seeded contactStatus value.
    const pending = await request.get('/api/op/bookings?contactStatus=pending');
    expect(pending.status()).toBe(200);
    const pendingJson = await pending.json();
    const pendingIds: string[] = pendingJson.rows.map((r: { id: string }) => r.id);
    expect(pendingIds).toContain(ctx.paidBookingId);
    expect(pendingIds).toContain(ctx.secondBookingId);

    const reached = await request.get('/api/op/bookings?contactStatus=reached');
    expect(reached.status()).toBe(200);
    const reachedJson = await reached.json();
    const reachedIds: string[] = reachedJson.rows.map((r: { id: string }) => r.id);
    expect(reachedIds).not.toContain(ctx.paidBookingId);
  });

  // ── AC2: get single booking detail ────────────────────────────────────────

  test('AC2: GET /api/op/bookings/:id returns full booking DTO', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/bookings/${ctx.paidBookingId}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.booking).toBeDefined();
    expect(json.booking.id).toBe(ctx.paidBookingId);
    expect(json.booking).toHaveProperty('contactStatus');
    expect(json.booking).toHaveProperty('escalationNote');
    // AC6: no seatNumber in booking DTO
    expect(json.booking).not.toHaveProperty('seatNumber');
  });

  test('AC2: cross-op GET booking returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/bookings/${ctx.opBBookingId}`);
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  // Issue 039: the call-outcome, escalation, picked-up, and cash-collected
  // mutation routes were deleted (online-only). Their AC3/AC4 specs were removed
  // with them. The booking-queue LIST + manifest READ tests below remain.

  // ── AC5: depart trip ──────────────────────────────────────────────────────

  test('AC5: POST /api/op/trips/:id/depart sets salesClosed=true', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/trips/${ctx.tripId}/depart`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyDeparted).toBe(false);
    expect(json.trip.salesClosed).toBe(true);
  });

  test('AC5: depart is idempotent — second call returns 200 alreadyDeparted=true', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    await request.post(`/api/op/trips/${ctx.tripId}/depart`, {
      headers: { 'X-CSRF-Token': csrf },
    });

    const second = await request.post(`/api/op/trips/${ctx.tripId}/depart`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(second.status()).toBe(200);
    const json = await second.json();
    expect(json.alreadyDeparted).toBe(true);
  });

  test('AC5: depart cross-op returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/trips/${ctx.opBTripId}/depart`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  // ── Complete trip ─────────────────────────────────────────────────────────

  test('complete trip: POST /api/op/trips/:id/complete returns 200', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/trips/${ctx.tripId}/complete`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadyCompleted).toBe(false);
    expect(typeof json.payoutJobsEnqueued).toBe('number');
  });

  // ── Upcoming trips ────────────────────────────────────────────────────────

  test('GET /api/op/trips/upcoming returns upcoming trips', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get('/api/op/trips/upcoming');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.trips)).toBe(true);
    // Op B trips must NOT appear
    const ids: string[] = json.trips.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(ctx.opBTripId);
  });

  // ── AC6 + AC7: manifest ───────────────────────────────────────────────────

  test('AC6: GET /api/op/manifest/:tripId rows have NO seatNumber field', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/manifest/${ctx.tripId}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.rows)).toBe(true);

    for (const row of json.rows) {
      // AC6: NO seat-number column
      expect(row).not.toHaveProperty('seatNumber');
      // Expect standard manifest fields
      expect(row).toHaveProperty('bookingId');
      expect(row).toHaveProperty('bookingRef');
      expect(row).toHaveProperty('contactStatus');
      expect(row).toHaveProperty('paymentStatus');
    }
  });

  test('AC7: manifest response has generatedAt timestamp', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/manifest/${ctx.tripId}`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.generatedAt).toBeDefined();
    const dt = new Date(json.generatedAt);
    expect(dt.getTime()).not.toBeNaN();
  });

  test('AC6+AC7: manifest cross-op returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/manifest/${ctx.opBTripId}`);
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  // ── RSC page smoke tests (Playwright browser) ──────────────────────────────

  test('op/upcoming page renders upcoming trips table', async ({ page }) => {
    await page.goto('/op/login');
    await page.fill('[name="phone"]', SEED_PHONE);
    await page.fill('[name="password"]', SEED_PASSWORD);
    await page.click('[type="submit"]');
    await page.waitForURL('**/op/dashboard');

    await page.goto('/op/upcoming');
    await page.waitForSelector('[data-testid="upcoming-trips-table"], p');
    // If no trips, page shows empty message — either is valid
    const table = page.locator('[data-testid="upcoming-trips-table"]');
    const empty = page.locator('p', { hasText: 'Không có chuyến nào' });
    const tableVisible = await table.isVisible();
    const emptyVisible = await empty.isVisible();
    expect(tableVisible || emptyVisible).toBe(true);
  });

  test('op/manifest/:tripId page renders ManifestRefresh island (AC7 Last-updated)', async ({ page }) => {
    await page.goto('/op/login');
    await page.fill('[name="phone"]', SEED_PHONE);
    await page.fill('[name="password"]', SEED_PASSWORD);
    await page.click('[type="submit"]');
    await page.waitForURL('**/op/dashboard');

    await page.goto(`/op/manifest/${ctx.tripId}`);
    // AC7: "Last updated" timestamp displayed
    await page.waitForSelector('[data-testid="manifest-last-updated"]');
    const lastUpdated = page.locator('[data-testid="manifest-last-updated"]');
    expect(await lastUpdated.isVisible()).toBe(true);

    // Refresh button present
    const refreshBtn = page.locator('[data-testid="manifest-refresh-btn"]');
    expect(await refreshBtn.isVisible()).toBe(true);
  });
});
