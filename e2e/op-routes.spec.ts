/**
 * E2E spec: operator route + pickup point management (Issue 012).
 *
 * Covers ACs:
 *   AC1  list routes for op A only (not op B's)          — GET /api/op/routes
 *   AC2  create route → 201                              — POST /api/op/routes
 *   AC3  PATCH route (edit) → 200                        — PATCH /api/op/routes/[id]
 *   AC4  deactivate route → 200; re-deactivate → 422     — POST /deactivate
 *   AC5  PATCH deactivated route → 422                   — PATCH after deactivate
 *   AC6  cross-op route GET → 404                        — GET /api/op/routes/[id]
 *   AC7  add pickup point → 201                          — POST /pickup-points
 *   AC8  bulk reorder pickup points → 200                — PATCH /pickup-points
 *   AC9  deactivate pickup point → 200                   — POST /pickup-points/[ppId]/deactivate
 *   AC10 GET /pickup-points on cross-op route → 404      — GET cross-op
 *
 * SANDBOX-GATED: set E2E_OP_ROUTES_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Seed operator: phone +8490xxxxxx1, password BBOp2026!,
 *     requiresPasswordChange=false (run prepareOperators() below).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';

const SANDBOX_ENABLED = process.env.E2E_OP_ROUTES_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = '+8490xxxxxx1';
const SEED_PASSWORD = 'BBOp2026!';

const OP_B_PHONE = '+8490xxxxxx9';
const OP_B_PASSWORD = 'BBOp2026!';

async function prepareOperators(): Promise<{
  opAId: string;
  opBId: string;
  opBRouteId: string;
}> {
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

    // Wipe op A test routes (E2E prefix)
    await client.query(
      `DELETE FROM "Route" WHERE "operatorId" = $1 AND origin LIKE 'E2E-%'`,
      [opAId]
    );

    // Ensure op B exists
    const opB = await client.query(
      `SELECT id FROM "Operator" WHERE "contactPhone" = $1 LIMIT 1`,
      [OP_B_PHONE]
    );
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

    // Op B user (not logged in — just for cross-op check)
    const opBUser = await client.query(
      `SELECT id FROM "OperatorUser" WHERE phone = $1 LIMIT 1`,
      [OP_B_PHONE]
    );
    if (opBUser.rows.length === 0) {
      await client.query(
        `INSERT INTO "OperatorUser" ("id","phone","passwordHash","operatorId","role","requiresPasswordChange","displayName")
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'admin', false, 'Op B Admin')`,
        [OP_B_PHONE, await hash(OP_B_PASSWORD), opBId]
      );
    }

    // Ensure op B has one route for cross-op tests
    await client.query(
      `DELETE FROM "Route" WHERE "operatorId" = $1 AND origin = 'OPB-E2E-Origin'`,
      [opBId]
    );
    const opBRoute = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'OPB-E2E-Origin', 'OPB-E2E-Dest', 120, NOW()) RETURNING id`,
      [opBId]
    );

    return { opAId, opBId, opBRouteId: opBRoute.rows[0].id };
  } finally {
    await client.end();
  }
}

test.describe('Operator route management (Issue 012)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_ROUTES_ENABLED=true to run');

  let opBRouteId: string;

  test.beforeEach(async () => {
    const ctx = await prepareOperators();
    opBRouteId = ctx.opBRouteId;
  });

  test('AC1 + AC6: list returns only op A routes, not op B', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const created = await request.post('/api/op/routes', {
      data: { origin: 'E2E-Hà Nội', destination: 'E2E-TP.HCM', durationMinutes: 900 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);

    const list = await request.get('/api/op/routes');
    expect(list.status()).toBe(200);
    const json = await list.json();
    const origins: string[] = json.routes.map((r: { origin: string }) => r.origin);
    expect(origins).toContain('E2E-Hà Nội');
    expect(origins).not.toContain('OPB-E2E-Origin');
  });

  test('AC2 + AC3: create then PATCH route', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const created = await request.post('/api/op/routes', {
      data: { origin: 'E2E-Patch-Origin', destination: 'E2E-Patch-Dest', durationMinutes: 60 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    const routeId: string = (await created.json()).route.id;

    const patched = await request.patch(`/api/op/routes/${routeId}`, {
      data: { durationMinutes: 90 },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(patched.status()).toBe(200);
    const pJson = await patched.json();
    expect(pJson.route.durationMinutes).toBe(90);
  });

  test('AC4 + AC5: deactivate then re-deactivate → 422; PATCH deactivated → 422', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const created = await request.post('/api/op/routes', {
      data: { origin: 'E2E-Deact-Origin', destination: 'E2E-Deact-Dest', durationMinutes: 60 },
      headers: { 'X-CSRF-Token': csrf },
    });
    const routeId: string = (await created.json()).route.id;

    const deact = await request.post(`/api/op/routes/${routeId}/deactivate`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(deact.status()).toBe(200);

    const reDeact = await request.post(`/api/op/routes/${routeId}/deactivate`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(reDeact.status()).toBe(422);
    expect((await reDeact.json()).error).toBe('already_deactivated');

    const patch = await request.patch(`/api/op/routes/${routeId}`, {
      data: { origin: 'Updated' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(patch.status()).toBe(422);
    expect((await patch.json()).error).toBe('reactivation_not_supported');
  });

  test('AC6: cross-op GET /api/op/routes/[id] returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/routes/${opBRouteId}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  test('AC7 + AC8 + AC9: add pickup points, reorder, deactivate one', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const created = await request.post('/api/op/routes', {
      data: { origin: 'E2E-PP-Origin', destination: 'E2E-PP-Dest', durationMinutes: 120 },
      headers: { 'X-CSRF-Token': csrf },
    });
    const routeId: string = (await created.json()).route.id;

    // AC7: add two pickup points
    const pp1Res = await request.post(`/api/op/routes/${routeId}/pickup-points`, {
      data: { name: 'Điểm A', address: 'Địa chỉ A' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(pp1Res.status()).toBe(201);
    const pp1Id: string = (await pp1Res.json()).pickupPoint.id;

    const pp2Res = await request.post(`/api/op/routes/${routeId}/pickup-points`, {
      data: { name: 'Điểm B', address: 'Địa chỉ B' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(pp2Res.status()).toBe(201);
    const pp2Id: string = (await pp2Res.json()).pickupPoint.id;

    // AC8: reorder B before A
    const reorder = await request.patch(`/api/op/routes/${routeId}/pickup-points`, {
      data: { orderedIds: [pp2Id, pp1Id] },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(reorder.status()).toBe(200);
    const rJson = await reorder.json();
    expect(rJson.pickupPoints[0].id).toBe(pp2Id);
    expect(rJson.pickupPoints[1].id).toBe(pp1Id);

    // AC9: deactivate pp1
    const deact = await request.post(`/api/op/routes/${routeId}/pickup-points/${pp1Id}/deactivate`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(deact.status()).toBe(200);

    // Re-deactivate pp1 → 422
    const reDeact = await request.post(`/api/op/routes/${routeId}/pickup-points/${pp1Id}/deactivate`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(reDeact.status()).toBe(422);
    expect((await reDeact.json()).error).toBe('already_deactivated');
  });

  test('AC10: cross-op GET /pickup-points returns 404', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/routes/${opBRouteId}/pickup-points`);
    expect(res.status()).toBe(404);
  });

  test('AC8-unauthenticated: GET /api/op/routes returns 401', async ({ request }) => {
    const res = await request.get('/api/op/routes');
    expect(res.status()).toBe(401);
  });
});
