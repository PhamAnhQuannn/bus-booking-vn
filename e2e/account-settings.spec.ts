/**
 * E2E spec: account settings — Issue 008
 *
 * Tests:
 *   AC4 — Change display name (PATCH /api/account/name)
 *   AC2 — Change password (POST /api/account/password)
 *   AC3 — Change phone: init + confirm OTP flow
 *   AC5 — Delete account (DELETE /api/account/delete) — idempotent
 *
 * Prerequisites:
 *   - Running dev server (pnpm dev) with OTP_PEEK_ENABLED=true in the server env
 *   - Seeded test DB
 *   - eSMS stub in place (console-log only)
 *
 * Phone literals use literal-x masks to avoid gitleaks \+84[35789]\d{8}.
 * Runtime phones are derived from Date.now() for uniqueness.
 *
 * SANDBOX-GATED: set E2E_ACCOUNT_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const SANDBOX_ENABLED = process.env.E2E_ACCOUNT_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// Phones use +8490 prefix (not in gitleaks mobile pattern +84[35789])
const suffix = () => Date.now().toString().slice(-7);
function mkPhone() { return `+8490${suffix()}`; }

const TEST_PASSWORD = 'Password1Acct';

// ---- DB helpers ------------------------------------------------------------

async function cleanupPhone(client: Client, phone: string): Promise<void> {
  await client.query(`DELETE FROM "OtpAttempt" WHERE phone = $1`, [phone]);
  await client.query(
    `DELETE FROM "Session" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE phone = $1)`,
    [phone]
  );
  await client.query(`DELETE FROM "Customer" WHERE phone = $1 OR phone IS NULL`, [phone]);
}

async function cleanupById(client: Client, customerId: string): Promise<void> {
  await client.query(`DELETE FROM "Session" WHERE "customerId" = $1`, [customerId]);
  await client.query(`DELETE FROM "Customer" WHERE id = $1`, [customerId]);
}

// ---- Registration helper (reuse across tests) ------------------------------

async function registerCustomer(
  page: import('@playwright/test').Page,
  phone: string,
  csrf: string
): Promise<string> {
  // Send OTP
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

  // Peek OTP
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

  // Verify OTP → get proof
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

  // Register
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
    [phone, proof, TEST_PASSWORD, csrf, BASE_URL]
  );
  expect(regRes.status).toBe(200);
  return regRes.body.accessToken as string;
}

// ---- Tests -----------------------------------------------------------------

test.describe('Account settings (Issue 008)', () => {
  test.skip(!SANDBOX_ENABLED, 'Skipped: set E2E_ACCOUNT_ENABLED=true to run');

  let db: Client;
  test.beforeAll(async () => {
    db = new Client({ connectionString: DB_URL });
    await db.connect();
  });
  test.afterAll(async () => {
    await db.end();
  });

  // ---- AC4: change display name --------------------------------------------
  test('AC4 — change display name', async ({ page, context }) => {
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
    expect(csrf).toBeTruthy();

    const accessToken = await registerCustomer(page, phone, csrf);

    const nameRes = await page.evaluate(
      async ([tok, cs, bu]) => {
        const r = await fetch(`${bu}/api/account/name`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          body: JSON.stringify({ displayName: 'Nguyễn Văn A' }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL]
    );
    expect(nameRes.status).toBe(200);
    expect(nameRes.body.displayName).toBe('Nguyễn Văn A');

    await cleanupPhone(db, phone);
  });

  // ---- AC4: display name too short ----------------------------------------
  test('AC4 — display name too short returns 422', async ({ page, context }) => {
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    const accessToken = await registerCustomer(page, phone, csrf);

    const nameRes = await page.evaluate(
      async ([tok, cs, bu]) => {
        const r = await fetch(`${bu}/api/account/name`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          body: JSON.stringify({ displayName: 'AB' }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL]
    );
    expect(nameRes.status).toBe(422);
    expect(nameRes.body.error).toBe('DISPLAY_NAME_TOO_SHORT');

    await cleanupPhone(db, phone);
  });

  // ---- AC2: change password -----------------------------------------------
  test('AC2 — change password succeeds, wrong current rejects', async ({ page, context }) => {
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    const accessToken = await registerCustomer(page, phone, csrf);

    // wrong current password → 422
    const wrongRes = await page.evaluate(
      async ([tok, cs, bu]) => {
        const r = await fetch(`${bu}/api/account/password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          body: JSON.stringify({ currentPassword: 'WrongPass1!', newPassword: 'NewPass1Valid!' }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL]
    );
    expect(wrongRes.status).toBe(422);
    expect(wrongRes.body.error).toBe('CURRENT_PASSWORD_WRONG');

    // correct current password → 200
    const okRes = await page.evaluate(
      async ([tok, cs, bu, pw]) => {
        const r = await fetch(`${bu}/api/account/password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          body: JSON.stringify({ currentPassword: pw, newPassword: 'NewPass1Valid!' }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL, TEST_PASSWORD]
    );
    expect(okRes.status).toBe(200);

    await cleanupPhone(db, phone);
  });

  // ---- AC2: password reuse rejected ---------------------------------------
  test('AC2 — reused password returns 422 PASSWORD_REUSED', async ({ page, context }) => {
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    const accessToken = await registerCustomer(page, phone, csrf);

    const reuseRes = await page.evaluate(
      async ([tok, cs, bu, pw]) => {
        const r = await fetch(`${bu}/api/account/password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          body: JSON.stringify({ currentPassword: pw, newPassword: pw }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL, TEST_PASSWORD]
    );
    expect(reuseRes.status).toBe(422);
    expect(reuseRes.body.error).toBe('PASSWORD_REUSED');

    await cleanupPhone(db, phone);
  });

  // ---- AC3: change phone (OTP flow) ----------------------------------------
  test('AC3 — change phone via OTP', async ({ page, context }) => {
    const phone = mkPhone();
    const newPhone = mkPhone();
    await cleanupPhone(db, phone);
    await cleanupPhone(db, newPhone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    const accessToken = await registerCustomer(page, phone, csrf);

    // Step 1: init (send OTP to newPhone)
    const initRes = await page.evaluate(
      async ([tok, cs, bu, np]) => {
        const r = await fetch(`${bu}/api/account/phone/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          body: JSON.stringify({ newPhone: np }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL, newPhone]
    );
    expect(initRes.status).toBe(200);

    // Peek OTP for newPhone
    const peekRes = await page.evaluate(
      async ([np, bu]) => {
        const r = await fetch(
          `${bu}/api/auth/otp/test-peek?phone=${encodeURIComponent(np)}`,
          { credentials: 'include' }
        );
        return { status: r.status, body: await r.json() };
      },
      [newPhone, BASE_URL]
    );
    expect(peekRes.status).toBe(200);
    const otpCode: string = peekRes.body.code;

    // Step 2: confirm
    const confirmRes = await page.evaluate(
      async ([tok, cs, bu, np, code]) => {
        const r = await fetch(`${bu}/api/account/phone/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          body: JSON.stringify({ newPhone: np, code }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL, newPhone, otpCode]
    );
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.phone).toBe(newPhone);

    await cleanupPhone(db, newPhone);
    // old phone row already changed to newPhone, cleanup by id not needed
  });

  // ---- AC5: delete account (idempotent) ------------------------------------
  test('AC5 — delete account is idempotent (two DELETE calls both return 200)', async ({ page, context }) => {
    const phone = mkPhone();
    await cleanupPhone(db, phone);
    await page.goto(BASE_URL + '/');
    const cookies = await context.cookies();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    const accessToken = await registerCustomer(page, phone, csrf);

    // Get customerId for cleanup
    const row = await db.query<{ id: string }>(`SELECT id FROM "Customer" WHERE phone = $1`, [phone]);
    const customerId = row.rows[0]?.id;

    // First delete
    const del1 = await page.evaluate(
      async ([tok, cs, bu]) => {
        const r = await fetch(`${bu}/api/account/delete`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL]
    );
    expect(del1.status).toBe(200);
    expect(del1.body.ok).toBe(true);
    expect(del1.body.alreadyDeleted).toBe(false);

    // Second delete (idempotent)
    const del2 = await page.evaluate(
      async ([tok, cs, bu]) => {
        const r = await fetch(`${bu}/api/account/delete`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${tok}`,
            'X-CSRF-Token': cs,
          },
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [accessToken, csrf, BASE_URL]
    );
    expect(del2.status).toBe(200);
    expect(del2.body.ok).toBe(true);
    expect(del2.body.alreadyDeleted).toBe(true);

    if (customerId) {
      await cleanupById(db, customerId);
    }
  });
});
