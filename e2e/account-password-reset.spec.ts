/**
 * E2E spec: customer password reset flow — Issue 008 AC1 (email OTP).
 *
 * Flow:
 *   1. Register customer via email OTP
 *   2. POST /api/auth/forgot-password { email } (always 200, no-enum)
 *   3. Peek OTP → POST /api/auth/forgot-password/verify { email, code } → 200 { otpProof }
 *   4. POST /api/auth/reset-password { otpProof, newPassword } → 204
 *   5. Old password rejected, new password accepted on login
 *
 * Additional cases: non-existent email still 200 (no-enum); wrong OTP → 400 OTP_INVALID;
 * reused password → 422 PASSWORD_REUSED.
 *
 * No CSRF for /forgot-password + /reset-password (pre-auth exemption in proxy.ts).
 *
 * SANDBOX-GATED: set E2E_ACCOUNT_ENABLED=true to run (needs OTP_PEEK_ENABLED + NOTIFY_STUB server env).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { getCsrf, cleanupCustomerWith, peekOtp, registerCustomer } from './helpers/customer';

const SANDBOX_ENABLED = process.env.E2E_ACCOUNT_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const mkEmail = () => `e2e-reset-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.dev`;
const ORIGINAL_PASSWORD = 'OriginalPass1';
const NEW_PASSWORD = 'NewPassword1';

test.describe('Customer password reset (Issue 008 AC1)', () => {
  test.skip(!SANDBOX_ENABLED, 'Skipped: set E2E_ACCOUNT_ENABLED=true to run');

  let db: Client;
  test.beforeAll(async () => {
    db = new Client({ connectionString: DB_URL });
    await db.connect();
  });
  test.afterAll(async () => {
    await db.end();
  });

  // ---- AC1 full happy path ------------------------------------------------
  test('AC1 — forgot → OTP → reset → login with new password', async ({ page, context }) => {
    const email = mkEmail();
    await cleanupCustomerWith(db, email);
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());
    expect(csrf).toBeTruthy();

    await registerCustomer(page, BASE_URL, csrf, { email, password: ORIGINAL_PASSWORD });

    // Step 1: forgot-password (no CSRF — pre-auth exempt)
    const forgotRes = await page.evaluate(
      async ([e, bu]) => {
        const r = await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e }),
        });
        return { status: r.status };
      },
      [email, BASE_URL] as const,
    );
    expect(forgotRes.status).toBe(200);

    // Step 2: peek OTP
    const otpCode = await peekOtp(page, BASE_URL, { email });
    expect(otpCode).toMatch(/^[0-9]{6}$/);

    // Step 3: exchange OTP for a reset_password proof
    const verifyRes = await page.evaluate(
      async ([e, code, bu]) => {
        const r = await fetch(`${bu}/api/auth/forgot-password/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e, code }),
        });
        return { status: r.status, body: await r.json() };
      },
      [email, otpCode, BASE_URL] as const,
    );
    expect(verifyRes.status).toBe(200);
    const otpProof: string = verifyRes.body.otpProof;
    expect(typeof otpProof).toBe('string');

    // Step 4: reset-password (no CSRF — pre-auth exempt) → 204
    const resetRes = await page.evaluate(
      async ([pf, np, bu]) => {
        const r = await fetch(`${bu}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otpProof: pf, newPassword: np }),
        });
        return { status: r.status };
      },
      [otpProof, NEW_PASSWORD, BASE_URL] as const,
    );
    expect(resetRes.status).toBe(204);

    // Step 5: old password rejected
    const oldLoginRes = await page.evaluate(
      async ([e, op, cs, bu]) => {
        const r = await fetch(`${bu}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
          body: JSON.stringify({ email: e, password: op }),
          credentials: 'include',
        });
        return { status: r.status };
      },
      [email, ORIGINAL_PASSWORD, csrf, BASE_URL] as const,
    );
    expect(oldLoginRes.status).toBe(401);

    // Step 6: new password accepted (re-read csrf — a prior login attempt may have rotated it)
    const csrf2 = getCsrf(await context.cookies());
    const newLoginRes = await page.evaluate(
      async ([e, np, cs, bu]) => {
        const r = await fetch(`${bu}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
          body: JSON.stringify({ email: e, password: np }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [email, NEW_PASSWORD, csrf2, BASE_URL] as const,
    );
    expect(newLoginRes.status).toBe(200);
    expect(typeof newLoginRes.body.accessToken).toBe('string');

    await cleanupCustomerWith(db, email);
  });

  // ---- AC1: non-existent email still returns 200 (no-enumeration) ----------
  test('AC1 — non-existent email returns 200 (no-enumeration)', async ({ page }) => {
    const ghostEmail = mkEmail();
    await page.goto(BASE_URL + '/'); // real origin so page.evaluate(fetch) works
    const forgotRes = await page.evaluate(
      async ([e, bu]) => {
        const r = await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e }),
        });
        return { status: r.status };
      },
      [ghostEmail, BASE_URL] as const,
    );
    expect(forgotRes.status).toBe(200);
  });

  // ---- AC1: wrong OTP code returns 400 OTP_INVALID -------------------------
  test('AC1 — wrong OTP code returns 400 OTP_INVALID', async ({ page, context }) => {
    const email = mkEmail();
    await cleanupCustomerWith(db, email);
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());

    await registerCustomer(page, BASE_URL, csrf, { email, password: ORIGINAL_PASSWORD });

    await page.evaluate(
      async ([e, bu]) => {
        await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e }),
        });
      },
      [email, BASE_URL] as const,
    );

    const verifyRes = await page.evaluate(
      async ([e, bu]) => {
        const r = await fetch(`${bu}/api/auth/forgot-password/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e, code: '000000' }),
        });
        return { status: r.status, body: await r.json() };
      },
      [email, BASE_URL] as const,
    );
    expect(verifyRes.status).toBe(400);
    expect(['OTP_INVALID', 'OTP_EXPIRED']).toContain(verifyRes.body.error);

    await cleanupCustomerWith(db, email);
  });

  // ---- AC1: password reuse rejected at reset-password ----------------------
  test('AC1 — reset with same password returns 422 PASSWORD_REUSED', async ({ page, context }) => {
    const email = mkEmail();
    await cleanupCustomerWith(db, email);
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());

    await registerCustomer(page, BASE_URL, csrf, { email, password: ORIGINAL_PASSWORD });

    await page.evaluate(
      async ([e, bu]) => {
        await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e }),
        });
      },
      [email, BASE_URL] as const,
    );

    const otpCode = await peekOtp(page, BASE_URL, { email });

    const verifyRes = await page.evaluate(
      async ([e, code, bu]) => {
        const r = await fetch(`${bu}/api/auth/forgot-password/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e, code }),
        });
        return { status: r.status, body: await r.json() };
      },
      [email, otpCode, BASE_URL] as const,
    );
    expect(verifyRes.status).toBe(200);
    const otpProof: string = verifyRes.body.otpProof;

    // Reset with the SAME password → 422
    const resetRes = await page.evaluate(
      async ([pf, op, bu]) => {
        const r = await fetch(`${bu}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otpProof: pf, newPassword: op }),
        });
        return { status: r.status, body: await r.json() };
      },
      [otpProof, ORIGINAL_PASSWORD, BASE_URL] as const,
    );
    expect(resetRes.status).toBe(422);
    expect(resetRes.body.error).toBe('PASSWORD_REUSED');

    await cleanupCustomerWith(db, email);
  });
});
