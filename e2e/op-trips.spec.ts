/**
 * E2E spec: operator trip lifecycle (Issue 013).
 *
 * Covers ACs:
 *   AC1  create trip — POST /api/op/trips
 *   AC2  cross-op isolation — trip owned by op B → 404
 *   AC3  block seats (block_exceeds_available → 422)
 *   AC4  cancel trip + notification log (already_cancelled → 422)
 *   AC5  recurring template create + list — POST/GET /api/op/trip-templates
 *   AC6  paired return (no_reverse_route → 422)
 *   AC7  sales-toggle flip salesClosed
 *
 * SANDBOX-GATED: set E2E_OP_TRIPS_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Seed operator: phone +8490xxxxxx1, password BBOp2026!,
 *     requiresPasswordChange=false (run prepareTrips() below).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';

const SANDBOX_ENABLED = process.env.E2E_OP_TRIPS_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = '+8490xxxxxx1';
const SEED_PASSWORD = 'BBOp2026!';
const OP_B_PHONE = '+8490xxxxxx9';
const OP_B_PASSWORD = 'BBOp2026!';

interface PrepareCtx {
  opAId: string;
  opBId: string;
  routeABId: string;
  routeBAId: string;
  busAId: string;
  opBTripId: string;
}

async function prepareTrips(): Promise<PrepareCtx> {
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

    // Clean op A trip fixtures
    await client.query(
      `DELETE FROM "Trip" WHERE "operatorId" = $1 AND "id" IN (
         SELECT t.id FROM "Trip" t WHERE t."operatorId" = $1
       )`,
      [opAId]
    );

    // Ensure op A has a bus
    const busRow = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 40, 'E2E-TRIP-BUS1', 'coach')
       ON CONFLICT ("operatorId", "licensePlate") DO UPDATE SET "capacity" = 40
       RETURNING id`,
      [opAId]
    );
    const busAId: string = busRow.rows[0].id;

    // Ensure a route A→B and B→A for op A
    let routeABId: string;
    let routeBAId: string;
    const originName = 'E2E-City-A';
    const destName = 'E2E-City-B';

    const existAB = await client.query(
      `SELECT id FROM "Route" WHERE "operatorId" = $1 AND "origin" = $2 AND "destination" = $3 LIMIT 1`,
      [opAId, originName, destName]
    );
    if (existAB.rows.length > 0) {
      routeABId = existAB.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","deactivatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, 120, NULL) RETURNING id`,
        [opAId, originName, destName]
      );
      routeABId = ins.rows[0].id;
    }

    const existBA = await client.query(
      `SELECT id FROM "Route" WHERE "operatorId" = $1 AND "origin" = $2 AND "destination" = $3 LIMIT 1`,
      [opAId, destName, originName]
    );
    if (existBA.rows.length > 0) {
      routeBAId = existBA.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","deactivatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, 120, NULL) RETURNING id`,
        [opAId, destName, originName]
      );
      routeBAId = ins.rows[0].id;
    }

    // Ensure op B and its trip for cross-op AC2 test
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
         VALUES (gen_random_uuid()::text, 'Op B Trips Test', $1, 'opbtrips@example.test') RETURNING id`,
        [OP_B_PHONE]
      );
      opBId = ins.rows[0].id;
      await client.query(
        `INSERT INTO "OperatorUser" ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName")
         VALUES (gen_random_uuid()::text, $1, $4, $5, $2, $3, 'admin', false, 'Op B Trips Admin')`,
        [OP_B_PHONE, await hash(OP_B_PASSWORD), opBId, '+8490xxxxxx9', '+8490xxxxxx8']
      );
    } else {
      opBId = opBRow.rows[0].id;
    }

    // Op B bus + route + trip
    const opBBusRow = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 30, 'OPB-TRIP-BUS1', 'coach')
       ON CONFLICT ("operatorId", "licensePlate") DO UPDATE SET "capacity" = 30
       RETURNING id`,
      [opBId]
    );
    const opBBusId: string = opBBusRow.rows[0].id;

    const opBRouteRow = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes")
       VALUES (gen_random_uuid()::text, $1, 'OPB-Origin','OPB-Dest', 60)
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

    const depAt = new Date(Date.now() + 86400 * 1000 * 7).toISOString(); // 1 week out
    const opBTripRow = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","blockedSeats","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 150000, 'scheduled', false, 0, NOW()) RETURNING id`,
      [opBRouteId, opBBusId, opBId, depAt]
    );
    const opBTripId: string = opBTripRow.rows[0].id;

    return { opAId, opBId, routeABId, routeBAId, busAId, opBTripId };
  } finally {
    await client.end();
  }
}

test.describe('Operator trip lifecycle (Issue 013)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_TRIPS_ENABLED=true to run');

  let ctx: PrepareCtx;

  test.beforeEach(async () => {
    ctx = await prepareTrips();
  });

  test('AC1: create trip — POST /api/op/trips returns 201 with TripDto', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const depAt = new Date(Date.now() + 86400 * 1000 * 2).toISOString();
    const res = await request.post('/api/op/trips', {
      data: { routeId: ctx.routeABId, busId: ctx.busAId, departureAt: depAt, price: 100000 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.trip).toBeDefined();
    expect(json.trip.routeId).toBe(ctx.routeABId);
    expect(json.trip.operatorId).toBe(ctx.opAId);
    expect(typeof json.trip.availableSeats).toBe('number');
  });

  test('AC2: cross-op isolation — op A cannot GET trip owned by op B', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/trips/${ctx.opBTripId}`);
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  test('AC3: block_exceeds_available → 422', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const depAt = new Date(Date.now() + 86400 * 1000 * 3).toISOString();
    const created = await request.post('/api/op/trips', {
      data: { routeId: ctx.routeABId, busId: ctx.busAId, departureAt: depAt, price: 80000 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    const tripId = (await created.json()).trip.id;

    // Bus capacity is 40. Blocking 999 should fail.
    const block = await request.post(`/api/op/trips/${tripId}/block-seats`, {
      data: { blockedSeats: 999 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(block.status()).toBe(422);
    const json = await block.json();
    expect(json.error).toBe('block_exceeds_available');
  });

  test('AC4: cancel trip → 200 ok; second cancel → 200 already_cancelled (AC3 idempotent)', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const depAt = new Date(Date.now() + 86400 * 1000 * 4).toISOString();
    const created = await request.post('/api/op/trips', {
      data: { routeId: ctx.routeABId, busId: ctx.busAId, departureAt: depAt, price: 90000 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    const tripId = (await created.json()).trip.id;

    const cancel1 = await request.post(`/api/op/trips/${tripId}/cancel`, {
      data: { reason: 'E2e test cancellation reason' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(cancel1.status()).toBe(200);
    const json1 = await cancel1.json();
    expect(json1.ok).toBe(true);

    const cancel2 = await request.post(`/api/op/trips/${tripId}/cancel`, {
      data: { reason: 'E2e duplicate cancel attempt' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(cancel2.status()).toBe(200);
    const json2 = await cancel2.json();
    expect(json2.already_cancelled).toBe(true);
    expect(json2.trip).toBeDefined();
    expect(json2.trip.status).toBe('cancelled');
  });

  test('AC5: create recurring template → list shows it', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const created = await request.post('/api/op/trip-templates', {
      data: {
        routeId: ctx.routeABId,
        busId: ctx.busAId,
        price: 70000,
        departureLocalTime: '07:30',
        daysOfMask: 31, // Mon-Fri
        validFrom: '2026-06-01',
        validUntil: '2026-12-31',
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    const templateId = (await created.json()).template.id;

    const list = await request.get('/api/op/trip-templates');
    expect(list.status()).toBe(200);
    const ids: string[] = (await list.json()).templates.map((t: { id: string }) => t.id);
    expect(ids).toContain(templateId);
  });

  test('AC6: paired return with no reverse route → 422 no_reverse_route', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Use a route that has no reverse counterpart
    // Create a one-way-only route
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    const oneWayRoute = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes")
       VALUES (gen_random_uuid()::text, $1, 'OW-Origin', 'OW-Dest-Unique', 120) RETURNING id`,
      [ctx.opAId]
    );
    const oneWayRouteId: string = oneWayRoute.rows[0].id;
    await client.end();

    const depAt = new Date(Date.now() + 86400 * 1000 * 5).toISOString();
    const created = await request.post('/api/op/trips', {
      data: { routeId: oneWayRouteId, busId: ctx.busAId, departureAt: depAt, price: 60000 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    const tripId = (await created.json()).trip.id;

    const returnDepAt = new Date(Date.now() + 86400 * 1000 * 5 + 3600 * 2 * 1000).toISOString();
    const ret = await request.post(`/api/op/trips/${tripId}/paired-return`, {
      data: { returnDepartureAt: returnDepAt },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(ret.status()).toBe(422);
    const json = await ret.json();
    expect(json.error).toBe('no_reverse_route');
  });

  test('AC7: sales-toggle flips salesClosed', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const depAt = new Date(Date.now() + 86400 * 1000 * 6).toISOString();
    const created = await request.post('/api/op/trips', {
      data: { routeId: ctx.routeABId, busId: ctx.busAId, departureAt: depAt, price: 75000 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    const trip = (await created.json()).trip;
    expect(trip.salesClosed).toBe(false);
    const tripId = trip.id;

    const close = await request.post(`/api/op/trips/${tripId}/sales-toggle`, {
      data: { salesClosed: true },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(close.status()).toBe(200);
    expect((await close.json()).trip.salesClosed).toBe(true);

    const reopen = await request.post(`/api/op/trips/${tripId}/sales-toggle`, {
      data: { salesClosed: false },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(reopen.status()).toBe(200);
    expect((await reopen.json()).trip.salesClosed).toBe(false);
  });
});
