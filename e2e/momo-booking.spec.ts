/**
 * E2E spec: the PSP webhook surface is GONE, and MoMo is not an initiable rail.
 *
 * Bank transfer (SePay) is the only live online rail. The momo / zalopay / card /
 * vnpay webhook routes — and VNPay's return route — were deleted because each was
 * reachable by anyone, exempt from CSRF and the edge rate-limit, and resolved a
 * gateway whose signing key defaulted to a literal committed in this repo.
 *
 * These tests pin the ABSENCE, which is the property that matters: the unit guard
 * (app/api/payments/__tests__/webhook-surface.test.ts) proves no route FILE exists,
 * and this proves nothing answers on the wire either — including via any future
 * catch-all or rewrite. A route that came back would flip these from 403/404 to a
 * 2xx or a 400, so re-adding one cannot pass silently.
 *
 * Also pins the two behaviours that survive: MoMo is rejected at the initiate enum,
 * and an unknown confirmation token 404s.
 */

import { test, expect } from '@playwright/test';
import { primeCsrf } from './helpers/csrf';

/** Every PSP webhook path deleted with the unreachable-surface cleanup. */
const DELETED_WEBHOOK_PATHS = [
  '/api/payments/momo/webhook',
  '/api/payments/zalopay/webhook',
  '/api/payments/card/webhook',
  '/api/payments/vnpay/webhook',
] as const;

test.describe('Deleted PSP webhook surface', () => {
  for (const path of DELETED_WEBHOOK_PATHS) {
    test(`POST ${path} never reaches a handler`, async ({ request }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';

      // Deliberately UNSIGNED and without a CSRF token — the shape an attacker
      // would send. 403 is the proxy's CSRF gate refusing a non-safe /api/* call
      // for a path no longer in CSRF_EXEMPT; 404 is Next finding no route. Either
      // proves the request died before any signature was verified. What must never
      // appear is 200 (handled) or 400 (handled, then rejected on signature) —
      // both would mean a gateway is once again verifying attacker-supplied bytes.
      const res = await request.post(`${baseURL}${path}`, {
        data: { orderId: 'BB-2026-fake-test', amount: 100000, resultCode: 0 },
        headers: { 'content-type': 'application/json' },
      });

      expect([403, 404]).toContain(res.status());
    });
  }

  test('GET /api/payments/vnpay/return never reaches a handler', async ({ request }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
    // GET is a safe method, so CSRF does not apply — this is a straight 404, and
    // notably NOT the 307 → /booking/payment-error the route used to emit.
    const res = await request.get(
      `${baseURL}/api/payments/vnpay/return?vnp_TxnRef=BB-2026-fake-0001&vnp_ResponseCode=00&vnp_SecureHash=bad`,
      { maxRedirects: 0 }
    );
    expect(res.status()).toBe(404);
  });
});

test.describe('MoMo rail — rejected at initiate', () => {
  test('paymentMethod=momo returns 400 INVALID (not an enabled method)', async ({ request }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
    // Prime CSRF so the request passes the double-submit gate and reaches the Zod
    // enum check (otherwise it 403s before the rejection we want to assert).
    const csrf = await primeCsrf(request);
    const res = await request.post(`${baseURL}/api/bookings/initiate`, {
      data: {
        holdId: 'x'.repeat(24),
        paymentMethod: 'momo',
        consents: { noRefund: true, piiStorage: true, version: 'v1' },
      },
      headers: { 'content-type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe('INVALID');
  });
});

test.describe('Booking result — unknown token', () => {
  test('unknown confirmation token returns 404', async ({ page }) => {
    const res = await page.goto(`/booking/result/${'B'.repeat(32)}`);
    expect(res?.status()).toBe(404);
  });
});
