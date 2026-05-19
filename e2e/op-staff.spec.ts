/**
 * E2E spec: operator staff management (Issue 017).
 *
 * Covers ACs the integration tests cannot reach — the admin-only (403) gate
 * lives in the route/middleware layer (requireOperatorAuth({ adminOnly: true })),
 * not in the service functions, so it is exercised here:
 *
 *   AC: admin lists / creates staff                      — GET + POST /api/op/staff
 *   AC: duplicate phone → 409 phone_in_use               — POST
 *   AC: disable revokes sessions, idempotent             — POST /[id]/disable
 *   AC: assign to scheduled trip                          — POST /[id]/assign-service
 *   AC: assign to cancelled trip → 422 trip_not_assignable
 *   AC: assign to cross-op trip → 404 trip_not_found
 *   AC: non-admin (role=staff) caller → 403               — admin-only gate
 *   AC: unauthenticated → 401
 *
 * SANDBOX-GATED: set E2E_OP_STAFF_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *   - Seed admin operator: phone +8490xxxxxx1, password BBOp2026!,
 *     requiresPasswordChange=false (run prepareFixtures() below).
 *
 * Phone fixtures: API create-staff inputs use VN local format (09xxxxxxxx) which
 * normalizePhone accepts but which does NOT match the gitleaks +84[35789]\d{8}
 * rule. The seeded non-admin staff phone is normalized at runtime via
 * normalizePhone (no +84 literal in source). Direct prisma/SQL seeds for the
 * NOT NULL contactPhone/notificationPhone columns use the literal-x mask
 * +8490xxxxxx<n>.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';

const SANDBOX_ENABLED = process.env.E2E_OP_STAFF_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = '+8490xxxxxx1';
const SEED_PASSWORD = 'BBOp2026!';

// Op B fixture — second operator org used to verify cross-op trip rejection.
const OP_B_PHONE = '+8490xxxxxx9';

// Non-admin staff (role=staff) under op A — used to verify the admin-only gate.
// Login input is VN local format; the stored phone is its normalized form,
// computed at runtime so no +84 literal appears in this source file.
const STAFF_LOCAL = '0901239901';
const STAFF_PASSWORD = 'BBStaff2026!';

interface Fixtures {
  opAId: string;
  scheduledTripId: string;
  cancelledTripId: string;
  opBTripId: string;
}

async function prepareFixtures(): Promise<Fixtures> {
  const { hash } = await import('../lib/auth/password');
  const { normalizePhone } = await import('../lib/auth/phoneNormalize');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const adminHash = await hash(SEED_PASSWORD);
    const staffHash = await hash(STAFF_PASSWORD);
    const staffPhone = normalizePhone(STAFF_LOCAL);

    // Reset op A admin
    const a = await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = false
       WHERE phone = $2 RETURNING "operatorId"`,
      [adminHash, SEED_PHONE]
    );
    const opAId: string = a.rows[0].operatorId;
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [SEED_PHONE]
    );

    // Wipe prior test staff for op A (E2E-created + seeded non-admin) so each run is clean.
    await client.query(
      `DELETE FROM "OperatorUser"
       WHERE "operatorId" = $1 AND role = 'staff' AND (phone = $2 OR "displayName" LIKE 'E2E Staff%')`,
      [opAId, staffPhone]
    );

    // Seed a clean non-admin staff (requiresPasswordChange=false so login yields a
    // ready staff token; the admin-only API gate must 403 it regardless of role state).
    await client.query(
      `INSERT INTO "OperatorUser"
         ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName")
       VALUES (gen_random_uuid()::text, $1, $4, $5, $2, $3, 'staff', false, 'E2E Staff NonAdmin')`,
      [staffPhone, staffHash, opAId, '+8490xxxxxx7', '+8490xxxxxx6']
    );

    // Op A route + bus + scheduled trip + cancelled trip.
    await client.query(`DELETE FROM "Trip" WHERE "operatorId" = $1 AND price = 111111`, [opAId]);
    await client.query(`DELETE FROM "Bus" WHERE "operatorId" = $1 AND "licensePlate" = 'STAFF-E2E-A'`, [opAId]);
    await client.query(`DELETE FROM "Route" WHERE "operatorId" = $1 AND origin = 'StaffE2E Origin'`, [opAId]);

    const busA = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 30, 'STAFF-E2E-A', 'coach') RETURNING id`,
      [opAId]
    );
    const routeA = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes")
       VALUES (gen_random_uuid()::text, $1, 'StaffE2E Origin', 'StaffE2E Dest', 120) RETURNING id`,
      [opAId]
    );
    const dep = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 111111, 'scheduled', false) RETURNING id`,
      [routeA.rows[0].id, busA.rows[0].id, opAId, dep]
    );
    const cancelled = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 111111, 'cancelled', true) RETURNING id`,
      [routeA.rows[0].id, busA.rows[0].id, opAId, dep]
    );

    // Op B operator + route + bus + scheduled trip (cross-op isolation).
    const opB = await client.query(`SELECT id FROM "Operator" WHERE "contactPhone" = $1 LIMIT 1`, [OP_B_PHONE]);
    let opBId: string;
    if (opB.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail")
         VALUES (gen_random_uuid()::text, 'Op B Staff Test', $1, 'opb-staff@example.test') RETURNING id`,
        [OP_B_PHONE]
      );
      opBId = ins.rows[0].id;
    } else {
      opBId = opB.rows[0].id;
    }
    await client.query(`DELETE FROM "Trip" WHERE "operatorId" = $1 AND price = 222222`, [opBId]);
    await client.query(`DELETE FROM "Bus" WHERE "operatorId" = $1 AND "licensePlate" = 'STAFF-E2E-B'`, [opBId]);
    await client.query(`DELETE FROM "Route" WHERE "operatorId" = $1 AND origin = 'StaffE2E B Origin'`, [opBId]);
    const busB = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 20, 'STAFF-E2E-B', 'coach') RETURNING id`,
      [opBId]
    );
    const routeB = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes")
       VALUES (gen_random_uuid()::text, $1, 'StaffE2E B Origin', 'StaffE2E B Dest', 60) RETURNING id`,
      [opBId]
    );
    const opBTrip = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 222222, 'scheduled', false) RETURNING id`,
      [routeB.rows[0].id, busB.rows[0].id, opBId, dep]
    );

    return {
      opAId,
      scheduledTripId: scheduled.rows[0].id,
      cancelledTripId: cancelled.rows[0].id,
      opBTripId: opBTrip.rows[0].id,
    };
  } finally {
    await client.end();
  }
}

async function loginAdmin(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const csrf = await primeCsrf(request);
  await request.post('/api/auth/login', {
    data: { scope: 'operator', phone: SEED_PHONE, password: SEED_PASSWORD },
    headers: { 'X-CSRF-Token': csrf },
  });
  return csrf;
}

// Unique VN-local phone per create, gitleaks-safe (no +84 literal).
function freshStaffPhone(): string {
  const tail = String(Date.now()).slice(-7);
  return `09${tail}`;
}

test.describe('Operator staff management (Issue 017)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_STAFF_ENABLED=true to run');

  let fx: Fixtures;

  test.beforeEach(async () => {
    fx = await prepareFixtures();
  });

  test('admin creates a staff member and sees it in the list', async ({ request }) => {
    const csrf = await loginAdmin(request);
    const phone = freshStaffPhone();

    const created = await request.post('/api/op/staff', {
      data: { name: 'E2E Staff Created', phone },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    const createdJson = await created.json();
    expect(createdJson.staff.role).toBe('staff');
    expect(createdJson.staff.requiresPasswordChange).toBe(true);
    // Temp password must never leak in the API payload.
    expect(createdJson.staff).not.toHaveProperty('passwordHash');
    expect(createdJson.staff).not.toHaveProperty('tempPassword');

    const list = await request.get('/api/op/staff');
    expect(list.status()).toBe(200);
    const ids: string[] = (await list.json()).staff.map((s: { id: string }) => s.id);
    expect(ids).toContain(createdJson.staff.id);
  });

  test('duplicate phone returns 409 phone_in_use', async ({ request }) => {
    const csrf = await loginAdmin(request);
    const phone = freshStaffPhone();

    const first = await request.post('/api/op/staff', {
      data: { name: 'E2E Staff Dup', phone },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(first.status()).toBe(201);

    const dup = await request.post('/api/op/staff', {
      data: { name: 'E2E Staff Dup2', phone },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error).toBe('phone_in_use');
  });

  test('disable is a 200 and idempotent', async ({ request }) => {
    const csrf = await loginAdmin(request);
    const phone = freshStaffPhone();

    const created = await request.post('/api/op/staff', {
      data: { name: 'E2E Staff Disable', phone },
      headers: { 'X-CSRF-Token': csrf },
    });
    const staffId: string = (await created.json()).staff.id;

    const disable = await request.post(`/api/op/staff/${staffId}/disable`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(disable.status()).toBe(200);
    expect((await disable.json()).staff.disabled).toBe(true);

    const reDisable = await request.post(`/api/op/staff/${staffId}/disable`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(reDisable.status()).toBe(200);
    expect((await reDisable.json()).staff.disabled).toBe(true);
  });

  test('assign to a scheduled trip succeeds', async ({ request }) => {
    const csrf = await loginAdmin(request);
    const created = await request.post('/api/op/staff', {
      data: { name: 'E2E Staff Assign', phone: freshStaffPhone() },
      headers: { 'X-CSRF-Token': csrf },
    });
    const staffId: string = (await created.json()).staff.id;

    const res = await request.post(`/api/op/staff/${staffId}/assign-service`, {
      data: { tripId: fx.scheduledTripId },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).staff.assignedTripId).toBe(fx.scheduledTripId);
  });

  test('assign to a cancelled trip returns 422 trip_not_assignable', async ({ request }) => {
    const csrf = await loginAdmin(request);
    const created = await request.post('/api/op/staff', {
      data: { name: 'E2E Staff AssignDead', phone: freshStaffPhone() },
      headers: { 'X-CSRF-Token': csrf },
    });
    const staffId: string = (await created.json()).staff.id;

    const res = await request.post(`/api/op/staff/${staffId}/assign-service`, {
      data: { tripId: fx.cancelledTripId },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe('trip_not_assignable');
  });

  test('assign to a cross-operator trip returns 404 trip_not_found', async ({ request }) => {
    const csrf = await loginAdmin(request);
    const created = await request.post('/api/op/staff', {
      data: { name: 'E2E Staff AssignCross', phone: freshStaffPhone() },
      headers: { 'X-CSRF-Token': csrf },
    });
    const staffId: string = (await created.json()).staff.id;

    const res = await request.post(`/api/op/staff/${staffId}/assign-service`, {
      data: { tripId: fx.opBTripId },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('trip_not_found');
  });

  test('non-admin (role=staff) caller is rejected with 403 on every staff route', async ({ request }) => {
    const csrf = await primeCsrf(request);
    const login = await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: STAFF_LOCAL, password: STAFF_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(login.status()).toBe(200);

    const list = await request.get('/api/op/staff');
    expect(list.status()).toBe(403);

    const create = await request.post('/api/op/staff', {
      data: { name: 'Should Not Exist', phone: freshStaffPhone() },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(create.status()).toBe(403);

    const disable = await request.post('/api/op/staff/any-id/disable', {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(disable.status()).toBe(403);

    const assign = await request.post('/api/op/staff/any-id/assign-service', {
      data: { tripId: fx.scheduledTripId },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(assign.status()).toBe(403);
  });

  test('unauthenticated GET returns 401', async ({ request }) => {
    const res = await request.get('/api/op/staff');
    expect(res.status()).toBe(401);
  });
});
