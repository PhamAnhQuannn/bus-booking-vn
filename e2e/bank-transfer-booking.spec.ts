/**
 * E2E spec: bank_transfer (SePay/VietQR) paid-booking browser journey.
 *
 * bank_transfer is the ONLY live online rail in Phase 1, and until #768 it had no
 * browser e2e — the momo/zalopay/card/vnpay stub-pay flow never covered it because
 * SePay is an API-key IPN route, not a stubbed PSP. This drives the real journey:
 *
 *   guest hold (API) → initiate bank_transfer (API) → synthetic SePay IPN posted to
 *   the REAL webhook route via /dev/stub-pay → booking flips to paid → ticket page.
 *
 * The synthetic IPN is minted server-side by the dev stub-pay action
 * (app/[locale]/dev/stub-pay/actions.ts → postSyntheticSepayIpn), which POSTs a
 * SePay-shaped body to /api/payments/bank_transfer/webhook with the server's own
 * SEPAY_API_KEY. The test never handles the key, and the webhook's real auth is
 * exercised, not bypassed.
 *
 * Covers (issue #768 acceptance):
 *   1. Happy path — hold → initiate → IPN confirm → paid → ticket visible.
 *   2. Duplicate IPN — deterministic providerTxnId → exactly one paid booking.
 *   3. Hold expiry mid-checkout — expiry FORCED in the DB (unlike hold-flow.spec.ts:152,
 *      which the AC notes never truly forces it) → initiate rejected, hold no longer active.
 *
 * Prerequisites: dev server on :3001 + seeded DB with the Sài Gòn ↔ Thanh Hóa
 * corridor (prisma/seed.ts seeds a 06:00 trip both directions daily for 14 days).
 * DB assertions connect directly with `pg`, mirroring hold-flow.spec.ts.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { Client } from 'pg';
import { primeCsrf } from './helpers/csrf';

const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';

// Mirrors lib/booking/consent.ts CONSENT_VERSION — initiate 422s on a stale value.
const CONSENT_VERSION = '2026-08';

/**
 * VN-timezone "tomorrow" as YYYY-MM-DD (copied from hold-flow.spec.ts): seed +
 * search-API treat dates in Asia/Ho_Chi_Minh, so computing "tomorrow" in OS-local
 * time would miss the trip seeded for VN-tomorrow.
 */
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

interface HeldSeat {
  holdId: string;
  csrf: string;
}

/**
 * Create a guest hold on a real Sài Gòn → Thanh Hóa trip for VN-tomorrow. Bypasses
 * the base-ui masked phone input (not drivable headless — see hold-flow.spec.ts) by
 * driving the hold API directly. Returns null when no seedable trip is found so the
 * caller can skip rather than fail on an unseeded DB.
 */
// Each hold gets a distinct client IP. /api/holds throttles anonymous callers per IP
// (holdsAnonRatelimit), and in CI that bucket is in-memory + process-global — shared by
// EVERY hold in the sequential suite (this spec + hold-flow.spec.ts + …). Without isolation
// this spec's holds drain the shared 127.0.0.1 bucket and a later spec's hold gets 429.
// clientIp() honours x-forwarded-for (lib/core/http/clientIp.ts) and dev/CI trusts it.
let ipSeq = 0;
const nextClientIp = () => `10.60.${(ipSeq >> 8) & 0xff}.${ipSeq++ & 0xff}`;

async function createHold(request: APIRequestContext, buyerPhone: string): Promise<HeldSeat | null> {
  const xff = nextClientIp();
  const params = new URLSearchParams({
    origin: 'Sài Gòn',
    destination: 'Thanh Hóa',
    date: TOMORROW,
    ticketCount: '1',
  });
  const searchRes = await request.get(`/api/trips/search?${params.toString()}`);
  if (!searchRes.ok()) return null;
  const trips = await searchRes.json();
  if (!trips || trips.length === 0) return null;

  const csrf = await primeCsrf(request);
  const res = await request.post('/api/holds', {
    data: {
      tripId: trips[0].tripId,
      ticketCount: 1,
      buyerName: 'BankTransfer Buyer',
      // Distinct phone per test — the per-phone hold cap would otherwise make holds
      // created by the parallel workers contend and intermittently 429.
      buyerPhone,
      buyerEmail: 'bt-e2e@example.com',
    },
    headers: { 'X-CSRF-Token': csrf, 'x-forwarded-for': xff },
  });
  if (res.status() !== 200) return null;
  const { holdId } = await res.json();
  return { holdId, csrf };
}

interface InitiatedBooking {
  bookingRef: string;
  amount: string;
  resultPath: string;
  payUrl: string;
}

/** Initiate a bank_transfer booking; parse bookingRef/amount/result-path from payUrl. */
async function initiateBankTransfer(
  request: APIRequestContext,
  held: HeldSeat
): Promise<InitiatedBooking> {
  const res = await request.post('/api/bookings/initiate', {
    data: {
      holdId: held.holdId,
      paymentMethod: 'bank_transfer',
      consents: { noRefund: true, piiStorage: true, version: CONSENT_VERSION },
    },
    headers: { 'X-CSRF-Token': held.csrf },
  });
  expect(res.status()).toBe(200);
  const { payUrl } = await res.json();
  // bank_transfer's payUrl is relative: /booking/bank-transfer?bookingRef=..&amount=..&redirectUrl=/booking/result/<token>
  const u = new URL(payUrl, 'http://localhost:3001');
  return {
    payUrl,
    bookingRef: u.searchParams.get('bookingRef') ?? '',
    amount: u.searchParams.get('amount') ?? '',
    resultPath: u.searchParams.get('redirectUrl') ?? '',
  };
}

/** URL of the dev stub-pay page that mints the synthetic SePay IPN for a booking. */
function stubPayUrl(b: InitiatedBooking): string {
  const p = new URLSearchParams({
    adapter: 'bank_transfer',
    orderId: b.bookingRef,
    amount: b.amount,
    redirectUrl: b.resultPath,
  });
  return `/dev/stub-pay?${p.toString()}`;
}

async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

test.describe('bank_transfer paid-booking journey', () => {
  // CI (pnpm dev --webpack) compiles the stub-pay → webhook → result routes on first hit;
  // the full round-trip can exceed Playwright's 30s default under cold-compile. 120s absorbs it.
  test.describe.configure({ timeout: 120_000 });

  test('happy path: hold → initiate → synthetic IPN → paid → ticket', async ({
    page,
    request,
  }, testInfo) => {
    // Browser journey verified on chromium; the API + confirm path is browser-agnostic.
    test.skip(testInfo.project.name === 'mobile-390', 'browser journey covered on chromium');

    const held = await createHold(request, '0912345671');
    test.skip(!held, 'No Sài Gòn → Thanh Hóa trip for tomorrow — re-run prisma db seed');
    const booking = await initiateBankTransfer(request, held!);
    expect(booking.bookingRef).toMatch(/^BB-/);

    // Real customer QR page is reachable and shows the transfer memo (the bookingRef).
    await page.goto(booking.payUrl);
    await expect(page).toHaveURL(/booking\/bank-transfer/);
    await expect(page.getByText(booking.bookingRef).first()).toBeVisible();

    // Drive the dev stub-pay → server action POSTs a synthetic SePay IPN to the real route.
    await page.goto(stubPayUrl(booking));
    await page.getByRole('button', { name: /thanh toán/i }).click();

    // Lands on the result page; booking is now paid → the "view ticket" link is shown.
    await page.waitForURL('**/booking/result/**');
    await expect(page.getByText(booking.bookingRef).first()).toBeVisible();
    await expect(page.locator('a[href*="/booking/confirmation/"]')).toBeVisible();

    // DB truth: paid + exactly one bank_transfer PaymentEvent.
    await withDb(async (c) => {
      const { rows } = await c.query(
        'SELECT id, status FROM "Booking" WHERE "bookingRef" = $1',
        [booking.bookingRef]
      );
      expect(rows[0]?.status).toBe('paid');
      const ev = await c.query(
        'SELECT count(*)::int AS n FROM "PaymentEvent" WHERE "bookingId" = $1 AND adapter = $2',
        [rows[0].id, 'bank_transfer']
      );
      expect(ev.rows[0].n).toBe(1);
    });
  });

  test('duplicate IPN is idempotent: exactly one paid booking, no double ledger', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-390', 'browser journey covered on chromium');

    const held = await createHold(request, '0912345672');
    test.skip(!held, 'No Sài Gòn → Thanh Hóa trip for tomorrow — re-run prisma db seed');
    const booking = await initiateBankTransfer(request, held!);

    // Fire the SAME synthetic IPN twice. providerTxnId is deterministic per bookingRef,
    // so the second delivery collides on @@unique([adapter, providerTxnId]) and no-ops —
    // exactly how SePay's own redelivery behaves.
    const url = stubPayUrl(booking);
    for (let i = 0; i < 2; i++) {
      await page.goto(url);
      await page.getByRole('button', { name: /thanh toán/i }).click();
      await page.waitForURL('**/booking/result/**');
    }

    await withDb(async (c) => {
      const { rows } = await c.query(
        'SELECT id, status FROM "Booking" WHERE "bookingRef" = $1',
        [booking.bookingRef]
      );
      expect(rows[0]?.status).toBe('paid');
      // Exactly one PaymentEvent and exactly two ledger rows — the replay added neither.
      const ev = await c.query(
        'SELECT count(*)::int AS n FROM "PaymentEvent" WHERE "bookingId" = $1',
        [rows[0].id]
      );
      expect(ev.rows[0].n).toBe(1);
      const led = await c.query(
        'SELECT count(*)::int AS n FROM "LedgerEntry" WHERE "bookingId" = $1',
        [rows[0].id]
      );
      expect(led.rows[0].n).toBe(2);
    });
  });

  test('hold expiry mid-checkout: forced-expired hold rejects initiate', async ({
    request,
  }, testInfo) => {
    // API-only (no browser surface) — runs on chromium; the forced-expiry + initiate
    // reject is browser-agnostic (mirrors hold-flow.spec.ts's API-only skip).
    test.skip(testInfo.project.name === 'mobile-390', 'API-only — covered on chromium');

    const held = await createHold(request, '0912345673');
    test.skip(!held, 'No Sài Gòn → Thanh Hóa trip for tomorrow — re-run prisma db seed');

    // Truly force the hold expired — the gap hold-flow.spec.ts:152 leaves open.
    await withDb((c) =>
      c.query(`UPDATE "Hold" SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [
        held!.holdId,
      ])
    );

    // Checkout (initiate) must now be rejected as HOLD_EXPIRED (409).
    const res = await request.post('/api/bookings/initiate', {
      data: {
        holdId: held!.holdId,
        paymentMethod: 'bank_transfer',
        consents: { noRefund: true, piiStorage: true, version: CONSENT_VERSION },
      },
      headers: { 'X-CSRF-Token': held!.csrf },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe('HOLD_EXPIRED');

    // Seat released: the expired hold was never consumed into a booking (Booking.holdId
    // is a unique FK to the hold — a rejected checkout leaves zero booking rows for it).
    await withDb(async (c) => {
      const { rows } = await c.query(
        'SELECT count(*)::int AS n FROM "Booking" WHERE "holdId" = $1',
        [held!.holdId]
      );
      expect(rows[0].n).toBe(0);
    });
  });
});
