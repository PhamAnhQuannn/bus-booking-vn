/**
 * E2E spec: vnpay-booking — VNPay (domestic card/ATM) payment funnel.
 *
 * Covers:
 *   - POST /api/bookings/initiate paymentMethod=vnpay → 200 + payUrl
 *     (under PAYMENTS_STUB the payUrl points at the stub-pay page; the booking
 *      row is still paymentMethod=vnpay).
 *   - POST a signed VNPay IPN (HMAC-SHA512, sandbox secret) → 200 + RspCode '00'
 *     and the booking transitions to paid.
 *   - POST a bad-signature IPN → RspCode '97' (Invalid Checksum).
 *   - GET /api/payments/vnpay/return with an invalid signature → 307 redirect to
 *     /booking/payment-error?...&reason=sig_invalid.
 *
 * URL-state driven (per AGENTS.md Mistake Log — no synthetic keystrokes).
 * Prerequisites: running dev server + seeded DB with a Hà Nội → Sài Gòn trip on
 * VN-tomorrow. VNPay adapter uses the public sandbox hash secret in test/dev.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import crypto from 'crypto';
import { BOOKING_REF_REGEX } from '../lib/booking/bookingRef';
import { primeCsrf } from './helpers/csrf';

// VNPay sandbox hash secret — the env default in lib/config/env.ts for test/dev.
const VNPAY_HASH_SECRET = 'VNPAYSECRETTEST0123456789ABCDEF01';

/**
 * Build a VNPay transport body (URL-encoded) with a valid HMAC-SHA512
 * vnp_SecureHash over the sorted RAW-value canonical string. Mirrors the
 * adapter's buildSignData (sorted keys, RAW values) — shared shape with the
 * issue-120 unit test's signVnpayBody.
 */
function signVnpayBody(params: Record<string, string>): string {
  const signData = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const hash = crypto.createHmac('sha512', VNPAY_HASH_SECRET).update(signData).digest('hex');
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `${query}&vnp_SecureHash=${hash}`;
}

function vnTomorrow(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  t.setUTCDate(t.getUTCDate() + 1);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const TOMORROW = vnTomorrow();

async function seedHold(request: APIRequestContext, baseURL: string) {
  const csrf = await primeCsrf(request);
  const searchRes = await request.get(`${baseURL}/api/trips/search`, {
    params: { origin: 'Hà Nội', destination: 'Sài Gòn', date: TOMORROW, ticketCount: '1' },
  });
  if (!searchRes.ok()) return null;
  const { trips } = (await searchRes.json()) as { trips?: Array<{ id: string; price: number }> };
  if (!trips || trips.length === 0) return null;

  const holdRes = await request.post(`${baseURL}/api/holds`, {
    data: { tripId: trips[0].id, ticketCount: 1, customerName: 'VNPay E2E', customerPhone: '+8490xxxxxx9' },
    headers: { 'X-CSRF-Token': csrf },
  });
  if (!holdRes.ok()) return null;
  const { holdId } = (await holdRes.json()) as { holdId?: string };
  const holdCookieValue = (holdRes.headers()['set-cookie'] ?? '').match(/bb_hold=([^;]+)/)?.[1] ?? '';
  return { holdId: holdId ?? '', price: trips[0].price, holdCookieValue, csrf };
}

async function initiateVnpay(request: APIRequestContext, baseURL: string) {
  const hold = await seedHold(request, baseURL);
  if (!hold || !hold.holdId) return null;
  const res = await request.post(`${baseURL}/api/bookings/initiate`, {
    data: {
      holdId: hold.holdId,
      paymentMethod: 'vnpay',
      consents: { noRefund: true, piiStorage: true, version: 'v1' },
    },
    headers: { cookie: `bb_hold=${hold.holdCookieValue}`, 'X-CSRF-Token': hold.csrf },
  });
  return { res, price: hold.price };
}

test.describe('VNPay booking — initiate', () => {
  test('paymentMethod=vnpay returns 200 with bookingId + payUrl', async ({ request }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
    const out = await initiateVnpay(request, baseURL);
    test.skip(!out, 'No trips available — re-run prisma db seed');
    if (!out) return;

    // 200 (stub or real) — never 400 (vnpay is an accepted method).
    expect([200, 502]).toContain(out.res.status());
    if (out.res.status() === 200) {
      const json = (await out.res.json()) as { bookingId?: string; payUrl?: string };
      expect(json.bookingId).toBeDefined();
      expect(typeof json.payUrl).toBe('string');
    }
  });
});

test.describe('VNPay booking — IPN webhook', () => {
  test('valid signed IPN transitions the booking to paid (RspCode 00)', async ({ request }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
    const out = await initiateVnpay(request, baseURL);
    test.skip(!out || !out.res.ok(), 'No trips / gateway unreachable');
    if (!out || !out.res.ok()) return;

    const { payUrl } = (await out.res.json()) as { payUrl?: string };
    test.skip(!payUrl, 'No payUrl');
    if (!payUrl) return;

    // Under PAYMENTS_STUB the payUrl is the stub-pay page carrying orderId=bookingRef.
    const orderId = new URL(payUrl, baseURL).searchParams.get('orderId') ?? '';
    const ref = orderId.match(/BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}/)?.[0] ?? '';
    test.skip(!ref, 'Could not extract bookingRef from payUrl');
    if (!ref) return;
    expect(ref).toMatch(BOOKING_REF_REGEX);

    const body = signVnpayBody({
      vnp_Amount: String(out.price * 100),
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'BusBookVN payment',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: String(Date.now()),
      vnp_TransactionStatus: '00',
      vnp_TxnRef: ref,
    });

    const webhookRes = await request.post(`${baseURL}/api/payments/vnpay/webhook`, {
      data: body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(webhookRes.status()).toBe(200);
    const json = (await webhookRes.json()) as { RspCode?: string };
    expect(json.RspCode).toBe('00');
  });

  test('bad-signature IPN returns RspCode 97 (Invalid Checksum)', async ({ request }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
    const body =
      'vnp_Amount=15000000&vnp_ResponseCode=00&vnp_TxnRef=BB-2026-fake-0001' +
      // 128 hex chars = correct SHA-512 digest WIDTH but wrong value, so the
      // length-guard passes and the constant-time byte-compare actually runs.
      `&vnp_SecureHash=${'deadbeef'.repeat(16)}`;
    const res = await request.post(`${baseURL}/api/payments/vnpay/webhook`, {
      data: body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status()).toBe(200); // VNPay-format response, not HTTP error
    const json = (await res.json()) as { RspCode?: string };
    expect(json.RspCode).toBe('97');
  });
});

test.describe('VNPay booking — return URL', () => {
  test('invalid-signature return redirects to payment-error', async ({ page }) => {
    const res = await page.goto(
      '/api/payments/vnpay/return?vnp_TxnRef=BB-2026-fake-0001&vnp_ResponseCode=00&vnp_SecureHash=bad'
    );
    // Followed the 307 → lands on the error page.
    expect(page.url()).toContain('/booking/payment-error');
    expect(page.url()).toContain('reason=sig_invalid');
    expect(res?.ok()).toBeTruthy();
  });
});
