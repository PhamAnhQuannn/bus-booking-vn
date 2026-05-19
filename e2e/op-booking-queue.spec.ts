/**
 * E2E spec: operator booking queue + day-of manifest (Issue 014).
 *
 * Covers ACs:
 *   AC1  dashboard shows unviewed badge count          — GET /api/op/bookings (count)
 *   AC2  filter by contactStatus returns subset        — GET /api/op/bookings?contactStatus=
 *   AC3  call-outcome writes contactStatus             — POST /api/op/bookings/:id/call-outcome
 *   AC4  cash-collected transitions status             — POST /api/op/bookings/:id/cash-collected
 *   AC5  depart sets salesClosed=true (no new bookings) — POST /api/op/trips/:id/depart
 *   AC6  manifest rows have NO seatNumber              — GET /api/op/manifest/:tripId
 *   AC7  manifest has generatedAt timestamp            — GET /api/op/manifest/:tripId
 *   Cross-op tenant isolation for all endpoints
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
import { randomUUID } from 'crypto';

const SANDBOX_ENABLED = process.env.E2E_OP_BOOKING_QUEUE_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = '+8490xxxxxx1';
const SEED_PASSWORD = 'BBOp2026!';
const OP_B_PHONE = '+8490xxxxxx9';
const OP_B_PASSWORD = 'BBOp2026!';

interface PrepareCtx {
  opAId: string;
  opBId: string;
  tripId: string;
  opBTripId: string;
  paidBookingId: string;
  cashBookingId: string;
  opBBookingId: string;
}

/**
 * Seeds the DB with:
 *   - Op A (SEED_PHONE) — one trip in the future, two bookings (paid_operator_notified + pending_cash_payment)
 *   - Op B (OP_B_PHONE) — one trip + one booking (tenant isolation)
 */
async function prepareQueue(): Promise<PrepareCtx> {
  const { hash } = await import('../lib/auth/password');
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
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes")
       VALUES (gen_random_uuid()::text, $1, 'Queue-City-A', 'Queue-City-B', 90)
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

    // Wipe any leftover bookings on this trip
    await client.query(`DELETE FROM "NotificationLog" WHERE "bookingId" IN (SELECT id FROM "Booking" WHERE "tripId" = $1)`, [tripId]);
    await client.query(`DELETE FROM "Booking" WHERE "tripId" = $1`, [tripId]);

    // Paid booking (paid_operator_notified)
    const paidId = randomUUID();
    await client.query(
      `INSERT INTO "Booking" ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone","ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus","createdAt","updatedAt")
       VALUES ($1, 'BB-2026-eq01-aa11', 'tok-eq01-aa11', $2, 'E2E Queue Buyer', '+8490xxxxxx2', 2, 200000, 'momo', 'paid_operator_notified', false, 'pending', NOW(), NOW())`,
      [paidId, tripId]
    );

    // Cash booking (pending_cash_payment)
    const cashId = randomUUID();
    await client.query(
      `INSERT INTO "Booking" ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone","ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus","createdAt","updatedAt")
       VALUES ($1, 'BB-2026-eq01-bb22', 'tok-eq01-bb22', $2, 'E2E Cash Buyer', '+8490xxxxxx3', 1, 100000, 'cash', 'pending_cash_payment', false, 'pending', NOW(), NOW())`,
      [cashId, tripId]
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
        `INSERT INTO "OperatorUser" ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName")
         VALUES (gen_random_uuid()::text, $1, $4, $5, $2, $3, 'admin', false, 'Op B Queue Admin')`,
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
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes")
       VALUES (gen_random_uuid()::text, $1, 'OPB-Queue-A','OPB-Queue-B', 60)
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
      `INSERT INTO "Booking" ("id","bookingRef","confirmationToken","tripId","buyerName","buyerPhone","ticketCount","totalVnd","paymentMethod","status","isManual","contactStatus","createdAt","updatedAt")
       VALUES ($1, 'BB-2026-eqb1-cc33', 'tok-eqb1-cc33', $2, 'Op B Buyer', '+8490xxxxxx4', 1, 80000, 'momo', 'paid_operator_notified', false, 'pending', NOW(), NOW())`,
      [opBBookingId, opBTripId]
    );

    return { opAId, opBId, tripId, opBTripId, paidBookingId: paidId, cashBookingId: cashId, opBBookingId };
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
    expect(ids).toContain(ctx.cashBookingId);
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

    // First set paidBookingId to 'reached'
    await request.post(`/api/op/bookings/${ctx.paidBookingId}/call-outcome`, {
      data: { outcome: 'reached' },
      headers: { 'X-CSRF-Token': csrf },
    });

    const reached = await request.get('/api/op/bookings?contactStatus=reached');
    expect(reached.status()).toBe(200);
    const reachedJson = await reached.json();
    const reachedIds: string[] = reachedJson.rows.map((r: { id: string }) => r.id);
    expect(reachedIds).toContain(ctx.paidBookingId);

    const pending = await request.get('/api/op/bookings?contactStatus=pending');
    expect(pending.status()).toBe(200);
    const pendingJson = await pending.json();
    const pendingIds: string[] = pendingJson.rows.map((r: { id: string }) => r.id);
    expect(pendingIds).not.toContain(ctx.paidBookingId);
    expect(pendingIds).toContain(ctx.cashBookingId);
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

  // ── AC3: call-outcome ─────────────────────────────────────────────────────

  test('AC3: POST call-outcome saves contactStatus and pickupNote', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/bookings/${ctx.paidBookingId}/call-outcome`, {
      data: { outcome: 'no_answer' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.booking.contactStatus).toBe('no_answer');
  });

  test('AC3: call-outcome with pickupNote saves note', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/bookings/${ctx.paidBookingId}/call-outcome`, {
      data: { outcome: 'reached', pickupNote: 'Khách đứng trước trường' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.booking.contactStatus).toBe('reached');
    expect(json.booking.pickupNote).toBe('Khách đứng trước trường');
  });

  test('AC3: call-outcome cross-op returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/bookings/${ctx.opBBookingId}/call-outcome`, {
      data: { outcome: 'reached' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  // ── Escalation ────────────────────────────────────────────────────────────

  test('escalation: POST sets escalationNote and escalatedAt', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/bookings/${ctx.paidBookingId}/escalation`, {
      data: { note: 'Khách khiếu nại về chỗ ngồi' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.booking.escalatedAt).not.toBeNull();
    expect(json.booking.escalationNote).toBe('Khách khiếu nại về chỗ ngồi');
  });

  // ── picked-up ─────────────────────────────────────────────────────────────

  test('picked-up: POST marks booking and returns ok=true (idempotent)', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const first = await request.post(`/api/op/bookings/${ctx.paidBookingId}/picked-up`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(first.status()).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.ok).toBe(true);
    expect(firstJson.alreadyPickedUp).toBe(false);
    expect(firstJson.booking.pickedUpAt).not.toBeNull();

    // Idempotent second call — still 200 per Issue 013 discriminated result rule
    const second = await request.post(`/api/op/bookings/${ctx.paidBookingId}/picked-up`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(second.status()).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.ok).toBe(true);
    expect(secondJson.alreadyPickedUp).toBe(true);
  });

  test('picked-up: pending_cash_payment returns 422 payment_required', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/bookings/${ctx.cashBookingId}/picked-up`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('payment_required');
  });

  // ── AC4: cash-collected ───────────────────────────────────────────────────

  test('AC4: POST cash-collected transitions pending_cash_payment → paid_operator_notified', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/bookings/${ctx.cashBookingId}/cash-collected`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.booking.status).toBe('paid_operator_notified');
    expect(json.booking.cashCollectedAt).not.toBeNull();
    // I7: totalVnd comes from DB, should match seed
    expect(json.totalVnd).toBe(100_000);
  });

  test('AC4: cash-collected on already-paid booking returns 422 invalid_state', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/bookings/${ctx.paidBookingId}/cash-collected`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('invalid_state');
  });

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
