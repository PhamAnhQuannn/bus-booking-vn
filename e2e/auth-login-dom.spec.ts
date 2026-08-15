/**
 * E2E spec: the login PAGE DOM (#480). Existing auth specs all hit /api/auth/login directly; this
 * one drives the real form on /auth/login — fills the fields, submits, and asserts the redirect +
 * session cookie. Complements the RTL unit test (which mocks fetch) with a real end-to-end path.
 *
 * One registration only (kept under customerRegisterRatelimit 5/15min across the auth specs).
 *
 * Prerequisites: dev server with OTP_PEEK_ENABLED=true + NOTIFY_STUB=true; dev/test DB.
 * SANDBOX-GATED: set E2E_AUTH_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { getCsrf, cleanupCustomer, registerCustomer } from './helpers/customer';

const SANDBOX_ENABLED = process.env.E2E_AUTH_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const TEST_EMAIL = `e2e-logindom-${Date.now()}@example.dev`;
const TEST_PASSWORD = 'Password1Test';

test.describe('Login page DOM', () => {
  test.skip(!SANDBOX_ENABLED, 'Skipped: set E2E_AUTH_ENABLED=true to run');

  test.beforeEach(async () => {
    await cleanupCustomer(DB_URL, TEST_EMAIL);
  });
  test.afterEach(async () => {
    await cleanupCustomer(DB_URL, TEST_EMAIL);
  });

  test('fills the login form on /auth/login and redirects on success', async ({ page, context }) => {
    // Load the login page for a same-origin context + the bb_csrf cookie (avoid depending on '/',
    // which can 500 without local-only homepage data). Seed a customer (register logs it in), then
    // log out — a signed-in customer landing on /auth/login is bounced to returnTo (#482).
    await page.goto(BASE_URL + '/auth/login');
    await page.waitForLoadState('networkidle'); // let the auth-bootstrap refresh settle before reading bb_csrf
    const csrf = getCsrf(await context.cookies());
    await registerCustomer(page, BASE_URL, csrf, { email: TEST_EMAIL, password: TEST_PASSWORD });
    await page.evaluate(
      async ([cs, bu]) => {
        await fetch(`${bu}/api/auth/logout`, {
          method: 'POST',
          headers: { 'X-CSRF-Token': cs },
          credentials: 'include',
        });
      },
      [csrf, BASE_URL] as const,
    );

    // Reload the login page as a guest and drive the real form.
    await page.goto(BASE_URL + '/auth/login');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    // Redirect to returnTo (default '/') + the refresh cookie is set.
    await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 10_000 });
    const rt = (await context.cookies()).find((c) => c.name === 'bb_rt');
    expect(rt?.value).toBeTruthy();
  });
});
