/**
 * E2E (#773) — PDPL data-subject rights + guest/authed boundary regression net.
 *
 * Two layers:
 *  - ALWAYS run (no registration, no ratelimit): the subject-rights endpoints and the
 *    authed conversations API reject a signed-out caller with 401 — NOT 404 (which would
 *    leak nothing but also mask a broken guard), while the guest booking-initiate rail
 *    stays open. This is the policy-s8 guard that must never silently regress.
 *  - SANDBOX-GATED (E2E_ACCOUNT_ENABLED, like account-settings.spec.ts, because every
 *    registration shares the localhost IP and customerRegisterRatelimit is 5/15min): the
 *    authed export carries Cache-Control:no-store + no secrets, and account deletion is
 *    one-shot over HTTP (second call → 401, caller soft-deleted).
 */

import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { getCsrf, registerCustomer, cleanupCustomerWith } from './helpers/customer';
import { expectNoForbiddenFields } from './helpers/forbiddenFields';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

test.describe('subject-rights + guest boundary — always on (#773)', () => {
  test('signed-out callers get 401 (not 404) on the subject-rights + conversations endpoints', async ({ request }) => {
    await request.get('/'); // prime bb_csrf for non-safe methods
    const { cookies } = await request.storageState();
    const csrf = getCsrf(cookies);

    // GET export — auth-gated read.
    expect((await request.get('/api/account/export')).status()).toBe(401);
    // DELETE account — auth-gated destructive.
    expect((await request.delete('/api/account/delete', { headers: { 'X-CSRF-Token': csrf } })).status()).toBe(401);
    // Authed planner history.
    expect((await request.get('/api/planner/conversations')).status()).toBe(401);
  });

  test('guest booking-initiate is NOT auth-gated (stays open to signed-out buyers)', async ({ request }) => {
    await request.get('/');
    const { cookies } = await request.storageState();
    const csrf = getCsrf(cookies);

    // Empty body → Zod safeParse rejects with a deterministic 400 INVALID (not an auth 401
    // or existence 404): booking initiate is a guest rail.
    const res = await request.post('/api/bookings/initiate', {
      data: {},
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('authed subject-rights — gated (#773)', () => {
  const SANDBOX_ENABLED = process.env.E2E_ACCOUNT_ENABLED === 'true';
  test.skip(!SANDBOX_ENABLED, 'Set E2E_ACCOUNT_ENABLED=true to run');

  const email = `rights-${Date.now()}@e2e.example`;
  const PASSWORD = 'RightsE2E2026!';

  test.afterAll(async () => {
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
      await cleanupCustomerWith(client, email);
    } finally {
      await client.end();
    }
  });

  test('export returns no-store + leaks no secrets; delete is one-shot', async ({ page }) => {
    await page.goto('/vi');
    const csrf = getCsrf((await page.context().storageState()).cookies);
    const tok = await registerCustomer(page, BASE_URL, csrf, { email, password: PASSWORD });

    // Authed export: 200, Cache-Control no-store, no forbidden fields.
    const exp = await page.evaluate(async ([bu, t]) => {
      const r = await fetch(`${bu}/api/account/export`, { headers: { Authorization: `Bearer ${t}` }, credentials: 'include' });
      return { status: r.status, cacheControl: r.headers.get('cache-control'), body: await r.json() };
    }, [BASE_URL, tok] as const);
    expect(exp.status).toBe(200);
    expect(exp.cacheControl).toContain('no-store');
    expectNoForbiddenFields(exp.body, 'account export');

    // Delete: first → 200 alreadyDeleted false; second → 401 (caller now soft-deleted).
    const del1 = await page.evaluate(async ([bu, cs, t]) => {
      const r = await fetch(`${bu}/api/account/delete`, { method: 'DELETE', headers: { 'X-CSRF-Token': cs, Authorization: `Bearer ${t}` }, credentials: 'include' });
      return { status: r.status, body: await r.json().catch(() => null) };
    }, [BASE_URL, csrf, tok] as const);
    expect(del1.status).toBe(200);
    expect(del1.body.alreadyDeleted).toBe(false);

    const del2 = await page.evaluate(async ([bu, cs, t]) => {
      const r = await fetch(`${bu}/api/account/delete`, { method: 'DELETE', headers: { 'X-CSRF-Token': cs, Authorization: `Bearer ${t}` }, credentials: 'include' });
      return { status: r.status, body: await r.json().catch(() => null) };
    }, [BASE_URL, csrf, tok] as const);
    // 2nd-delete HTTP contract is 401 by design: del1 soft-deletes + revokes sessions, so
    // requireCustomerAuth rejects the caller before the handler. alreadyDeleted:true
    // idempotency is covered at lib level (anonymizeCustomer.int.test.ts).
    expect(del2.status).toBe(401);
  });
});
