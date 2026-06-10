/**
 * E2E spec: operator first-login forced password change (Issue 010)
 *
 * Flow:
 *   1. Login with seed operator (requiresPasswordChange=true)
 *   2. Verify response redirects to /op/first-login (requiresPasswordChange in JSON)
 *   3. Attempt to access /api/op/profile → 403 PASSWORD_CHANGE_REQUIRED
 *   4. Change password via /api/op/auth/password/change → 204
 *   5. Verify /api/op/profile now returns 200
 *   6. Logout → 204, cookies cleared
 *
 * Prerequisites:
 *   - Running dev server with seeded DB (pnpm dev && pnpm prisma db seed)
 *   - Seed operator: phone +8490xxxxxx1, password BBOp2026!, requiresPasswordChange=true
 *
 * SANDBOX-GATED: set E2E_OP_AUTH_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';
import { normalizePhone } from '../lib/core/validation/phone';
import { hash } from '../lib/auth/password';

const SANDBOX_ENABLED = process.env.E2E_OP_AUTH_ENABLED === 'true';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const SEED_PHONE = normalizePhone('0901230001');
const SEED_PASSWORD = 'BBOp2026!';
const SEED_USERNAME = 'PB-0001'; // 2026-06-06: seed operator logs in by username, not phone
const NEW_PASSWORD = 'NewOpPass2026!';

async function resetSeedOperator(): Promise<void> {
  const passwordHash = await hash(SEED_PASSWORD);
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    // Revoke all sessions so each run starts fresh
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1)`,
      [SEED_PHONE]
    );
    // Reset requiresPasswordChange AND restore the seed password — the full-flow
    // test rotates it to NEW_PASSWORD, so each run must restore BBOp2026! or
    // subsequent logins fail (no session → /op/login redirect, 401 not 400).
    await client.query(
      `UPDATE "OperatorUser" SET "requiresPasswordChange" = true, "passwordHash" = $2 WHERE phone = $1`,
      [SEED_PHONE, passwordHash]
    );
  } finally {
    await client.end();
  }
}

test.describe('Operator first-login forced password change', () => {
  test.skip(!SANDBOX_ENABLED, 'Set E2E_OP_AUTH_ENABLED=true to run');

  test.beforeEach(async () => {
    await resetSeedOperator();
  });

  test('full first-login flow: login → blocked → change password → profile accessible → logout', async ({ request }) => {
    const csrf = await primeCsrf(request);

    // Step 1: login with seed operator
    const loginRes = await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(loginRes.status()).toBe(200);
    const loginJson = await loginRes.json();
    expect(loginJson.requiresPasswordChange).toBe(true);
    expect(loginJson.operator.phone).toBe(SEED_PHONE);

    // Cookies set
    const loginCookies = await request.storageState();
    expect(loginCookies.cookies.some((c) => c.name === 'bb_op_access')).toBe(true);
    expect(loginCookies.cookies.some((c) => c.name === 'bb_op_refresh')).toBe(true);

    // Step 2: profile blocked during password change required
    const profileBlockedRes = await request.get('/api/op/profile');
    expect(profileBlockedRes.status()).toBe(403);
    const blockedJson = await profileBlockedRes.json();
    expect(blockedJson.error).toBe('PASSWORD_CHANGE_REQUIRED');

    // Step 3: change password
    const changeRes = await request.post('/api/op/auth/password/change', {
      data: { currentPassword: SEED_PASSWORD, newPassword: NEW_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(changeRes.status()).toBe(204);

    // Step 4: re-prime CSRF (session rotation means fresh token needed for next call)
    const csrf2 = await primeCsrf(request);

    // Step 5: profile accessible after password change
    // Note: password change route issues new cookies — need to use fresh context
    const profileRes = await request.get('/api/op/profile');
    expect(profileRes.status()).toBe(200);
    const profileJson = await profileRes.json();
    expect(profileJson.phone).toBe(SEED_PHONE);
    expect(profileJson.requiresPasswordChange).toBe(false);

    // Step 6: logout
    const logoutRes = await request.post('/api/op/auth/logout', {
      headers: { 'X-CSRF-Token': csrf2 },
    });
    expect(logoutRes.status()).toBe(204);
  });

  test('weak password rejected during first-login change', async ({ request }) => {
    const csrf = await primeCsrf(request);

    await request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    const res = await request.post('/api/op/auth/password/change', {
      data: { currentPassword: SEED_PASSWORD, newPassword: 'weak' },
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('WEAK_PASSWORD');
  });

  // -------------------------------------------------------------------------
  // AC1 — proxy forced-redirect guard (Gap 3)
  // -------------------------------------------------------------------------

  test('AC1: requiresPasswordChange operator is redirected from /op/profile to /op/first-login', async ({ page }) => {
    // Log in via API to set cookies, then navigate with the browser
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Navigate to /op/profile — proxy should redirect to /op/first-login
    await page.goto('/op/profile');
    expect(page.url()).toMatch(/\/op\/first-login/);
  });

  test('AC1: requiresPasswordChange operator is redirected from unknown /op/* to /op/first-login', async ({ page }) => {
    const csrf = await primeCsrf(page.request);
    await page.request.post('/api/auth/login', {
      data: { scope: 'operator', username: SEED_USERNAME, password: SEED_PASSWORD },
      headers: { 'X-CSRF-Token': csrf },
    });

    // Navigate to a non-existent /op/* path — proxy redirects before 404
    await page.goto('/op/dashboard');
    // Should be redirected to /op/first-login (cannot reach any other /op/* route)
    expect(page.url()).toMatch(/\/op\/first-login/);
  });
});
