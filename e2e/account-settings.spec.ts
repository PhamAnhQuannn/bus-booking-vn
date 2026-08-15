/**
 * E2E spec: account settings — Issue 008 (email-registered customer).
 *
 * AC4 — change display name (valid + too-short)     PATCH /api/account/name
 * AC2 — change password (wrong / success / reuse)   POST  /api/account/password
 * AC3 — change phone via OTP (init + confirm)        POST  /api/account/phone/{init,confirm}
 * AC5 — delete account (idempotent)                  DELETE /api/account/delete
 *
 * Consolidated so the whole spec registers only 4 customers — customerRegisterRatelimit is
 * 5/15min/IP and every registration shares the localhost IP, so one-register-per-assertion would
 * trip the cap. Each test still registers its own customer because the mutations are destructive.
 *
 * The customer identity is EMAIL (register via email OTP). AC3 still exercises the phone-change
 * feature, which remains phone-based (/api/account/phone/* take { newPhone }); the phone is ADDED to
 * an email customer. Runtime phones use the +8490 prefix (outside the gitleaks +84[35789] pattern).
 *
 * Prerequisites: dev server with OTP_PEEK_ENABLED=true + NOTIFY_STUB=true; seeded test DB.
 * SANDBOX-GATED: set E2E_ACCOUNT_ENABLED=true to run.
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { getCsrf, cleanupCustomerWith, peekOtp, registerCustomer } from './helpers/customer';

const SANDBOX_ENABLED = process.env.E2E_ACCOUNT_ENABLED === 'true';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

const mkEmail = () => `e2e-acct-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.dev`;
const mkPhone = () => `+8490${Date.now().toString().slice(-7)}`;
const TEST_PASSWORD = 'Password1Acct';

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

  // ---- AC4: change display name (valid + too-short) ------------------------
  test('AC4 — change display name: valid succeeds, too-short 422', async ({ page, context }) => {
    const email = mkEmail();
    await cleanupCustomerWith(db, email);
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());
    const token = await registerCustomer(page, BASE_URL, csrf, { email, password: TEST_PASSWORD });

    const patchName = (displayName: string) =>
      page.evaluate(
        async ([tok, cs, bu, name]) => {
          const r = await fetch(`${bu}/api/account/name`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-CSRF-Token': cs },
            body: JSON.stringify({ displayName: name }),
            credentials: 'include',
          });
          return { status: r.status, body: await r.json() };
        },
        [token, csrf, BASE_URL, displayName] as const,
      );

    const ok = await patchName('Nguyễn Văn A');
    expect(ok.status).toBe(200);
    expect(ok.body.displayName).toBe('Nguyễn Văn A');

    const tooShort = await patchName('AB');
    expect(tooShort.status).toBe(422);
    expect(tooShort.body.error).toBe('DISPLAY_NAME_TOO_SHORT');

    await cleanupCustomerWith(db, email);
  });

  // ---- AC2: change password (wrong current / success / reuse) --------------
  test('AC2 — change password: wrong 422, success 200, reuse 422', async ({ page, context }) => {
    const email = mkEmail();
    await cleanupCustomerWith(db, email);
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());
    const token = await registerCustomer(page, BASE_URL, csrf, { email, password: TEST_PASSWORD });
    const NEW_PASSWORD = 'NewPass1Valid';

    const changePw = (currentPassword: string, newPassword: string) =>
      page.evaluate(
        async ([tok, cs, bu, cur, nw]) => {
          const r = await fetch(`${bu}/api/account/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-CSRF-Token': cs },
            body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
            credentials: 'include',
          });
          return { status: r.status, body: await r.json() };
        },
        [token, csrf, BASE_URL, currentPassword, newPassword] as const,
      );

    const wrong = await changePw('WrongPass1', NEW_PASSWORD);
    expect(wrong.status).toBe(422);
    expect(wrong.body.error).toBe('CURRENT_PASSWORD_WRONG');

    const ok = await changePw(TEST_PASSWORD, NEW_PASSWORD);
    expect(ok.status).toBe(200);

    // Reuse: current is now NEW_PASSWORD; setting it again → 422 PASSWORD_REUSED
    const reuse = await changePw(NEW_PASSWORD, NEW_PASSWORD);
    expect(reuse.status).toBe(422);
    expect(reuse.body.error).toBe('PASSWORD_REUSED');

    await cleanupCustomerWith(db, email);
  });

  // ---- AC3: change phone via OTP -------------------------------------------
  test('AC3 — change phone via OTP', async ({ page, context }) => {
    const email = mkEmail();
    const newPhone = mkPhone();
    await cleanupCustomerWith(db, email);
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());
    const token = await registerCustomer(page, BASE_URL, csrf, { email, password: TEST_PASSWORD });

    const initRes = await page.evaluate(
      async ([tok, cs, bu, np]) => {
        const r = await fetch(`${bu}/api/account/phone/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-CSRF-Token': cs },
          body: JSON.stringify({ newPhone: np }),
          credentials: 'include',
        });
        return { status: r.status };
      },
      [token, csrf, BASE_URL, newPhone] as const,
    );
    expect(initRes.status).toBe(200);

    const otpCode = await peekOtp(page, BASE_URL, { phone: newPhone });

    const confirmRes = await page.evaluate(
      async ([tok, cs, bu, np, code]) => {
        const r = await fetch(`${bu}/api/account/phone/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'X-CSRF-Token': cs },
          body: JSON.stringify({ newPhone: np, code }),
          credentials: 'include',
        });
        return { status: r.status, body: await r.json() };
      },
      [token, csrf, BASE_URL, newPhone, otpCode] as const,
    );
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.phone).toBe(newPhone);

    await cleanupCustomerWith(db, email);
  });

  // ---- AC5: delete account (idempotent) ------------------------------------
  test('AC5 — delete account: first 200, second 401 (token rejected post-delete #428)', async ({ page, context }) => {
    const email = mkEmail();
    await cleanupCustomerWith(db, email);
    await page.goto(BASE_URL + '/');
    const csrf = getCsrf(await context.cookies());
    const token = await registerCustomer(page, BASE_URL, csrf, { email, password: TEST_PASSWORD });

    const del = () =>
      page.evaluate(
        async ([tok, cs, bu]) => {
          const r = await fetch(`${bu}/api/account/delete`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tok}`, 'X-CSRF-Token': cs },
            credentials: 'include',
          });
          return { status: r.status, body: await r.json() };
        },
        [token, csrf, BASE_URL] as const,
      );

    const del1 = await del();
    expect(del1.status).toBe(200);
    expect(del1.body.ok).toBe(true);
    expect(del1.body.alreadyDeleted).toBe(false);

    // After the soft-delete, requireCustomerAuth honours deletedAt (#428) → the SAME access token is
    // now rejected 401 (indistinguishable from nonexistent). The delete SERVICE stays idempotent, but
    // the route can no longer be re-reached with a deleted customer's token, so the old
    // "second call → 200 alreadyDeleted:true" assertion is stale.
    const del2 = await del();
    expect(del2.status).toBe(401);

    await cleanupCustomerWith(db, email);
  });
});
