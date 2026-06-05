/**
 * E2E spec: operator staff-scoped client (Issue 018).
 *
 * Staff users (OperatorUser.role='staff') see ONLY their assigned trip
 * (OperatorUser.assignedTripId, set by Issue 017 assign-service). The
 * staff-scope guard in lib/auth/requireOperatorAuth.ts constrains the Issue 014
 * endpoints; cross-trip / mismatched tripId returns 404 (NOT 403 — never leak
 * the existence of another operator's-or-trip's data). assignedTripId=null gets
 * 404 on trip-scoped endpoints and an empty-state dashboard.
 *
 * Covers ACs the unit tests cannot reach — these exercise the real route
 * wiring (staffTripScope resolvers + bookings auto-scope) end to end:
 *
 *   AC: staff login lands on /op/staff/dashboard single-trip view
 *   AC: staff GET /api/op/bookings (no filter) → only assigned-trip bookings
 *   AC: staff GET /api/op/bookings?tripId=<assigned> → ok
 *   AC: staff GET /api/op/bookings?tripId=<other>    → 404 not_found
 *   AC: staff GET /api/op/manifest/<other>           → 404 not_found
 *   AC: staff POST /api/op/trips/<assigned>/depart   → ok (then complete ok)
 *   AC: staff POST /api/op/trips/<other>/depart      → 404 not_found
 *   AC: staff with assignedTripId=null → empty-state page + 404 on trip-scoped
 *   AC: re-assignment switches scope on the NEXT request
 *
 * SANDBOX-GATED: set E2E_OP_STAFF_CLIENT_ENABLED=true to run.
 *   - Requires running dev server with seeded DB (assignedTripId column present;
 *     migration 20260519190000_issue_017_staff_trip_assignment applied)
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 *
 * Phone fixtures: staff logins use VN local format (09xxxxxxxx) normalized at
 * runtime via normalizePhone (no +84 literal in source). Direct SQL seeds for
 * the NOT NULL contactPhone/notificationPhone columns use the literal-x mask
 * +8490xxxxxx<n> (escapes the gitleaks +84[35789]\d{8} rule).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/core/validation/phone';

const SANDBOX_ENABLED = process.env.E2E_OP_STAFF_CLIENT_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = normalizePhone('0901230001');
const SEED_PASSWORD = 'BBOp2026!';

// Staff assigned to the scheduled trip.
const ASSIGNED_LOCAL = '0901240001';
const ASSIGNED_PASSWORD = 'BBStaff2026!';

// Staff with no trip assignment (assignedTripId=null) → empty state.
const UNASSIGNED_LOCAL = '0901240002';
const UNASSIGNED_PASSWORD = 'BBStaff2026!';

interface Fixtures {
  opAId: string;
  assignedTripId: string;
  otherTripId: string;
  assignedStaffId: string;
  unassignedStaffId: string;
}

async function prepareFixtures(): Promise<Fixtures> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const adminHash = await hash(SEED_PASSWORD);
    const assignedHash = await hash(ASSIGNED_PASSWORD);
    const unassignedHash = await hash(UNASSIGNED_PASSWORD);
    const assignedPhone = normalizePhone(ASSIGNED_LOCAL);
    const unassignedPhone = normalizePhone(UNASSIGNED_LOCAL);

    // Reset op A admin (used only to resolve operatorId for seeding).
    const a = await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = false
       WHERE phone = $2 RETURNING "operatorId"`,
      [adminHash, SEED_PHONE]
    );
    const opAId: string = a.rows[0].operatorId;

    // Wipe prior test staff for op A.
    await client.query(
      `DELETE FROM "OperatorUser"
       WHERE "operatorId" = $1 AND role = 'staff'
         AND (phone IN ($2, $3) OR "displayName" LIKE 'E2E StaffClient%')`,
      [opAId, assignedPhone, unassignedPhone]
    );

    // Op A route + bus + two scheduled trips (assigned + "other").
    // FK-ordered cleanup of prior-run trips (price=133331 marker) and their
    // children. The depart→complete test creates a Payout + NotificationLog
    // referencing these trips' bookings; delete those before the Trip rows.
    const priorTrips = `SELECT id FROM "Trip" WHERE "operatorId" = $1 AND price = 133331`;
    await client.query(`DELETE FROM "Payout" WHERE "tripId" IN (${priorTrips})`, [opAId]);
    await client.query(
      `DELETE FROM "NotificationLog" WHERE "bookingId" IN
         (SELECT id FROM "Booking" WHERE "tripId" IN (${priorTrips}))`,
      [opAId]
    );
    await client.query(
      `DELETE FROM "PaymentEvent" WHERE "bookingId" IN
         (SELECT id FROM "Booking" WHERE "tripId" IN (${priorTrips}))`,
      [opAId]
    );
    await client.query(`DELETE FROM "Booking" WHERE "tripId" IN (${priorTrips})`, [opAId]);
    await client.query(`DELETE FROM "Trip" WHERE "operatorId" = $1 AND price = 133331`, [opAId]);
    await client.query(`DELETE FROM "Bus" WHERE "operatorId" = $1 AND "licensePlate" = 'STAFFCLI-A'`, [opAId]);
    await client.query(`DELETE FROM "Route" WHERE "operatorId" = $1 AND origin = 'StaffCli Origin'`, [opAId]);

    const busA = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 30, 'STAFFCLI-A', 'coach') RETURNING id`,
      [opAId]
    );
    const routeA = await client.query(
      `INSERT INTO "Route" ("id","operatorId","origin","destination","durationMinutes","updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'StaffCli Origin', 'StaffCli Dest', 120, NOW()) RETURNING id`,
      [opAId]
    );
    const dep = new Date(Date.now() + 86_400_000).toISOString();
    const assignedTrip = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 133331, 'scheduled', false, NOW()) RETURNING id`,
      [routeA.rows[0].id, busA.rows[0].id, opAId, dep]
    );
    const otherTrip = await client.query(
      `INSERT INTO "Trip" ("id","routeId","busId","operatorId","departureAt","price","status","salesClosed","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 133331, 'scheduled', false, NOW()) RETURNING id`,
      [routeA.rows[0].id, busA.rows[0].id, opAId, dep]
    );
    const assignedTripId: string = assignedTrip.rows[0].id;
    const otherTripId: string = otherTrip.rows[0].id;

    // Seed assigned staff (assignedTripId set) + unassigned staff (null).
    const assigned = await client.query(
      `INSERT INTO "OperatorUser"
         ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName","assignedTripId","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $4, $5, $2, $3, 'staff', false, 'E2E StaffClient Assigned', $6, NOW())
       RETURNING id`,
      [assignedPhone, assignedHash, opAId, '+8490xxxxxx7', '+8490xxxxxx6', assignedTripId]
    );
    const unassigned = await client.query(
      `INSERT INTO "OperatorUser"
         ("id","phone","contactPhone","notificationPhone","passwordHash","operatorId","role","requiresPasswordChange","displayName","assignedTripId","updatedAt")
       VALUES (gen_random_uuid()::text, $1, $4, $5, $2, $3, 'staff', false, 'E2E StaffClient Unassigned', NULL, NOW())
       RETURNING id`,
      [unassignedPhone, unassignedHash, opAId, '+8490xxxxxx5', '+8490xxxxxx4']
    );

    return {
      opAId,
      assignedTripId,
      otherTripId,
      assignedStaffId: assigned.rows[0].id,
      unassignedStaffId: unassigned.rows[0].id,
    };
  } finally {
    await client.end();
  }
}

async function reassignStaff(staffId: string, tripId: string | null): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(`UPDATE "OperatorUser" SET "assignedTripId" = $2 WHERE id = $1`, [
      staffId,
      tripId,
    ]);
  } finally {
    await client.end();
  }
}

async function loginStaff(
  request: import('@playwright/test').APIRequestContext,
  localPhone: string,
  password: string
): Promise<string> {
  const csrf = await primeCsrf(request);
  const res = await request.post('/api/auth/login', {
    data: { scope: 'operator', phone: localPhone, password },
    headers: { 'X-CSRF-Token': csrf },
  });
  expect(res.status()).toBe(200);
  return csrf;
}

test.describe('Operator staff-scoped client (Issue 018)', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_STAFF_CLIENT_ENABLED=true to run');

  let fx: Fixtures;

  test.beforeEach(async () => {
    fx = await prepareFixtures();
  });

  test('assigned staff lands on the single-trip dashboard', async ({ page }) => {
    // Auth via page.request so the session cookie lands in the page's context
    // jar — the standalone `request` fixture has a separate cookie jar that the
    // browser navigation can't see.
    await loginStaff(page.request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);
    await page.goto('/op/staff/dashboard');
    // Single-trip view: queue + manifest tabs render; no admin nav.
    await expect(page.getByTestId('tab-queue')).toBeVisible();
    await expect(page.getByTestId('tab-manifest')).toBeVisible();
    await expect(page.getByTestId('staff-empty-state')).toHaveCount(0);
  });

  test('staff GET /api/op/bookings (no filter) returns only the assigned trip', async ({
    request,
  }) => {
    await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);
    const res = await request.get('/api/op/bookings');
    expect(res.status()).toBe(200);
    const rows: Array<{ tripId?: string }> = (await res.json()).rows ?? [];
    // Auto-scope: every returned row belongs to the assigned trip (zero rows is
    // valid — the assertion is that no OTHER trip's bookings leak through).
    for (const row of rows) {
      if (row.tripId !== undefined) {
        expect(row.tripId).toBe(fx.assignedTripId);
      }
    }
  });

  test('staff GET /api/op/bookings?tripId=<assigned> is allowed', async ({ request }) => {
    await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);
    const res = await request.get(`/api/op/bookings?tripId=${fx.assignedTripId}`);
    expect(res.status()).toBe(200);
  });

  test('staff GET /api/op/bookings?tripId=<other> returns 404 not_found', async ({ request }) => {
    await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);
    const res = await request.get(`/api/op/bookings?tripId=${fx.otherTripId}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  test('staff GET /api/op/manifest/<other> returns 404 not_found', async ({ request }) => {
    await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);
    const res = await request.get(`/api/op/manifest/${fx.otherTripId}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  test('staff GET /api/op/manifest/<assigned> is allowed', async ({ request }) => {
    await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);
    const res = await request.get(`/api/op/manifest/${fx.assignedTripId}`);
    expect(res.status()).toBe(200);
  });

  test('staff can depart then complete the assigned trip', async ({ request }) => {
    const csrf = await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);

    const depart = await request.post(`/api/op/trips/${fx.assignedTripId}/depart`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(depart.status()).toBe(200);
    expect((await depart.json()).trip.status).toBe('departed');

    const complete = await request.post(`/api/op/trips/${fx.assignedTripId}/complete`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(complete.status()).toBe(200);
    expect((await complete.json()).trip.status).toBe('completed');
  });

  test('staff POST depart on a different trip returns 404 not_found', async ({ request }) => {
    const csrf = await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);
    const res = await request.post(`/api/op/trips/${fx.otherTripId}/depart`, {
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  test('unassigned staff sees the empty state and gets 404 on trip-scoped reads', async ({
    page,
  }) => {
    // Auth + API reads via page.request so both share the page's cookie jar.
    await loginStaff(page.request, UNASSIGNED_LOCAL, UNASSIGNED_PASSWORD);

    await page.goto('/op/staff/dashboard');
    await expect(page.getByTestId('staff-empty-state')).toBeVisible();

    // Trip-scoped read with any tripId → 404 (no assignment).
    const res = await page.request.get(`/api/op/manifest/${fx.assignedTripId}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });

  test('re-assignment switches scope on the next request', async ({ request }) => {
    await loginStaff(request, ASSIGNED_LOCAL, ASSIGNED_PASSWORD);

    // Initially assigned to assignedTripId → otherTrip is a 404.
    const before = await request.get(`/api/op/manifest/${fx.otherTripId}`);
    expect(before.status()).toBe(404);

    // Admin re-assigns to otherTrip (Issue 017). assignedTripId is read fresh
    // per request, so the next call flips: otherTrip now allowed, the old trip 404.
    await reassignStaff(fx.assignedStaffId, fx.otherTripId);

    const afterOther = await request.get(`/api/op/manifest/${fx.otherTripId}`);
    expect(afterOther.status()).toBe(200);

    const afterOld = await request.get(`/api/op/manifest/${fx.assignedTripId}`);
    expect(afterOld.status()).toBe(404);
    expect((await afterOld.json()).error).toBe('not_found');
  });
});
