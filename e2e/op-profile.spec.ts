/**
 * E2E spec: operator profile GET + PATCH (Issue 010)
 *
 * Prerequisites:
 *   - Running dev server with seeded DB
 *   - Seed operator: phone +8490xxxxxx1, password BBOp2026!
 *   - requiresPasswordChange must be false for profile routes to be accessible
 *     (run op-first-login flow first, or use DB reset below)
 *
 * SANDBOX-GATED: set E2E_OP_AUTH_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { hash } from '../lib/auth/password';
import { normalizePhone } from '../lib/auth/phoneNormalize';

const SANDBOX_ENABLED = process.env.E2E_OP_AUTH_ENABLED === 'true';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// After first-login e2e the seed operator's password will be NEW_PASSWORD.
// Run these tests only after op-first-login flow OR reset requiresPasswordChange=false + restore password.
const SEED_PHONE = normalizePhone('0901230001');

async function prepareOperator(): Promise<void> {
  const passwordHash = await hash('BBOp2026!');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = false,
        "contactPhone" = '+8490xxxxxx2', "notificationPhone" = '+8490xxxxxx3', "displayName" = 'Seed Operator Admin'
       WHERE phone = $2`,
      [passwordHash, SEED_PHONE]
    );
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [SEED_PHONE]
    );
  } finally {
    await client.end();
  }
}

test.describe('Operator profile GET + PATCH', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_AUTH_ENABLED=true to run');

  test.beforeEach(async () => {
    await prepareOperator();
  });

  test('GET /api/op/profile returns operator details', async ({ request }) => {
    const csrf = await primeCsrf(request);

    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: 'BBOp2026!' },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.get('/api/op/profile');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.phone).toBe(SEED_PHONE);
    expect(json.requiresPasswordChange).toBe(false);
    expect(json.displayName).toBe('Seed Operator Admin');
  });

  test('PATCH /api/op/profile updates displayName', async ({ request }) => {
    const csrf = await primeCsrf(request);

    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: 'BBOp2026!' },
      headers: { 'X-CSRF-Token': csrf },
    });

    const patchRes = await request.patch('/api/op/profile', {
      data: {
        displayName: 'Updated Admin Name',
        contactPhone: '0901230002',
        notificationPhone: '0901230003',
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(patchRes.status()).toBe(204);

    const profileRes = await request.get('/api/op/profile');
    const json = await profileRes.json();
    expect(json.displayName).toBe('Updated Admin Name');
  });

  test('PATCH /api/op/profile rejects same contactPhone and notificationPhone', async ({ request }) => {
    const csrf = await primeCsrf(request);

    await request.post('/api/auth/login', {
      data: { scope: 'operator', phone: SEED_PHONE, password: 'BBOp2026!' },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.patch('/api/op/profile', {
      data: {
        contactPhone: '0901230002',
        notificationPhone: '0901230002', // same as contactPhone
      },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('PHONES_MUST_DIFFER');
  });

  test('unauthenticated GET /api/op/profile returns 401', async ({ request }) => {
    const res = await request.get('/api/op/profile');
    expect(res.status()).toBe(401);
  });
});
