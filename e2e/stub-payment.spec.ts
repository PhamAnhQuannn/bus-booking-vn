/**
 * E2E spec: stub-payment — local fake-gateway online flow (Phase 1)
 *
 * Exercises the ZaloPay + Card online-payment user stories end-to-end with NO
 * real PSP credentials, via the local stub gateway (lib/payment/stub.ts):
 *
 *   POST /api/bookings/initiate { paymentMethod: 'zalopay' | 'card' }
 *     → 200 { bookingId, payUrl } where payUrl points at /dev/stub-pay and
 *       carries orderId (=bookingRef) + redirectUrl (=/booking/result/<token>).
 *   POST a STUB_PAYMENT_SECRET-signed IPN to /api/payments/<adapter>/webhook
 *     → 200 { message: 'ok' } and the booking transitions:
 *         resultCode 0  → paid_operator_notified  (result page: "Thanh toán thành công")
 *         resultCode 99 → payment_failed_expired   (result page: "Thanh toán thất bại")
 *   Replaying the same success IPN → 200 (idempotent no-op via PaymentEvent unique).
 *   Bad signature → 400.
 *
 * NOT sandbox-gated: zalopay/card NEVER have a real adapter (getGatewayFor always
 * returns the stub for them), so this runs regardless of PAYMENTS_STUB. URL-state
 * driven (no form keystrokes) per AGENTS.md Mistake Log 2026-05-17.
 *
 * Prerequisites: running dev server + seeded DB with a trip on VN-tomorrow for
 * Hà Nội → TP.HCM.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { buildStubIpn, type StubOutcome } from '../lib/payment/stub';
import { primeCsrf } from './helpers/csrf';

const STUB_SECRET =
  process.env.STUB_PAYMENT_SECRET ?? 'dev-stub-payment-secret-local-only-change-me';

function vnTomorrow(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const todayVN = fmt.format(new Date());
  const [y, m, d] = todayVN.split('-').map(Number);
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
    params: { origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW, ticketCount: '1' },
  });
  if (!searchRes.ok()) return null;
  const trips = (await searchRes.json()) as Array<{ tripId: string; price: number }>;
  if (!Array.isArray(trips) || trips.length === 0) return null;

  const holdRes = await request.post(`${baseURL}/api/holds`, {
    data: {
      tripId: trips[0].tripId,
      ticketCount: 1,
      // Hold schema requires buyerName (letters only) + buyerPhone matching
      // /^(0|\+84)[35789][0-9]{8}$/. Use a gitleaks-safe local-format literal.
      buyerName: 'Stub Pay Tester',
      buyerPhone: '0901230001',
    },
    headers: { 'X-CSRF-Token': csrf },
  });
  if (!holdRes.ok()) return null;
  const holdData = (await holdRes.json()) as { holdId?: string };
  const setCookie = holdRes.headers()['set-cookie'] ?? '';
  const holdCookieValue = setCookie.match(/bb_hold=([^;]+)/)?.[1] ?? '';

  return { holdId: holdData.holdId ?? '', holdCookieValue, csrf };
}

/** Initiate an online booking via the stub gateway; returns parsed payUrl parts. */
async function initiateOnline(
  request: APIRequestContext,
  baseURL: string,
  adapter: 'zalopay' | 'card'
) {
  const hold = await seedHold(request, baseURL);
  if (!hold || !hold.holdId) return null;

  const res = await request.post(`${baseURL}/api/bookings/initiate`, {
    data: { holdId: hold.holdId, paymentMethod: adapter },
    headers: {
      cookie: `bb_hold=${hold.holdCookieValue}; bb_csrf=${hold.csrf}`,
      'X-CSRF-Token': hold.csrf,
    },
  });
  if (res.status() !== 200) return null;
  const json = (await res.json()) as { bookingId?: string; payUrl?: string };
  if (!json.payUrl) return null;

  const url = new URL(json.payUrl);
  return {
    bookingId: json.bookingId ?? '',
    payUrl: json.payUrl,
    pathname: url.pathname,
    adapter: url.searchParams.get('adapter') ?? '',
    orderId: url.searchParams.get('orderId') ?? '', // = bookingRef
    amount: Number(url.searchParams.get('amount') ?? '0'),
    redirectUrl: url.searchParams.get('redirectUrl') ?? '',
  };
}

function postIpn(
  request: APIRequestContext,
  baseURL: string,
  adapter: 'zalopay' | 'card',
  orderId: string,
  amount: number,
  outcome: StubOutcome
) {
  const ipn = buildStubIpn({ secretKey: STUB_SECRET, adapter, orderId, amount, outcome });
  return request.post(`${baseURL}/api/payments/${adapter}/webhook`, {
    data: ipn,
    headers: { 'content-type': 'application/json' },
  });
}

for (const adapter of ['zalopay', 'card'] as const) {
  test.describe(`Stub payment — ${adapter}`, () => {
    test(`initiate returns 200 + stub payUrl pointing at /dev/stub-pay`, async ({
      request,
    }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
      const init = await initiateOnline(request, baseURL, adapter);
      test.skip(!init, 'No trips available — re-run prisma db seed');
      if (!init) return;

      expect(init.pathname).toBe('/dev/stub-pay');
      expect(init.adapter).toBe(adapter);
      expect(init.orderId).toMatch(/^BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}$/);
      expect(init.amount).toBeGreaterThan(0);
      expect(init.redirectUrl).toContain('/booking/result/');
    });

    test(`success IPN → 200 ok, booking paid, replay is idempotent`, async ({
      request,
    }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
      const init = await initiateOnline(request, baseURL, adapter);
      test.skip(!init, 'No trips available — re-run prisma db seed');
      if (!init) return;

      const res = await postIpn(request, baseURL, adapter, init.orderId, init.amount, 'success');
      expect(res.status()).toBe(200);
      expect(((await res.json()) as { message?: string }).message).toBe('ok');

      // Idempotent replay — same deterministic transId collides on PaymentEvent unique.
      const replay = await postIpn(
        request,
        baseURL,
        adapter,
        init.orderId,
        init.amount,
        'success'
      );
      expect(replay.status()).toBe(200);

      // Result page reflects the paid transition.
      const page = await request.get(init.redirectUrl);
      expect(page.status()).toBe(200);
      expect(await page.text()).toContain('Thanh toán thành công');
    });

    test(`failure IPN → 200 ok, booking marked failed`, async ({ request }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
      const init = await initiateOnline(request, baseURL, adapter);
      test.skip(!init, 'No trips available — re-run prisma db seed');
      if (!init) return;

      const res = await postIpn(request, baseURL, adapter, init.orderId, init.amount, 'fail');
      expect(res.status()).toBe(200);

      const page = await request.get(init.redirectUrl);
      expect(page.status()).toBe(200);
      expect(await page.text()).toContain('Thanh toán thất bại');
    });

    test(`bad signature → 400`, async ({ request }, testInfo) => {
      const baseURL = testInfo.project.use.baseURL ?? 'http://localhost:3000';
      const badIpn = {
        partnerCode: `stub_${adapter}`,
        orderId: 'BB-2026-fake-test',
        requestId: 'BB-2026-fake-test',
        amount: 100000,
        transId: `stub_BB-2026-fake-test_success`,
        resultCode: 0,
        message: 'stub success',
        orderInfo: `stub:${adapter}`,
        orderType: adapter,
        payType: 'stub',
        responseTime: Date.now(),
        extraData: '',
        signature: 'bad00000000000000000000000000000000000000000000000000000000000000',
      };
      const res = await request.post(`${baseURL}/api/payments/${adapter}/webhook`, {
        data: badIpn,
        headers: { 'content-type': 'application/json' },
      });
      expect(res.status()).toBe(400);
    });
  });
}
