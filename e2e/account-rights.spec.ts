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
 *    idempotent (second call → alreadyDeleted).
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

    // Minimal/empty body → the handler may 400, but it must NOT be an auth (401) or
    // existence (404) rejection: booking initiate is a guest rail.
    const res = await request.post('/api/bookings/initiate', {
      data: {},
      headers: { 'X-CSRF-Token': csrf },
    });
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(404);
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

  test('export returns no-store + leaks no secrets; delete is idempotent', async ({ page }) => {
    await page.goto('/vi');
    const csrf = getCsrf((await page.context().storageState()).cookies);
    await registerCustomer(page, BASE_URL, csrf, { email, password: PASSWORD });

    // Authed export: 200, Cache-Control no-store, no forbidden fields.
    const exp = await page.evaluate(async (bu) => {
      const r = await fetch(`${bu}/api/account/export`, { credentials: 'include' });
      return { status: r.status, cacheControl: r.headers.get('cache-control'), body: await r.json() };
    }, BASE_URL);
    expect(exp.status).toBe(200);
    expect(exp.cacheControl).toContain('no-store');
    expectNoForbiddenFields(exp.body, 'account export');

    // Delete is idempotent: first → alreadyDeleted false; second → alreadyDeleted true.
    const del1 = await page.evaluate(async ([bu, cs]) => {
      const r = await fetch(`${bu}/api/account/delete`, { method: 'DELETE', headers: { 'X-CSRF-Token': cs }, credentials: 'include' });
      return { status: r.status, body: await r.json() };
    }, [BASE_URL, csrf] as const);
    expect(del1.status).toBe(200);
    expect(del1.body.alreadyDeleted).toBe(false);

    const del2 = await page.evaluate(async ([bu, cs]) => {
      const r = await fetch(`${bu}/api/account/delete`, { method: 'DELETE', headers: { 'X-CSRF-Token': cs }, credentials: 'include' });
      return { status: r.status, body: await r.json() };
    }, [BASE_URL, csrf] as const);
    expect(del2.status).toBe(200);
    expect(del2.body.alreadyDeleted).toBe(true);
  });
});
