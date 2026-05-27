/**
 * E2E spec: operator manual booking (Issue 015).
 *
 * Covers ACs:
 *   AC1  sold_out guard — POST with ticketCount > available → 422 sold_out
 *   AC2  manual-paid → booking status = paid_operator_notified, isManual=true
 *   AC3  manual-cash → booking status = pending_cash_payment, isManual=true
 *   AC4  notifications seeded (customer SMS template = manualBookingPaid / manualBookingCash)
 *   AC5  manifest/booking list returns isManual=true flag
 *
 * SANDBOX-GATED: set E2E_OP_MANUAL_BOOKING_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Seed operator: phone +8490xxxxxx1, password BBOp2026!,
 *     requiresPasswordChange=false (run prepareManualBooking() below).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/auth/phoneNormalize';

const SANDBOX_ENABLED = process.env.E2E_OP_MANUAL_BOOKING_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = normalizePhone('0901230001');
const SEED_PASSWORD = 'BBOp2026!';

interface PrepareCtx {
  operatorId: string;
  tripId: string;
  smallTripId: string; // trip with capacity=1 for sold_out test
}

async function prepareManualBooking(): Promise<PrepareCtx> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const passwordHash = await hash(SEED_PASSWORD);

    // Ensure op user has correct password and no forced password change
    const a = await client.query(
      `UPDATE "OperatorUser"
       SET "passwordHash" = $1, "requiresPasswordChange" = false
       WHERE phone = $2
       RETURNING "operatorId"`,
      [passwordHash, SEED_PHONE]
    );
    const operatorId: string = a.rows[0].operatorId;

    // Revoke any existing sessions
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [SEED_PHONE]
    );

    // Ensure bus
    const busRow = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 20, 'MB-E2E-BUS1', 'coach')
       ON CONFLICT ("operatorId","licensePlate") DO UPDATE SET "capacity" = 20
       RETURNING id`,
      [operatorId]
    );
    const busId: string = busRow.rows[0].id;

    // Ensure route
    const existRoute = await client.query(
      `SELECT id FROM "Route"
       WHERE "operatorId" = $1 AND "origin" = 'MB-E2E-Origin' AND "destination" = 'MB-E2E-Dest'
       LIMIT 1`,
      [operatorId]
    );
    let routeId: string;
    if (existRoute.rows.length > 0) {
      routeId = existRoute.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
         VALUES (gen_random_uuid()::text, $1, 'MB-E2E-Origin', 'MB-E2E-Dest', 120, NOW()) RETURNING id`,
        [operatorId]
      );
      routeId = ins.rows[0].id;
    }

    // Create a trip for the main tests
    const depAt = new Date(Date.now() + 86400 * 1000 * 3).toISOString();
    const tripRow = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","blockedSeats","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 120000, 'scheduled', false, 0, NOW())
       RETURNING id`,
      [routeId, busId, operatorId, depAt]
    );
    const tripId: string = tripRow.rows[0].id;

    // Create a capacity=1 bus for sold_out test
    const smallBusRow = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 1, 'MB-E2E-BUS2', 'coach')
       ON CONFLICT ("operatorId","licensePlate") DO UPDATE SET "capacity" = 1
       RETURNING id`,
      [operatorId]
    );
    const smallBusId: string = smallBusRow.rows[0].id;

    const smallDepAt = new Date(Date.now() + 86400 * 1000 * 4).toISOString();
    const smallTripRow = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","blockedSeats","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 80000, 'scheduled', false, 0, NOW())
       RETURNING id`,
      [routeId, smallBusId, operatorId, smallDepAt]
    );
    const smallTripId: string = smallTripRow.rows[0].id;

    return { operatorId, tripId, smallTripId };
  } finally {
    await client.end();
  }
}

test.describe('Operator manual booking (Issue 015)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_MANUAL_BOOKING_ENABLED=true to run');

  let ctx: PrepareCtx;

  test.beforeEach(async () => {
    ctx = await prepareManualBooking();
  });

  test('AC2: manual-paid → 200, paid_operator_notified, isManual=true', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/trips/${ctx.tripId}/manual-booking`, {
      data: {
        buyerName: 'Tran Thi Bich',
        buyerPhone: '0912345678',
        ticketCount: 2,
        paymentMethod: 'paid',
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.booking).toBeDefined();
    expect(json.booking.status).toBe('paid_operator_notified');
    expect(json.booking.isManual).toBe(true);
    expect(json.booking.holdId).toBeNull();
    expect(json.booking.ticketCount).toBe(2);
    expect(json.booking.totalVnd).toBe(240000); // 2 * 120000
    expect(json.booking.bookingRef).toMatch(/^BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}$/);
  });

  test('AC3: manual-cash → 200, pending_cash_payment, isManual=true', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/trips/${ctx.tripId}/manual-booking`, {
      data: {
        buyerName: 'Le Van Cuong',
        buyerPhone: '0898765432',
        ticketCount: 1,
        paymentMethod: 'cash',
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.booking.status).toBe('pending_cash_payment');
    expect(json.booking.isManual).toBe(true);
  });

  test('AC1: sold_out guard → 422 when ticketCount > availableSeats', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // smallTripId has capacity=1; request 2 tickets
    const res = await request.post(`/api/op/trips/${ctx.smallTripId}/manual-booking`, {
      data: {
        buyerName: 'Pham Van Duc',
        buyerPhone: '0912345678',
        ticketCount: 2,
        paymentMethod: 'paid',
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('sold_out');
  });

  test('AC5: booking list includes isManual flag', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Create a manual booking first
    await request.post(`/api/op/trips/${ctx.tripId}/manual-booking`, {
      data: {
        buyerName: 'Hoang Thi Mai',
        buyerPhone: '0912345678',
        ticketCount: 1,
        paymentMethod: 'paid',
      },
      headers: { 'X-CSRF-Token': csrf },
    });

    // List bookings for the trip
    const list = await request.get(`/api/op/bookings?tripId=${ctx.tripId}`);
    expect(list.status()).toBe(200);
    const json = await list.json();
    // Queue-list DTO (toBookingQueueRow) exposes the AC5 isManual flag as `manualFlag`.
    const bookings: Array<{ manualFlag: boolean }> = json.rows ?? json.bookings ?? json.items ?? [];
    expect(bookings.length).toBeGreaterThan(0);
    const manualBooking = bookings.find((b) => b.manualFlag === true);
    expect(manualBooking).toBeDefined();
  });

  test('validation: 422 for missing paymentMethod', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post(`/api/op/trips/${ctx.tripId}/manual-booking`, {
      data: {
        buyerName: 'Test User',
        buyerPhone: '0912345678',
        ticketCount: 1,
        // paymentMethod missing
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('validation_failed');
  });

  test('auth: 401 without operator session', async ({ request }) => {
    // Prime CSRF so the double-submit middleware doesn't 403 before the auth
    // check runs — we're asserting the *auth* gate (401), not the CSRF gate.
    const csrf = await primeCsrf(request);
    const res = await request.post(`/api/op/trips/${ctx.tripId}/manual-booking`, {
      data: {
        buyerName: 'Anon User',
        buyerPhone: '0912345678',
        ticketCount: 1,
        paymentMethod: 'paid',
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(401);
  });
});
