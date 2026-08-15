/**
 * E2E spec: auth OTP roundtrip (AC1)
 *
 * Flow: register (email OTP) → assert authenticated → logout → assert refresh cookie cleared →
 *       login → assert authenticated → silent refresh → assert new access token → logout →
 *       assert refresh fails.
 *
 * Prerequisites:
 *   - Running dev server (pnpm dev) with OTP_PEEK_ENABLED=true + NOTIFY_STUB=true (OTP lands in the
 *     peek sink; MUST NOT be set in production deployments).
 *   - DATABASE_URL pointed at the dev/test DB.
 *
 * OTP code is read from /api/auth/otp/test-peek (dev/test only). Never read from logs — logger
 * redacts codes.
 *
 * This test is SANDBOX-GATED: set E2E_AUTH_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { getCsrf, cleanupCustomer, registerCustomer } from './helpers/customer';

const SANDBOX_ENABLED = process.env.E2E_AUTH_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// Unique email per run so nothing collides across runs.
const TEST_EMAIL = `e2e-roundtrip-${Date.now()}@example.dev`;
const TEST_PASSWORD = 'Password1Test';

test.describe('Auth OTP roundtrip', () => {
  test.skip(!SANDBOX_ENABLED, 'Skipped: set E2E_AUTH_ENABLED=true to run');

  test.beforeEach(async () => {
    await cleanupCustomer(DB_URL, TEST_EMAIL);
  });

  test.afterEach(async () => {
    await cleanupCustomer(DB_URL, TEST_EMAIL);
  });

  test('register → logout → login → refresh → logout', async ({ page, context }) => {
    // ---- 1. CSRF cookie ----
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());
    expect(csrf).toBeTruthy();

    // ---- 2. Register via the email OTP flow (send → peek → verify → register) ----
    const accessTokenAfterRegister = await registerCustomer(page, BASE_URL, csrf, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(accessTokenAfterRegister.length).toBeGreaterThan(0);

    // bb_rt refresh cookie must be set after register
    const rtCookieAfterRegister = (await context.cookies()).find((c) => c.name === 'bb_rt');
    expect(rtCookieAfterRegister).toBeDefined();

    // ---- 3. Logout — invalidates refresh cookie server-side ----
    const logoutRes1 = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [csrf, BASE_URL] as const,
    );
    expect(logoutRes1.status).toBe(200);
    expect(logoutRes1.body.success).toBe(true);

    // Refresh cookie must be cleared after logout
    const rtCookieAfterLogout = (await context.cookies()).find((c) => c.name === 'bb_rt');
    expect(!rtCookieAfterLogout || rtCookieAfterLogout.value === '').toBe(true);

    // Logout rotates the bb_csrf cookie → re-read it, else the captured token is stale and the
    // next state-changing POST is rejected 403 by the double-submit CSRF check.
    const csrf2 = getCsrf(await context.cookies());
    expect(csrf2).toBeTruthy();

    // ---- 4. Login ----
    const loginRes = await page.evaluate(
      async ([email, password, csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [TEST_EMAIL, TEST_PASSWORD, csrf2, BASE_URL] as const,
    );
    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.accessToken).toBe('string');
    const accessTokenAfterLogin: string = loginRes.body.accessToken;
    expect(accessTokenAfterLogin.length).toBeGreaterThan(0);

    // bb_rt must be re-set after login
    const rtCookieAfterLogin = (await context.cookies()).find((c) => c.name === 'bb_rt');
    expect(rtCookieAfterLogin).toBeDefined();
    expect(rtCookieAfterLogin!.value.length).toBeGreaterThan(0);

    // ---- 5. Silent refresh — access token re-issued via bb_rt cookie ----
    // JWT iat/exp are second-precision; without this wait a same-second refresh would mint a
    // byte-identical access token and the rotation assertion below would flake. >1s → distinct iat.
    await page.waitForTimeout(1100);
    // Each auth state-change (login/logout/refresh) rotates bb_csrf → always re-read before the next.
    const csrfBeforeRefresh = getCsrf(await context.cookies());
    const refreshRes = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [csrfBeforeRefresh, BASE_URL] as const,
    );
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.accessToken).toBe('string');
    // New token must differ from the login-issued token (rotation)
    expect(refreshRes.body.accessToken).not.toBe(accessTokenAfterLogin);

    // ---- 6. Final logout ----
    const csrfBeforeLogout2 = getCsrf(await context.cookies());
    const logoutRes2 = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [csrfBeforeLogout2, BASE_URL] as const,
    );
    expect(logoutRes2.status).toBe(200);
    expect(logoutRes2.body.success).toBe(true);

    // Re-read csrf again (logout2 rotated it) so the refresh below is rejected 401 for the RIGHT
    // reason — server-side cookie invalidation — not a stale-CSRF 403.
    const csrf3 = getCsrf(await context.cookies());

    // Refresh must now fail (server-side cookie invalidation, not CSRF rejection)
    const refreshAfterLogout = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status };
      },
      [csrf3, BASE_URL] as const,
    );
    expect(refreshAfterLogout.status).toBe(401);
  });
});
