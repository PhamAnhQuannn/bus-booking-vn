/**
 * E2E spec: customer password reset flow — Issue 008 AC1
 *
 * Flow:
 *   1. Register customer via OTP
 *   2. POST /api/auth/forgot-password (always 200, no-enum)
 *   3. Peek OTP for test purposes
 *   4. POST /api/auth/reset-password with OTP code + new password → 204
 *   5. Confirm old password rejected, new password accepted on login
 *
 * Additional cases:
 *   - Non-existent phone still returns 200 (no-enumeration)
 *   - Wrong OTP code returns 400 OTP_INVALID
 *   - Reused password returns 422 PASSWORD_REUSED
 *
 * No CSRF required for /api/auth/forgot-password and /api/auth/reset-password
 * (pre-auth exemption in proxy.ts).
 *
 * Phone literals use literal-x masks to avoid gitleaks \+84[35789]\d{8}.
 *
 * SANDBOX-GATED: set E2E_ACCOUNT_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const SANDBOX_ENABLED = process.env.E2E_ACCOUNT_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// +8490 prefix — NOT in gitleaks mobile pattern +84[35789]
function mkPhone() { return `+8490${Date.now().toString().slice(-7)}`; }

const ORIGINAL_PASSWORD = 'OriginalPass1!';
const NEW_PASSWORD = 'NewPassword1!';

// ---- DB helpers ------------------------------------------------------------

async function cleanupPhone(client: Client, phone: string): Promise<void> {
  await client.query(`DELETE FROM "OtpAttempt" WHERE phone = $1`, [phone]);
  await client.query(
    `DELETE FROM "Session" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE phone = $1)`,
    [phone]
  );
  await client.query(`DELETE FROM "Customer" WHERE phone = $1`, [phone]);
}

// ---- Registration helper ---------------------------------------------------

async function registerCustomer(
  page: import('@playwright/test').Page,
  phone: string,
  csrf: string
): Promise<string> {
  const sendRes = await page.evaluate(
    async ([ph, cs, bu]) => {
      const r = await fetch(`${bu}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
        body: JSON.stringify({ phone: ph }),
        credentials: 'include',
      });
      return { status: r.status, body: await r.json() };
    },
    [phone, csrf, BASE_URL]
  );
  expect(sendRes.status).toBe(200);

  const peekRes = await page.evaluate(
    async ([ph, bu]) => {
      const r = await fetch(`${bu}/api/auth/otp/test-peek?phone=${encodeURIComponent(ph)}`, {
        credentials: 'include',
      });
      return { status: r.status, body: await r.json() };
    },
    [phone, BASE_URL]
  );
  expect(peekRes.status).toBe(200);
  const otpCode: string = peekRes.body.code;

  const verifyRes = await page.evaluate(
    async ([ph, code, cs, bu]) => {
      const r = await fetch(`${bu}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
        body: JSON.stringify({ phone: ph, code }),
        credentials: 'include',
      });
      return { status: r.status, body: await r.json() };
    },
    [phone, otpCode, csrf, BASE_URL]
  );
  expect(verifyRes.status).toBe(200);
  const proof: string = verifyRes.body.otpProof;

  const regRes = await page.evaluate(
    async ([ph, pf, pw, cs, bu]) => {
      const r = await fetch(`${bu}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
        body: JSON.stringify({ phone: ph, otpProof: pf, password: pw }),
        credentials: 'include',
      });
      return { status: r.status, body: await r.json() };
    },
    [phone, proof, ORIGINAL_PASSWORD, csrf, BASE_URL]
  );
  expect(regRes.status).toBe(200);
  return regRes.body.accessToken as string;
}

// ---- Tests -----------------------------------------------------------------

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
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
    expect(csrf).toBeTruthy();

    await registerCustomer(page, phone, csrf);

    // Step 1: forgot-password (no CSRF required — pre-auth exempt)
    const forgotRes = await page.evaluate(
      async ([ph, bu]) => {
        const r = await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: ph }),
        });
        return { status: r.status };
      },
      [phone, BASE_URL]
    );
    expect(forgotRes.status).toBe(200);

    // Step 2: peek OTP (routes through same OtpAttempt table as account OTP)
    const peekRes = await page.evaluate(
      async ([ph, bu]) => {
        const r = await fetch(
          `${bu}/api/auth/otp/test-peek?phone=${encodeURIComponent(ph)}`,
          { credentials: 'include' }
        );
        return { status: r.status, body: await r.json() };
      },
      [phone, BASE_URL]
    );
    expect(peekRes.status).toBe(200);
    const otpCode: string = peekRes.body.code;
    expect(otpCode).toMatch(/^[0-9]{6}$/);

    // Step 3: reset-password (no CSRF — pre-auth exempt)
    const resetRes = await page.evaluate(
      async ([ph, code, np, bu]) => {
        const r = await fetch(`${bu}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: ph, code, newPassword: np }),
        });
        return { status: r.status };
      },
      [phone, otpCode, NEW_PASSWORD, BASE_URL]
    );
    // AC1: 204 No Content on success
    expect(resetRes.status).toBe(204);

    // Step 4: old password now rejected
    const oldLoginRes = await page.evaluate(
      async ([ph, op, cs, bu]) => {
        const r = await fetch(`${bu}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
          body: JSON.stringify({ phone: ph, password: op }),
          credentials: 'include',
        });
        return { status: r.status };
      },
      [phone, ORIGINAL_PASSWORD, csrf, BASE_URL]
    );
    expect(oldLoginRes.status).toBe(401);

    // Step 5: new password accepted
    const newLoginRes = await page.evaluate(
      async ([ph, np, cs, bu]) => {
        const r = await fetch(`${bu}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cs },
          body: JSON.stringify({ phone: ph, password: np }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [phone, NEW_PASSWORD, csrf, BASE_URL]
    );
    expect(newLoginRes.status).toBe(200);
    expect(typeof newLoginRes.body.accessToken).toBe('string');

    await cleanupPhone(db, phone);
  });

  // ---- AC1: non-existent phone still returns 200 (no-enumeration) ----------
  test('AC1 — non-existent phone returns 200 (no-enumeration)', async ({ page }) => {
    // Uses a phone that's definitely not registered (timestamp-based, never seeded)
    const ghostPhone = `+8490${(Date.now() + 99999).toString().slice(-7)}`;

    const forgotRes = await page.evaluate(
      async ([ph, bu]) => {
        const r = await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: ph }),
        });
        return { status: r.status };
      },
      [ghostPhone, BASE_URL]
    );
    expect(forgotRes.status).toBe(200);
  });

  // ---- AC1: wrong OTP code returns 400 OTP_INVALID -------------------------
  test('AC1 — wrong OTP code returns 400 OTP_INVALID', async ({ page, context }) => {
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    await registerCustomer(page, phone, csrf);

    // Trigger forgot-password to create an OTP attempt
    await page.evaluate(
      async ([ph, bu]) => {
        await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: ph }),
        });
      },
      [phone, BASE_URL]
    );

    // Submit wrong code
    const resetRes = await page.evaluate(
      async ([ph, np, bu]) => {
        const r = await fetch(`${bu}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: ph, code: '000000', newPassword: np }),
        });
        return { status: r.status, body: await r.json() };
      },
      [phone, NEW_PASSWORD, BASE_URL]
    );
    expect(resetRes.status).toBe(400);
    expect(['OTP_INVALID', 'OTP_EXPIRED']).toContain(resetRes.body.error);

    await cleanupPhone(db, phone);
  });

  // ---- AC1: password reuse rejected at reset-password ----------------------
  test('AC1 — reset with same password returns 422 PASSWORD_REUSED', async ({ page, context }) => {
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    await registerCustomer(page, phone, csrf);

    // Trigger forgot-password
    await page.evaluate(
      async ([ph, bu]) => {
        await fetch(`${bu}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: ph }),
        });
      },
      [phone, BASE_URL]
    );

    // Peek OTP
    const peekRes = await page.evaluate(
      async ([ph, bu]) => {
        const r = await fetch(
          `${bu}/api/auth/otp/test-peek?phone=${encodeURIComponent(ph)}`,
          { credentials: 'include' }
        );
        return { status: r.status, body: await r.json() };
      },
      [phone, BASE_URL]
    );
    expect(peekRes.status).toBe(200);
    const otpCode: string = peekRes.body.code;

    // Try to reset with the SAME password
    const resetRes = await page.evaluate(
      async ([ph, code, op, bu]) => {
        const r = await fetch(`${bu}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: ph, code, newPassword: op }),
        });
        return { status: r.status, body: await r.json() };
      },
      [phone, otpCode, ORIGINAL_PASSWORD, BASE_URL]
    );
    expect(resetRes.status).toBe(422);
    expect(resetRes.body.error).toBe('PASSWORD_REUSED');

    await cleanupPhone(db, phone);
  });
});
