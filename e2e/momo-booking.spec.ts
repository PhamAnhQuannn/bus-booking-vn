/**
 * E2E spec: momo-booking — MoMo rail is NOT an enabled payment method.
 *
 * The initiate Zod enum is ['bank_transfer','vnpay'] (issue 121). MoMo is
 * rejected at the enum layer with 400 INVALID. This spec pins that rejection so
 * MoMo can't be silently re-enabled, and still exercises the MoMo webhook route's
 * signature guard (the adapter/route ship for a future re-enable) + the shared
 * unknown-token 404.
 *
 * (Previously this spec tried to initiate a MoMo booking and silently self-skipped
 * when that failed — dead coverage. It now asserts the real current behavior.)
 */

import { test, expect } from '@playwright/test';
import { primeCsrf } from './helpers/csrf';

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

test.describe('MoMo webhook — signature guard (route still ships)', () => {
  test('IPN with bad signature returns 400', async ({ request }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
    const badIpn = {
      partnerCode: 'MOMOBKUN20180529',
      orderId: 'BB-2026-fake-test',
      resultCode: 0,
      amount: 100000,
      transId: '999',
      signature: 'badhex0000000000000000000000000000000000000000000000000000000000',
      requestId: 'req-bad',
      orderInfo: 'test',
      orderType: 'momo_wallet',
      payType: 'qr',
      responseTime: Date.now(),
      extraData: '',
      message: 'test',
    };
    const res = await request.post(`${baseURL}/api/payments/momo/webhook`, {
      data: badIpn,
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Booking result — unknown token', () => {
  test('unknown confirmation token returns 404', async ({ page }) => {
    const res = await page.goto(`/booking/result/${'B'.repeat(32)}`);
    expect(res?.status()).toBe(404);
  });
});
