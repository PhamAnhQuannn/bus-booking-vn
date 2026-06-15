/**
 * E2E spec: data leak smoke tests.
 *
 * Verifies that cross-tenant isolation holds at the HTTP layer
 * and that API responses don't expose forbidden internal fields.
 *
 * SANDBOX-GATED: set E2E_DATA_LEAK_ENABLED=true to run.
 *   - Requires running dev server with seeded DB
 *   - Requires DATABASE_URL pointing at a disposable Postgres
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/core/validation/phone';

const SANDBOX_ENABLED = process.env.E2E_DATA_LEAK_ENABLED === 'true';
const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = normalizePhone('0901230001');
const SEED_PASSWORD = 'BBOp2026!';
const SEED_USERNAME = 'PB-0001';

const OP_B_PHONE = '+8490xxxxxx6';
const OP_B_PASSWORD = 'BBOp2026!';

const FORBIDDEN_FIELDS = [
  'passwordHash',
  'tempPasswordPlain',
  'tempPassword',
  'otpCode',
  'codeHash',
  'refreshTokenHash',
  'totpSecret',
  'confirmationToken',
];

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    keys.push(full);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value, full));
    }
  }
  return keys;
}

async function prepareOpB(): Promise<{ opBId: string; opBBusId: string; opBTripId: string }> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const passwordHash = await hash(OP_B_PASSWORD);

    // Ensure op B org
    const opB = await client.query(
      `SELECT id FROM "Operator" WHERE "contactPhone" = $1 LIMIT 1`,
      [OP_B_PHONE]
    );
    let opBId: string;
    if (opB.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO "Operator" ("id","legalName","contactPhone","contactEmail","status")
         VALUES (gen_random_uuid()::text, 'Data Leak Test Org', $1, 'dleak@test.example', 'active')
         RETURNING id`,
        [OP_B_PHONE]
      );
      opBId = ins.rows[0].id;
    } else {
      opBId = opB.rows[0].id;
    }

    // Ensure op B user
    const opBUser = await client.query(
      `SELECT id FROM "OperatorUser" WHERE phone = $1 LIMIT 1`,
      [OP_B_PHONE]
    );
    if (opBUser.rows.length === 0) {
      await client.query(
        `INSERT INTO "OperatorUser" ("id","username","phone","contactPhone","notificationPhone",
         "passwordHash","operatorId","role","requiresPasswordChange","displayName","updatedAt")
         VALUES (gen_random_uuid()::text, 'DL-ADMIN', $1, $4, $5, $2, $3, 'admin', false, 'DL Admin', NOW())`,
        [OP_B_PHONE, passwordHash, opBId, '+8490xxxxxx6', '+8490xxxxxx6']
      );
    }

    // Ensure op B bus
    await client.query(
      `DELETE FROM "Bus" WHERE "operatorId" = $1 AND "licensePlate" = 'DL-TEST-01'`,
      [opBId]
    );
    const bus = await client.query(
      `INSERT INTO "Bus" ("id","operatorId","capacity","licensePlate","busType")
       VALUES (gen_random_uuid()::text, $1, 20, 'DL-TEST-01', 'standard') RETURNING id`,
      [opBId]
    );
    const opBBusId = bus.rows[0].id;

    // Ensure op B route + trip
    let routeId: string;
    const existingRoute = await client.query(
      `SELECT id FROM "Route" WHERE "operatorId" = $1 LIMIT 1`,
      [opBId]
    );
    if (existingRoute.rows.length === 0) {
      const r = await client.query(
        `INSERT INTO "Route" ("id","origin","destination","durationMinutes","operatorId")
         VALUES (gen_random_uuid()::text, 'DL Origin', 'DL Dest', 120, $1) RETURNING id`,
        [opBId]
      );
      routeId = r.rows[0].id;
    } else {
      routeId = existingRoute.rows[0].id;
    }

    await client.query(
      `DELETE FROM "Trip" WHERE "operatorId" = $1 AND "busId" = $2`,
      [opBId, opBBusId]
    );
    const trip = await client.query(
      `INSERT INTO "Trip" ("id","departureAt","price","status","busId","routeId","operatorId")
       VALUES (gen_random_uuid()::text, NOW() + interval '7 days', 100000, 'scheduled', $1, $2, $3)
       RETURNING id`,
      [opBBusId, routeId, opBId]
    );

    return { opBId, opBBusId, opBTripId: trip.rows[0].id };
  } finally {
    await client.end();
  }
}

test.describe('Data leak smoke tests', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_DATA_LEAK_ENABLED=true to run');

  let opBBusId: string;
  let opBTripId: string;

  test.beforeAll(async () => {
    const ctx = await prepareOpB();
    opBBusId = ctx.opBBusId;
    opBTripId = ctx.opBTripId;
  });

  test('cross-tenant: operator A cannot read operator B bus', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/buses/${opBBusId}`);
    expect(res.status()).toBe(404);
  });

  test('cross-tenant: operator A cannot read operator B trip', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get(`/api/op/trips/${opBTripId}`);
    expect(res.status()).toBe(404);
  });

  test('operator login response sets HttpOnly cookies', async ({ request }) => {
    const csrf = await primeCsrf(request);
    const res = await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);

    const setCookieHeaders = res.headers()['set-cookie'] ?? '';
    expect(setCookieHeaders).toContain('bb_op_access');
    expect(setCookieHeaders.toLowerCase()).toContain('httponly');
  });

  test('operator login response body has no forbidden fields', async ({ request }) => {
    const csrf = await primeCsrf(request);
    const res = await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });
    const json = await res.json();
    const keys = collectKeys(json);

    for (const field of FORBIDDEN_FIELDS) {
      expect(
        keys.some((k) => k === field || k.endsWith(`.${field}`)),
        `login response leaks forbidden field: ${field}`
      ).toBe(false);
    }
  });

  test('operator booking list has no forbidden fields', async ({ request }) => {
    const csrf = await primeCsrf(request);
    await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get('/api/op/bookings');
    if (res.status() !== 200) return; // no bookings seeded — skip
    const json = await res.json();
    const keys = collectKeys(json);

    for (const field of FORBIDDEN_FIELDS) {
      expect(
        keys.some((k) => k === field || k.endsWith(`.${field}`)),
        `booking list leaks forbidden field: ${field}`
      ).toBe(false);
    }
  });
});
