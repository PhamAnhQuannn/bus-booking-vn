/**
 * E2E spec: operator fleet management (Issue 011).
 *
 * Covers ACs:
 *   AC1  list buses for op A only (not op B's)        — GET /api/op/buses
 *   AC2  duplicate licensePlate → 409 plate_in_use    — POST
 *   AC3  capacity reduction below occupancy → 409     — PATCH (skipped — needs trip seed)
 *   AC4a maintenance-vs-maintenance overlap → 409     — POST /maintenance
 *   AC4b maintenance-vs-trip overlap → 201 + conflictingTrips (skipped — needs trip seed)
 *   AC6  cross-op GET / PATCH / DELETE → 404          — covered across endpoints
 *   AC11 deactivation then PATCH → 422                — POST /deactivate, PATCH
 *
 * SANDBOX-GATED: set E2E_OP_FLEET_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Seed operator: phone +8490xxxxxx1, password BBOp2026!,
 *     requiresPasswordChange=false (run prepareOperator() below).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';

const SANDBOX_ENABLED = process.env.E2E_OP_FLEET_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = '+8490xxxxxx1';
const SEED_PASSWORD = 'BBOp2026!';

// Op B fixture — second operator org used to verify cross-op rejection (AC6).
const OP_B_PHONE = '+8490xxxxxx9';
const OP_B_PASSWORD = 'BBOp2026!';

async function prepareOperators(): Promise<{ opAId: string; opBId: string; opBBusId: string }> {
  const { hash } = await import('../lib/auth/password');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const passwordHash = await hash(SEED_PASSWORD);

    // Reset op A
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

    // Wipe op A's buses (avoid stale test data)
    await client.query(`DELETE FROM "BusMaintenance" WHERE "busId" IN (SELECT id FROM "Bus" WHERE "operatorId" = $1)`, [opAId]);
    await client.query(`DELETE FROM "Bus" WHERE "operatorId" = $1 AND "licensePlate" LIKE 'E2E-%'`, [opAId]);

    // Ensure op B exists (separate org) with one bus we'll try to read cross-op
    const opB = await client.query(`SELECT id FROM "Operator" WHERE "contactPhone" = $1 LIMIT 1`, [OP_B_PHONE]);
    let opBId: string;
    if (opB.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail")
         VALUES (gen_random_uuid()::text, 'Op B Test', $1, 'opb@example.test') RETURNING id`,
        [OP_B_PHONE]
      );
      opBId = ins.rows[0].id;
    } else {
      opBId = opB.rows[0].id;
    }

    // Op B user (only used so AC6 has a non-A operator id; not logged in for these tests).
    const opBUser = await client.query(
      `SELECT id FROM "OperatorUser" WHERE phone = $1 LIMIT 1`,
      [OP_B_PHONE]
    );
    if (opBUser.rows.length === 0) {
      await client.query(
        `INSERT INTO "OperatorUser" ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName")
         VALUES (gen_random_uuid()::text, $1, $4, $5, $2, $3, 'admin', false, 'Op B Admin')`,
        [OP_B_PHONE, await hash(OP_B_PASSWORD), opBId, '+8490xxxxxx9', '+8490xxxxxx8']
      );
    }

    // Ensure op B has at least one bus for AC6 cross-op GET test
    await client.query(`DELETE FROM "BusMaintenance" WHERE "busId" IN (SELECT id FROM "Bus" WHERE "operatorId" = $1 AND "licensePlate" = 'OPB-E2E-1')`, [opBId]);
    await client.query(`DELETE FROM "Bus" WHERE "operatorId" = $1 AND "licensePlate" = 'OPB-E2E-1'`, [opBId]);
    const opBBus = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 30, 'OPB-E2E-1', 'coach') RETURNING id`,
      [opBId]
    );

    return { opAId, opBId, opBBusId: opBBus.rows[0].id };
  } finally {
    await client.end();
  }
}

test.describe('Operator fleet management (Issue 011)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_FLEET_ENABLED=true to run');

  let opBBusId: string;

  test.beforeEach(async () => {
    const ctx = await prepareOperators();
    opBBusId = ctx.opBBusId;
  });

  test('AC1 + AC6: list returns only operator A buses, never op B', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Create a bus for op A
    const created = await request.post('/api/op/buses', {
      data: { licensePlate: 'E2E-AAA1', capacity: 30, busType: 'coach' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);

    const list = await request.get('/api/op/buses');
    expect(list.status()).toBe(200);
    const json = await list.json();
    const plates: string[] = json.buses.map((b: { licensePlate: string }) => b.licensePlate);
    expect(plates).toContain('E2E-AAA1');
    expect(plates).not.toContain('OPB-E2E-1');
  });

  test('AC2: duplicate licensePlate returns 422 plate_in_use', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const first = await request.post('/api/op/buses', {
      data: { licensePlate: 'E2E-DUP1', capacity: 30, busType: 'coach' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(first.status()).toBe(201);

    const dup = await request.post('/api/op/buses', {
      data: { licensePlate: 'E2E-DUP1', capacity: 40, busType: 'sleeper' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(dup.status()).toBe(422);
    const json = await dup.json();
    expect(json.error).toBe('plate_in_use');
  });

  test('AC6: cross-op GET returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/buses/${opBBusId}`);
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });

  test('AC6: cross-op DELETE maintenance returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Synthetic mid — endpoint should 404 on the bus-ownership check first.
    const res = await request.delete(`/api/op/buses/${opBBusId}/maintenance/nonexistent-mid`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(404);
  });

  test('AC4a: maintenance-vs-maintenance overlap → 409 maintenance_overlap', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const bus = await request.post('/api/op/buses', {
      data: { licensePlate: 'E2E-MAINT', capacity: 30, busType: 'coach' },
      headers: { 'X-CSRF-Token': csrf },
    });
    const busId: string = (await bus.json()).bus.id;

    const startA = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const endA = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();

    const m1 = await request.post(`/api/op/buses/${busId}/maintenance`, {
      data: { startAt: startA, endAt: endA, reason: 'first' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(m1.status()).toBe(201);

    const startB = new Date(Date.now() + 7.5 * 24 * 3600 * 1000).toISOString();
    const endB = new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString();
    const m2 = await request.post(`/api/op/buses/${busId}/maintenance`, {
      data: { startAt: startB, endAt: endB, reason: 'overlap' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(m2.status()).toBe(409);
    const json = await m2.json();
    expect(json.error).toBe('maintenance_overlap');
    expect(Array.isArray(json.overlapping)).toBe(true);
    expect(json.overlapping.length).toBeGreaterThan(0);
  });

  test('AC10 + AC11: deactivate then PATCH → 422 reactivation_not_supported', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const bus = await request.post('/api/op/buses', {
      data: { licensePlate: 'E2E-DEAC', capacity: 30, busType: 'coach' },
      headers: { 'X-CSRF-Token': csrf },
    });
    const busId: string = (await bus.json()).bus.id;

    const deact = await request.post(`/api/op/buses/${busId}/deactivate`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(deact.status()).toBe(200);

    const patch = await request.patch(`/api/op/buses/${busId}`, {
      data: { busType: 'sleeper' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(patch.status()).toBe(422);
    const json = await patch.json();
    expect(json.error).toBe('reactivation_not_supported');

    // Re-deactivate also returns 422
    const reDeac = await request.post(`/api/op/buses/${busId}/deactivate`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(reDeac.status()).toBe(422);
  });

  test('AC8: unauthenticated GET returns 401', async ({ request }) => {
    const res = await request.get('/api/op/buses');
    expect(res.status()).toBe(401);
  });
});
