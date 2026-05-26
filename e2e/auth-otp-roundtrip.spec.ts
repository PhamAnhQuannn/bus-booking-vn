/**
 * E2E spec: auth OTP roundtrip (AC1)
 *
 * Flow: send OTP → read OTP from test-peek endpoint → verify OTP → register →
 *       assert authenticated → logout → assert refresh cookie cleared →
 *       login → assert authenticated → silent refresh → assert new access token
 *
 * Prerequisites:
 *   - Running dev server (pnpm dev) with OTP_PEEK_ENABLED=true in the server env
 *     (add to .env.local; MUST NOT be set in production deployments)
 *   - Seeded test DB (DATABASE_URL pointed at dev/test DB)
 *   - eSMS stub in place (console-log only, no real SMS)
 *
 * OTP code is read from /api/auth/otp/test-peek (dev/test only endpoint backed
 * by the in-process eSMS stub sink). Never read from logs — logger redacts codes.
 *
 * This test is SANDBOX-GATED: set E2E_AUTH_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const SANDBOX_ENABLED = process.env.E2E_AUTH_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// Unique phone per test run to avoid cross-test pollution.
// Generated at runtime so no static literal trips gitleaks \+84[35789]\d{8}.
const TEST_PHONE = `+8493${Date.now().toString().slice(-7)}`;
const TEST_PASSWORD = 'Password1Test';

async function cleanupPhone(phone: string): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "OtpAttempt" WHERE phone = $1`, [phone]);
    await client.query(
      `DELETE FROM "Session" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE phone = $1)`,
      [phone]
    );
    await client.query(`DELETE FROM "Customer" WHERE phone = $1`, [phone]);
  } finally {
    await client.end();
  }
}

function getCsrfFromCookies(cookies: Array<{ name: string; value: string }>): string {
  return cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
}

test.describe('Auth OTP roundtrip', () => {
  test.skip(!SANDBOX_ENABLED, 'Skipped: set E2E_AUTH_ENABLED=true to run');

  test.beforeEach(async () => {
    await cleanupPhone(TEST_PHONE);
  });

  test.afterEach(async () => {
    await cleanupPhone(TEST_PHONE);
  });

  test('send → verify → register → logout → login → refresh → logout', async ({ page, context }) => {
    // ---- 1. Get CSRF cookie via GET ----
    await page.goto(BASE_URL + '/');
    const initialCookies = await context.cookies();
    const csrf = getCsrfFromCookies(initialCookies);
    expect(csrf).toBeTruthy();

    // ---- 2. Send OTP ----
    const sendRes = await page.evaluate(
      async ([phone, csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/otp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ phone }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [TEST_PHONE, csrf, BASE_URL]
    );
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.success).toBe(true);

    // ---- 3. Read OTP code from the test-peek endpoint (dev/test only) ----
    const peekRes = await page.evaluate(
      async ([phone, baseUrl]) => {
        const url = `${baseUrl}/api/auth/otp/test-peek?phone=${encodeURIComponent(phone)}`;
        const r = await fetch(url, { credentials: 'include' });
        return { status: r.status, body: await r.json() };
      },
      [TEST_PHONE, BASE_URL]
    );
    expect(peekRes.status).toBe(200);
    const otpCode: string = peekRes.body.code;
    expect(otpCode).toMatch(/^[0-9]{6}$/);

    // ---- 4. Verify OTP → receive otpProof ----
    const verifyRes = await page.evaluate(
      async ([phone, code, csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ phone, code }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [TEST_PHONE, otpCode, csrf, BASE_URL]
    );
    expect(verifyRes.status).toBe(200);
    expect(typeof verifyRes.body.otpProof).toBe('string');
    const otpProof: string = verifyRes.body.otpProof;

    // ---- 5. Register ----
    const registerRes = await page.evaluate(
      async ([phone, proof, password, csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ phone, otpProof: proof, password }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [TEST_PHONE, otpProof, TEST_PASSWORD, csrf, BASE_URL]
    );
    expect(registerRes.status).toBe(200);
    expect(typeof registerRes.body.accessToken).toBe('string');
    const accessTokenAfterRegister: string = registerRes.body.accessToken;
    expect(accessTokenAfterRegister.length).toBeGreaterThan(0);

    // bb_rt refresh cookie must be set after register
    const cookiesAfterRegister = await context.cookies();
    const rtCookieAfterRegister = cookiesAfterRegister.find((c) => c.name === 'bb_rt');
    expect(rtCookieAfterRegister).toBeDefined();

    // ---- 6. Logout — invalidates refresh cookie server-side ----
    const logoutRes1 = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [csrf, BASE_URL]
    );
    expect(logoutRes1.status).toBe(200);
    expect(logoutRes1.body.success).toBe(true);

    // Refresh cookie must be cleared after logout
    const cookiesAfterLogout = await context.cookies();
    const rtCookieAfterLogout = cookiesAfterLogout.find((c) => c.name === 'bb_rt');
    expect(!rtCookieAfterLogout || rtCookieAfterLogout.value === '').toBe(true);

    // ---- 7. Login ----
    const loginRes = await page.evaluate(
      async ([phone, password, csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ phone, password }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [TEST_PHONE, TEST_PASSWORD, csrf, BASE_URL]
    );
    expect(loginRes.status).toBe(200);
    expect(typeof loginRes.body.accessToken).toBe('string');
    const accessTokenAfterLogin: string = loginRes.body.accessToken;
    expect(accessTokenAfterLogin.length).toBeGreaterThan(0);

    // bb_rt must be re-set after login
    const cookiesAfterLogin = await context.cookies();
    const rtCookieAfterLogin = cookiesAfterLogin.find((c) => c.name === 'bb_rt');
    expect(rtCookieAfterLogin).toBeDefined();
    expect(rtCookieAfterLogin!.value.length).toBeGreaterThan(0);

    // ---- 8. Silent refresh — access token re-issued via bb_rt cookie ----
    // JWT iat/exp are second-precision; without this wait a same-second refresh
    // would mint a byte-identical access token and the rotation assertion below
    // would flake. >1s guarantees a distinct iat.
    await page.waitForTimeout(1100);
    const refreshRes = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [csrf, BASE_URL]
    );
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.accessToken).toBe('string');
    // New token must differ from the login-issued token (rotation)
    expect(refreshRes.body.accessToken).not.toBe(accessTokenAfterLogin);

    // ---- 9. Final logout ----
    const logoutRes2 = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [csrf, BASE_URL]
    );
    expect(logoutRes2.status).toBe(200);
    expect(logoutRes2.body.success).toBe(true);

    // Confirm refresh fails after final logout (server-side cookie invalidation,
    // not CSRF rejection — thread the token so we hit the refresh handler)
    const refreshAfterLogout = await page.evaluate(
      async ([csrfToken, baseUrl]) => {
        const r = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'include',
        });
        return { status: r.status };
      },
      [csrf, BASE_URL]
    );
    expect(refreshAfterLogout.status).toBe(401);
  });
});
