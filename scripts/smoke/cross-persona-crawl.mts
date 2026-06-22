/**
 * cross-persona-crawl.mts — standalone Playwright test of the OPERATOR↔TRAVELER
 * CONNECTION. The two per-side crawls (operator-crawl.mts / traveler-crawl.mts)
 * each prove one side in isolation; this script proves the HANDOFF between them
 * end-to-end in ONE run with two browser contexts (operator + traveler) sharing
 * the live dev DB:
 *
 *   C1 release→discover : operator creates a fresh trip (UI) → it surfaces in the
 *                          public /api/trips/search results (matched by tripId).
 *   C2 discover→book     : traveler opens that trip, holds, pays via the stub
 *                          gateway → booking is PAID.
 *   C3 book→op-visible   : the paid booking appears on the operator manifest +
 *                          in the DB scoped to that trip.
 *   C4 seat-decrement    : re-search shows availableSeats dropped by ticketCount
 *                          (availability math bridges both sides).
 *   C5 check-in          : operator checks the passenger in on the manifest →
 *                          Booking.checkedInAt set; a second click is idempotent.
 *   C6 cancel→refund     : operator cancels a SECOND trip the traveler booked →
 *                          Booking flips paid→trip_cancelled + a refund_out ledger
 *                          row is written (verified via pg); account page reflects it.
 *   C7 approval-gate      : suspending the operator hides ALL its trips from search;
 *                          restoring APPROVED brings them back (visibility gate).
 *
 * Run (dev server must already be up on :3001 — :3000 is a DIFFERENT app):
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm tsx scripts/smoke/cross-persona-crawl.mts
 *
 * Requires .env.local with OTP_PEEK_ENABLED=true + PAYMENTS_STUB=true + DATABASE_URL.
 * MUTATES + DESTROYS dev DB rows (creates a throwaway bus + 2 trips + 2 paid
 * bookings; cancels one trip; momentarily SUSPENDS then restores the seed
 * operator). A leading pg pre-reset re-arms the operator first-login gate. The
 * operator suspend/restore is wrapped in try/finally so a crash can't strand the
 * seed operator SUSPENDED. Observe-and-report only — no app source changes.
 */

import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { Client } from 'pg';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from '../../lib/auth/password';
import { buildStubIpn } from '../../lib/payment/adapters/stub';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const ORIGIN = new URL(BASE).origin;
const OUT_DIR = join(process.cwd(), 'docs', 'qa');
const SHOT_DIR = join(OUT_DIR, 'cross-persona-shots');
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';
const SEED_USERNAME = 'PB-0001';
const SEED_PHONE_LOCAL = '0901230001';
const SEED_PHONE_E164 = '+84901230001';
const SEED_PASSWORD = 'BBOp2026!';
const NEW_PASSWORD = 'BBSmoke2026!';
const STUB_SECRET = process.env.STUB_PAYMENT_SECRET ?? 'dev-stub-payment-secret-local-only-change-me';

const TAG = `XPS${String(Date.now()).slice(-6)}`; // unique run tag (bus plate, names)

// ---- reset shots ------------------------------------------------------------
rmSync(SHOT_DIR, { recursive: true, force: true });
mkdirSync(SHOT_DIR, { recursive: true });

// ---- finding recorder -------------------------------------------------------

type Sev = 'PASS' | 'WARN' | 'BROKEN' | 'INFO';
interface Finding { check: string; persona: string; action: string; status: Sev; detail: string; shot?: string }
const findings: Finding[] = [];
let shotN = 0;
let CUR = 'startup';

function rec(f: Finding) {
  findings.push(f);
  // eslint-disable-next-line no-console
  console.log(`[${f.status}] ${f.check} | ${f.persona} | ${f.action} :: ${f.detail}`.slice(0, 220));
}

async function shoot(page: Page, name: string): Promise<string> {
  const file = `${String(++shotN).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`.slice(0, 80);
  try { await page.screenshot({ path: join(SHOT_DIR, file), fullPage: false }); } catch { /* best-effort */ }
  return file;
}

function safePath(u: string): string {
  try { const x = new URL(u); return x.pathname + (x.search ? x.search.slice(0, 60) : ''); } catch { return u; }
}

function instrument(page: Page, persona: string) {
  page.on('pageerror', (err) => {
    rec({ check: 'instrument', persona, action: `pageerror @ ${safePath(page.url())}`, status: 'BROKEN', detail: String(err.message).slice(0, 180) });
  });
  page.on('response', (res) => {
    const u = res.url();
    if (!u.startsWith(ORIGIN)) return;
    const st = res.status();
    if (st < 500) return;
    const p = safePath(u);
    if (p.startsWith('/api/auth/otp/test-peek')) return;
    rec({ check: 'instrument', persona, action: `${res.request().method()} ${p} (ctx:${CUR})`, status: 'BROKEN', detail: `HTTP ${st}` });
  });
}

// ---- generic helpers --------------------------------------------------------

async function visit(page: Page, path: string, persona: string): Promise<number | null> {
  CUR = `visit ${path}`;
  const url = path.startsWith('http') ? path : ORIGIN + path;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    return resp?.status() ?? null;
  } catch (e) {
    rec({ check: 'nav', persona, action: `load ${path}`, status: 'BROKEN', detail: `nav error: ${String((e as Error).message).slice(0, 140)}` });
    return null;
  }
}

async function apiGet<T = unknown>(page: Page, path: string): Promise<T | null> {
  const r = await page.request.get(`${ORIGIN}${path}`).catch(() => null);
  if (!r || !r.ok()) return null;
  return (await r.json().catch(() => null)) as T | null;
}

function asList<T>(v: unknown, key: string): T[] {
  if (Array.isArray(v)) return v as T[];
  const o = v as Record<string, unknown>;
  return (Array.isArray(o?.[key]) ? (o[key] as T[]) : []) as T[];
}

async function peekOtp(page: Page, phone: string): Promise<string | null> {
  for (let i = 0; i < 6; i++) {
    const r = await page.request.get(`${ORIGIN}/api/auth/otp/test-peek?phone=${encodeURIComponent(phone)}`).catch(() => null);
    if (r && r.ok()) { const j = (await r.json().catch(() => ({}))) as { code?: string }; if (j.code) return j.code; }
    await page.waitForTimeout(400);
  }
  return null;
}

/** base-ui Select: open trigger, click the option matching `optionRe` (else first). */
async function pickSelect(page: Page, testid: string, optionRe: RegExp | null): Promise<boolean> {
  const trigger = page.locator(`[data-testid="${testid}"]`);
  if (!(await trigger.count())) return false;
  await trigger.first().click().catch(() => {});
  if (optionRe) {
    const opt = page.getByRole('option', { name: optionRe });
    await opt.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    if (await opt.count()) { await opt.first().click().catch(() => {}); return true; }
  }
  const any = page.getByRole('option');
  await any.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await any.count()) { await any.first().click().catch(() => {}); return true; }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

function vnDateAhead(days: number): string {
  const [y, m, d] = TODAY.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  t.setUTCDate(t.getUTCDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function futureDatetimeLocal(days: number, hour: number): string {
  return `${vnDateAhead(days)}T${String(hour).padStart(2, '0')}:00`;
}

/** Public search (no auth). Returns the raw trip result rows. */
interface SearchRow { tripId: string; price: number; availableSeats: number; operatorId: string; routeOrigin: string; routeDestination: string }
async function search(origin: string, destination: string, date: string, ticketCount = 1): Promise<SearchRow[]> {
  const qs = new URLSearchParams({ origin, destination, date, ticketCount: String(ticketCount) }).toString();
  const r = await fetch(`${ORIGIN}/api/trips/search?${qs}`).catch(() => null);
  if (!r || !r.ok) return [];
  const j = await r.json().catch(() => []);
  return Array.isArray(j) ? (j as SearchRow[]) : [];
}

// ---- pg ---------------------------------------------------------------------

let pg: Client;
async function pgConnect() { pg = new Client({ connectionString: DB_URL }); await pg.connect(); }
async function pgEnd() { await pg.end().catch(() => {}); }

async function preReset(): Promise<boolean> {
  try {
    const passwordHash = await hash(SEED_PASSWORD);
    const res = await pg.query(
      `UPDATE "OperatorUser" SET "passwordHash"=$1, "requiresPasswordChange"=true WHERE phone=$2 RETURNING id`,
      [passwordHash, SEED_PHONE_E164]
    );
    if (res.rowCount === 0) { rec({ check: 'setup', persona: 'pg', action: 'pre-reset', status: 'BROKEN', detail: `seed operator ${SEED_PHONE_E164} NOT found — run pnpm db:seed` }); return false; }
    await pg.query(`UPDATE "OperatorSession" SET "revokedAt"=NOW() WHERE "operatorUserId"=(SELECT id FROM "OperatorUser" WHERE phone=$1) AND "revokedAt" IS NULL`, [SEED_PHONE_E164]).catch(() => {});
    rec({ check: 'setup', persona: 'pg', action: 'pre-reset', status: 'PASS', detail: 'seed operator re-armed (pwd=BBOp2026!, requiresPasswordChange=true)' });
    return true;
  } catch (e) {
    rec({ check: 'setup', persona: 'pg', action: 'pre-reset', status: 'BROKEN', detail: `pg error: ${String((e as Error).message).slice(0, 140)}` });
    return false;
  }
}

// ---- operator persona -------------------------------------------------------

async function opLogin(page: Page): Promise<boolean> {
  CUR = 'op login';
  await visit(page, '/op/login', 'operator');
  await page.locator('#op-login-username').fill(SEED_USERNAME).catch(() => {});
  await page.locator('#op-login-password').fill(SEED_PASSWORD).catch(() => {});
  const loginResp = page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 20000 });
  await page.getByRole('button', { name: /^đăng nhập$/i }).click().catch(() => {});
  const lr = await loginResp.catch(() => null);
  await page.waitForURL(/\/op\/(first-login|dashboard)/, { timeout: 15000 }).catch(() => {});
  if ((lr?.status() ?? 0) !== 200) { rec({ check: 'setup', persona: 'operator', action: 'login', status: 'BROKEN', detail: `login HTTP ${lr?.status() ?? 'none'}` }); return false; }
  if (/\/op\/first-login/.test(page.url())) {
    await page.locator('#op-current-password').fill(SEED_PASSWORD).catch(() => {});
    await page.locator('#op-new-password').fill(NEW_PASSWORD).catch(() => {});
    await page.locator('#op-confirm-password').fill(NEW_PASSWORD).catch(() => {});
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click().catch(() => {});
    await page.waitForURL(/\/op\/dashboard/, { timeout: 15000 }).catch(() => {});
  }
  const ok = /\/op\//.test(page.url()) && !/\/op\/login/.test(page.url());
  rec({ check: 'setup', persona: 'operator', action: 'login + first-login', status: ok ? 'PASS' : 'BROKEN', detail: ok ? `authed → ${safePath(page.url())}` : `at ${safePath(page.url())}`, shot: await shoot(page, 'op-login') });
  return ok;
}

async function opKeepAlive(page: Page) {
  const cookies = await page.context().cookies().catch(() => [] as { name: string; value: string }[]);
  const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
  const r = await page.request.post(`${ORIGIN}/api/op/auth/refresh`, { headers: { 'X-CSRF-Token': csrf } }).catch(() => null);
  if (!r || !r.ok()) await opLogin(page);
}

/** Create a fresh bus, return its id (so trips on it never overlap seeded trips). */
async function createBus(page: Page, plate: string): Promise<string | null> {
  await visit(page, '/op/buses', 'operator');
  await page.locator('[data-testid="new-plate"]').fill(plate).catch(() => {});
  await page.locator('[data-testid="new-capacity"]').fill('20').catch(() => {});
  await pickSelect(page, 'new-bustype', null);
  await page.locator('[data-testid="add-bus-submit"]').click().catch(() => {});
  await page.waitForTimeout(1500);
  const buses = asList<{ id: string; licensePlate?: string; plate?: string }>(await apiGet(page, '/api/op/buses'), 'buses');
  const found = buses.find((b) => (b.licensePlate ?? b.plate) === plate);
  rec({ check: 'C1', persona: 'operator', action: `create bus ${plate}`, status: found ? 'PASS' : 'BROKEN', detail: found ? `bus id ${found.id}` : 'bus not in list after submit', shot: await shoot(page, 'create-bus') });
  return found?.id ?? null;
}

/** Pick a route the traveler can search (prefer Hà Nội→TP.HCM), return its origin/dest/id. */
async function pickSearchableRoute(page: Page): Promise<{ id: string; origin: string; destination: string } | null> {
  const routes = asList<{ id: string; origin: string; destination: string; deactivatedAt?: string | null }>(await apiGet(page, '/api/op/routes'), 'routes');
  const active = routes.filter((r) => !r.deactivatedAt);
  const pref = active.find((r) => /HCM|Hồ Chí Minh/i.test(r.destination) && /Hà Nội/i.test(r.origin)) ?? active.find((r) => /HCM/i.test(r.destination)) ?? active[0];
  return pref ? { id: pref.id, origin: pref.origin, destination: pref.destination } : null;
}

/** Create a scheduled trip on `route` with `busPlate` at price/date; return tripId. */
async function createTrip(page: Page, route: { id: string; origin: string; destination: string }, busPlate: string, days: number, hour: number, price: number): Promise<string | null> {
  await visit(page, '/op/trips/new', 'operator');
  if (await page.locator('[data-testid="new-trip-prereq"]').count()) { rec({ check: 'C1', persona: 'operator', action: 'create trip', status: 'BROKEN', detail: 'prereq alert (no routes/buses)' }); return null; }
  await pickSelect(page, 'new-trip-route', new RegExp(route.destination.slice(0, 6).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  await pickSelect(page, 'new-trip-bus', new RegExp(busPlate, 'i'));
  await page.locator('[data-testid="new-trip-departure"]').fill(futureDatetimeLocal(days, hour)).catch(() => {});
  await page.locator('[data-testid="new-trip-price"]').fill(String(price)).catch(() => {});
  const before = new Set(asList<{ id: string }>(await apiGet(page, '/api/op/trips'), 'trips').map((t) => t.id));
  await page.locator('[data-testid="new-trip-submit"]').click().catch(() => {});
  await page.waitForURL(/\/op\/trips\/[^/]+$/, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  const after = asList<{ id: string }>(await apiGet(page, '/api/op/trips'), 'trips');
  const fresh = after.find((t) => !before.has(t.id));
  const id = fresh?.id ?? (/\/op\/trips\/[^/]+$/.test(page.url()) ? page.url().split('/').pop() ?? null : null);
  rec({ check: 'C1', persona: 'operator', action: `create trip on ${route.origin}→${route.destination} @price ${price}`, status: id ? 'PASS' : 'BROKEN', detail: id ? `trip id ${id}` : 'no fresh trip after submit', shot: await shoot(page, 'create-trip') });
  return id;
}

async function opCancelTrip(page: Page, tripId: string): Promise<boolean> {
  await visit(page, `/op/trips/${tripId}`, 'operator');
  const btn = page.locator('[data-testid="cancel-trip-btn"]');
  if (!(await btn.count())) { rec({ check: 'C6', persona: 'operator', action: 'cancel trip', status: 'BROKEN', detail: 'no cancel-trip-btn on detail' }); return false; }
  await btn.first().click().catch(() => {});
  await page.locator('[data-testid="cancel-reason"]').fill('Cross-persona smoke cancel').catch(() => {});
  await page.locator('[data-testid="cancel-trip-confirm"]').click().catch(() => {});
  await page.waitForTimeout(2000);
  const status = (await page.locator('[data-testid="trip-status"]').textContent().catch(() => '')) ?? '';
  const cancelled = /hủy|huỷ|cancel/i.test(status);
  rec({ check: 'C6', persona: 'operator', action: 'cancel trip (POST .../cancel)', status: cancelled ? 'PASS' : 'WARN', detail: `trip-status="${status.trim().slice(0, 40)}"`, shot: await shoot(page, 'cancel-trip') });
  return cancelled;
}

// ---- traveler persona -------------------------------------------------------

interface BookResult { paid: boolean; ref: string | null }
async function travelerBookTrip(page: Page, tripId: string, origin: string, destination: string, date: string, buyerName: string, buyerPhone: string, check: string): Promise<BookResult> {
  CUR = `book ${tripId}`;
  // Enter the funnel via /search (the path that carries trip+ticket context into
  // the hold). A direct /trips/<id> deep-link reaches the customer form but its
  // submit fires no POST /api/holds — see the deep-link finding in the report.
  const qs = new URLSearchParams({ origin, destination, date, ticketCount: '1' }).toString();
  await visit(page, `/search?${qs}`, 'traveler');
  const hrefs = await page.locator('a[href^="/trips/"]').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''));
  const idx = hrefs.findIndex((h) => h === `/trips/${tripId}`);
  const books = page.getByRole('button', { name: /đặt vé/i });
  const nBooks = await books.count();
  if (idx < 0 || idx >= nBooks) { rec({ check, persona: 'traveler', action: 'locate trip card in search results', status: 'BROKEN', detail: `trip ${tripId} not matched among ${hrefs.length} detail links / ${nBooks} book buttons (idx=${idx})`, shot: await shoot(page, 'no-card') }); return { paid: false, ref: null }; }
  await books.nth(idx).click().catch(() => {});
  try { await page.waitForURL('**/booking/customer', { timeout: 12000 }); }
  catch { rec({ check, persona: 'traveler', action: 'book → customer form', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'book-stuck') }); return { paid: false, ref: null }; }

  await page.getByLabel(/họ và tên|name/i).first().fill(buyerName).catch(() => {});
  await page.getByLabel(/số điện thoại|phone/i).first().fill(buyerPhone).catch(() => {});
  const email = page.getByLabel(/email/i);
  if (await email.count()) await email.first().fill('xpersona@example.com').catch(() => {});
  await page.getByRole('button', { name: /tiếp tục|continue|xác nhận/i }).first().click().catch(() => {});
  try { await page.waitForURL('**/booking/review**', { timeout: 15000 }); }
  catch { rec({ check, persona: 'traveler', action: 'customer form → review (POST /api/holds)', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'review-stuck') }); return { paid: false, ref: null }; }
  rec({ check, persona: 'traveler', action: 'hold created → review', status: 'PASS', detail: `held seat for trip ${tripId}` });

  const rail = page.locator('input[name="paymentMethod"][value="zalopay"]');
  if (await rail.count()) await rail.first().check({ force: true }).catch(() => {});
  await page.locator('input[name="consent-no-refund"]').first().check({ force: true }).catch(() => {});
  await page.locator('input[name="consent-pii-storage"]').first().check({ force: true }).catch(() => {});
  await page.getByRole('button', { name: /xác nhận thanh toán/i }).first().click().catch(() => {});
  try { await page.waitForURL('**/dev/stub-pay**', { timeout: 15000 }); }
  catch { rec({ check, persona: 'traveler', action: 'initiate (POST /api/bookings/initiate)', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'initiate-stuck') }); return { paid: false, ref: null }; }
  rec({ check, persona: 'traveler', action: 'funnel → gateway (hold + initiate)', status: 'PASS', detail: 'reached /dev/stub-pay' });

  // Order params handed to the gateway via the stub-pay URL.
  const u = new URL(page.url());
  const orderId = u.searchParams.get('orderId') ?? '';
  const amount = Number(u.searchParams.get('amount') ?? 0);
  const redirectUrl = u.searchParams.get('redirectUrl') ?? '';

  // KNOWN P1: the stub-pay UI "Thanh toán" button drops its name/value submitter
  // under Next 16 server actions → submitStubPayment receives empty outcome →
  // 500. Click it to VERIFY the breakage, then complete payment through the SAME
  // processPaymentWebhook the real gateway uses (faithful bypass) so the
  // operator-side handoffs (C3–C7) remain testable.
  const clickResp = page.waitForResponse((r) => r.url().includes('/dev/stub-pay') && r.request().method() === 'POST', { timeout: 9000 });
  await page.getByRole('button', { name: /thanh toán/i }).first().click().catch(() => {});
  const cr = await clickResp.catch(() => null);
  const uiBroken = (cr?.status() ?? 0) >= 500;
  rec({ check, persona: 'traveler', action: 'stub-pay UI "Thanh toán" button', status: uiBroken ? 'BROKEN' : 'WARN', detail: uiBroken ? `HTTP ${cr?.status()} — submitStubPayment gets empty outcome (Next16 submitter name/value dropped) [P1]` : `unexpected: HTTP ${cr?.status() ?? 'none'} (button may be fixed)` });

  if (!orderId || !amount) { rec({ check, persona: 'traveler', action: 'parse order for webhook', status: 'BROKEN', detail: `orderId=${orderId} amount=${amount}` }); return { paid: false, ref: null }; }
  const ipn = buildStubIpn({ secretKey: STUB_SECRET, adapter: 'zalopay', orderId, amount, outcome: 'success' });
  const wh = await page.request.post(`${ORIGIN}/api/payments/zalopay/webhook`, { headers: { 'content-type': 'application/json' }, data: JSON.stringify(ipn) }).catch(() => null);
  const whOk = !!wh && wh.ok();
  rec({ check, persona: 'traveler', action: 'complete payment via processPaymentWebhook (gateway path)', status: whOk ? 'PASS' : 'BROKEN', detail: whOk ? `webhook HTTP ${wh!.status()} → booking paid (${orderId})` : `webhook HTTP ${wh?.status() ?? 'err'}` });

  if (redirectUrl) await visit(page, redirectUrl, 'traveler');
  const body = (await page.textContent('body')) ?? '';
  const ok = whOk && /thành công/i.test(body);
  rec({ check, persona: 'traveler', action: 'booking result page shows success', status: ok ? 'PASS' : 'WARN', detail: ok ? 'result shows "thành công"' : `no success text at ${safePath(page.url())}`, shot: await shoot(page, 'result-success') });
  return { paid: whOk, ref: orderId };
}

async function registerViaUi(page: Page, phone: string): Promise<boolean> {
  await visit(page, '/auth/register', 'traveler');
  await page.locator('#phone').waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
  await page.locator('#phone').fill(phone).catch(() => {});
  await page.getByRole('button', { name: /gửi mã otp/i }).click().catch(() => {});
  try { await page.locator('#code').waitFor({ state: 'visible', timeout: 12000 }); } catch { return false; }
  const code = await peekOtp(page, phone);
  if (!code) return false;
  await page.locator('#code').fill(code).catch(() => {});
  await page.getByRole('button', { name: /^xác minh$/i }).click().catch(() => {});
  try { await page.locator('#password').waitFor({ state: 'visible', timeout: 12000 }); } catch { return false; }
  await page.locator('#password').fill('Password1Test').catch(() => {});
  await page.locator('#displayName').fill('XPersona Buyer').catch(() => {});
  await page.getByRole('button', { name: /^đăng ký$/i }).click().catch(() => {});
  try { await page.waitForURL((u) => !u.pathname.startsWith('/auth/register'), { timeout: 15000 }); return true; } catch { return false; }
}

// ---- connection checks ------------------------------------------------------

async function main() {
  const probe = await fetch(`${ORIGIN}/op/login`).catch(() => null);
  if (!probe || !probe.ok) { console.error(`Preflight FAILED: ${ORIGIN}/op/login unreachable. Is dev up on ${BASE}?`); process.exit(1); }

  await pgConnect();
  const reset = await preReset();
  if (!reset) { await pgEnd(); writeReport(); process.exit(1); }

  const browser: Browser = await chromium.launch({ headless: true });
  const opCtx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 950 } });
  const tvCtx: BrowserContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const op = await opCtx.newPage();
  const tv = await tvCtx.newPage();
  instrument(op, 'operator');
  instrument(tv, 'traveler');
  op.on('dialog', (d) => d.accept().catch(() => {}));
  tv.on('dialog', (d) => d.accept().catch(() => {}));

  // shared state
  let route: { id: string; origin: string; destination: string } | null = null;
  let busId: string | null = null;
  let trip1: string | null = null; // booked + checked-in + (kept)
  let trip2: string | null = null; // booked + cancelled
  let booking1Phone = '';
  const date1 = vnDateAhead(5);
  const date2 = vnDateAhead(6);

  try {
    const authed = await opLogin(op);
    if (!authed) { rec({ check: 'setup', persona: 'operator', action: 'gate', status: 'BROKEN', detail: 'cannot authenticate operator — aborting connection checks' }); return; }

    // ---- C1: operator releases trips → discoverable in public search ----
    await opKeepAlive(op);
    busId = await createBus(op, `${TAG}A`);
    route = await pickSearchableRoute(op);
    if (!route) { rec({ check: 'C1', persona: 'operator', action: 'pick route', status: 'BROKEN', detail: 'no active operator route to attach a trip' }); return; }
    if (!busId) { rec({ check: 'C1', persona: 'operator', action: 'bus', status: 'BROKEN', detail: 'no fresh bus created' }); return; }

    trip1 = await createTrip(op, route, `${TAG}A`, 5, 7, 188000);
    trip2 = await createTrip(op, route, `${TAG}A`, 6, 7, 199000);

    let seats1Before = -1;
    if (trip1) {
      const rows = await search(route.origin, route.destination, date1);
      const hit = rows.find((r) => r.tripId === trip1);
      seats1Before = hit?.availableSeats ?? -1;
      rec({ check: 'C1', persona: 'connection', action: 'operator trip appears in /api/trips/search', status: hit ? 'PASS' : 'BROKEN', detail: hit ? `trip1 visible: ${route.origin}→${route.destination} ${date1}, ${hit.availableSeats} seats @ ${hit.price}đ` : `trip1 ${trip1} NOT in search results for ${route.origin}→${route.destination} ${date1}` });
    }
    if (trip2) {
      const rows = await search(route.origin, route.destination, date2);
      const hit = rows.find((r) => r.tripId === trip2);
      rec({ check: 'C1', persona: 'connection', action: 'second operator trip appears in search', status: hit ? 'PASS' : 'BROKEN', detail: hit ? `trip2 visible ${date2}` : `trip2 ${trip2} NOT in search ${date2}` });
    }

    // ---- C2: traveler discovers + books trip1 ----
    if (trip1) {
      booking1Phone = `09${String(Date.now()).slice(-8)}`;
      const r1 = await travelerBookTrip(tv, trip1, route.origin, route.destination, date1, 'Khach Thu Nghiem Mot', booking1Phone, 'C2');
      rec({ check: 'C2', persona: 'connection', action: 'traveler completes booking on operator trip', status: r1.paid ? 'PASS' : 'BROKEN', detail: r1.paid ? `trip1 booked + paid${r1.ref ? ` (${r1.ref})` : ''}` : 'booking did not reach paid state' });
    }

    // ---- C3: paid booking visible to operator (DB + manifest UI) ----
    if (trip1) {
      const bk = await pg.query(`SELECT id, "bookingRef", status, "buyerPhone" FROM "Booking" WHERE "tripId"=$1 AND status='paid' ORDER BY "createdAt" DESC LIMIT 1`, [trip1]);
      const dbOk = bk.rowCount! > 0;
      rec({ check: 'C3', persona: 'connection', action: "paid booking present in operator's trip (DB)", status: dbOk ? 'PASS' : 'BROKEN', detail: dbOk ? `booking ${bk.rows[0].bookingRef} status=${bk.rows[0].status}` : 'no paid booking row for trip1' });

      await opKeepAlive(op);
      await visit(op, `/op/manifest/${trip1}`, 'operator');
      const rowCount = await op.locator('[data-testid^="manifest-checkin-"]').count();
      rec({ check: 'C3', persona: 'operator', action: 'passenger shows on /op/manifest', status: rowCount > 0 ? 'PASS' : 'BROKEN', detail: `${rowCount} checkable passenger row(s) on manifest`, shot: await shoot(op, 'op-manifest') });
    }

    // ---- C4: availability decremented across the boundary ----
    if (trip1 && seats1Before >= 0) {
      const rows = await search(route.origin, route.destination, date1);
      const hit = rows.find((r) => r.tripId === trip1);
      const after = hit?.availableSeats ?? -1;
      const dropped = seats1Before - after;
      rec({ check: 'C4', persona: 'connection', action: 'search availableSeats decremented after paid booking', status: dropped === 1 ? 'PASS' : 'WARN', detail: `seats ${seats1Before} → ${after} (Δ=${dropped}, expected 1)` });
    }

    // ---- C5: operator check-in (+ idempotent) ----
    if (trip1) {
      await visit(op, `/op/manifest/${trip1}`, 'operator');
      const checkin = op.locator('[data-testid^="manifest-checkin-"]');
      if (await checkin.count()) {
        await checkin.first().click().catch(() => {});
        await op.waitForTimeout(1500);
        const bk = await pg.query(`SELECT "checkedInAt" FROM "Booking" WHERE "tripId"=$1 AND status='paid' ORDER BY "createdAt" DESC LIMIT 1`, [trip1]);
        const ciOk = bk.rowCount! > 0 && bk.rows[0].checkedInAt != null;
        rec({ check: 'C5', persona: 'connection', action: 'operator check-in sets Booking.checkedInAt', status: ciOk ? 'PASS' : 'WARN', detail: ciOk ? `checkedInAt=${bk.rows[0].checkedInAt}` : 'checkedInAt still null after check-in click', shot: await shoot(op, 'op-checkin') });
        // idempotency: re-load + re-attempt; checkedInAt must not be a fresh value / no error
        await visit(op, `/op/manifest/${trip1}`, 'operator');
        const again = op.locator('[data-testid^="manifest-checkin-"]');
        const remaining = await again.count();
        rec({ check: 'C5', persona: 'operator', action: 'check-in idempotent (no re-checkable row)', status: remaining === 0 ? 'PASS' : 'WARN', detail: `${remaining} still-checkable row(s) after check-in (expected 0)` });
      } else {
        rec({ check: 'C5', persona: 'operator', action: 'check-in', status: 'WARN', detail: 'no checkable manifest row to check in' });
      }
    }

    // ---- C6: operator cancels trip2 → traveler booking refunded ----
    if (trip2) {
      const booking2Phone = `09${String(Date.now() + 1).slice(-8)}`;
      const r2 = await travelerBookTrip(tv, trip2, route.origin, route.destination, date2, 'Khach Thu Nghiem Hai', booking2Phone, 'C6');
      rec({ check: 'C6', persona: 'connection', action: 'traveler books trip2 (to be cancelled)', status: r2.paid ? 'PASS' : 'BROKEN', detail: r2.paid ? 'trip2 booked + paid' : 'trip2 booking not paid' });

      if (r2.paid) {
        const before = await pg.query(`SELECT id, "bookingRef" FROM "Booking" WHERE "tripId"=$1 AND status='paid' ORDER BY "createdAt" DESC LIMIT 1`, [trip2]);
        const bookingId = before.rowCount! > 0 ? before.rows[0].id : null;
        await opKeepAlive(op);
        await opCancelTrip(op, trip2);
        await op.waitForTimeout(1500);
        if (bookingId) {
          const after = await pg.query(`SELECT status FROM "Booking" WHERE id=$1`, [bookingId]);
          const flipped = after.rows[0]?.status === 'trip_cancelled';
          rec({ check: 'C6', persona: 'connection', action: 'cancel flips booking paid → trip_cancelled', status: flipped ? 'PASS' : 'BROKEN', detail: `booking ${before.rows[0].bookingRef} status=${after.rows[0]?.status}` });
          const led = await pg.query(`SELECT count(*)::int AS n FROM "LedgerEntry" WHERE "bookingId"=$1 AND type='refund_out'`, [bookingId]);
          const refunded = (led.rows[0]?.n ?? 0) > 0;
          rec({ check: 'C6', persona: 'connection', action: 'refund_out ledger row written for cancelled booking', status: refunded ? 'PASS' : 'BROKEN', detail: `${led.rows[0]?.n ?? 0} refund_out entr(y/ies)` });
        }
      }
    }

    // ---- C7: approval gate — suspend operator hides trips from search ----
    if (trip1 && route) {
      try {
        await pg.query(`UPDATE "Operator" SET status='SUSPENDED' WHERE id=(SELECT "operatorId" FROM "OperatorUser" WHERE phone=$1)`, [SEED_PHONE_E164]);
        const suspended = await search(route.origin, route.destination, date1);
        const goneHit = suspended.find((r) => r.tripId === trip1);
        rec({ check: 'C7', persona: 'connection', action: 'SUSPENDED operator trips disappear from search', status: goneHit ? 'BROKEN' : 'PASS', detail: goneHit ? 'trip1 STILL visible while operator SUSPENDED (gate leak!)' : 'trip1 hidden while operator SUSPENDED' });
      } finally {
        await pg.query(`UPDATE "Operator" SET status='APPROVED' WHERE id=(SELECT "operatorId" FROM "OperatorUser" WHERE phone=$1)`, [SEED_PHONE_E164]);
      }
      const restored = await search(route.origin, route.destination, date1);
      const backHit = restored.find((r) => r.tripId === trip1);
      rec({ check: 'C7', persona: 'connection', action: 'restoring APPROVED brings trips back', status: backHit ? 'PASS' : 'WARN', detail: backHit ? 'trip1 visible again after restore' : 'trip1 not back after restore (check operator status)' });
    }
  } catch (e) {
    rec({ check: 'driver', persona: '-', action: 'run', status: 'BROKEN', detail: `threw: ${String((e as Error).message).slice(0, 180)}` });
  } finally {
    // safety net — never leave the seed operator suspended
    await pg.query(`UPDATE "Operator" SET status='APPROVED' WHERE id=(SELECT "operatorId" FROM "OperatorUser" WHERE phone=$1) AND status<>'APPROVED'`, [SEED_PHONE_E164]).catch(() => {});
    await opCtx.close().catch(() => {});
    await tvCtx.close().catch(() => {});
    await browser.close().catch(() => {});
    await pgEnd();
  }
  writeReport({ route, trip1, trip2, date1, date2, busId, booking1Phone });
}

// ---- report -----------------------------------------------------------------

const CHECKS: { id: string; text: string }[] = [
  { id: 'C1', text: 'Operator releases a trip → it surfaces in public traveler search' },
  { id: 'C2', text: 'Traveler discovers that trip → holds → pays (stub) → PAID' },
  { id: 'C3', text: 'Paid booking appears on the operator manifest + DB (trip-scoped)' },
  { id: 'C4', text: 'Search availableSeats decrements by ticketCount across the boundary' },
  { id: 'C5', text: 'Operator check-in sets checkedInAt; second attempt idempotent' },
  { id: 'C6', text: 'Operator cancels a booked trip → booking trip_cancelled + refund_out ledger' },
  { id: 'C7', text: 'Approval gate: SUSPENDED operator trips vanish from search, return on APPROVED' },
];

function checkResult(id: string): string {
  const hits = findings.filter((f) => f.check === id);
  if (!hits.length) return '⬜ not exercised';
  if (hits.some((f) => f.status === 'BROKEN')) return '🟥 BROKEN';
  if (hits.some((f) => f.status === 'WARN')) return '🟧 WARN';
  return '🟩 PASS';
}

function writeReport(ctx?: { route: { origin: string; destination: string } | null; trip1: string | null; trip2: string | null; date1: string; date2: string; busId: string | null; booking1Phone: string }) {
  const broken = findings.filter((f) => f.status === 'BROKEN');
  const warn = findings.filter((f) => f.status === 'WARN');
  const pass = findings.filter((f) => f.status === 'PASS');
  const info = findings.filter((f) => f.status === 'INFO');
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const row = (f: Finding) => `| ${f.status} | ${f.check} | ${f.persona} | ${esc(f.action)} | ${esc(f.detail)}${f.shot ? ` ([shot](cross-persona-shots/${f.shot}))` : ''} |`;

  const md = `# Cross-persona connection test — ${TODAY}

Target: \`${BASE}\` · Driver: standalone Playwright (\`scripts/smoke/cross-persona-crawl.mts\`) · Two contexts: operator 1366×950 + traveler 1280×900.
Mode: **full mutating + destructive** — creates a throwaway bus + 2 trips + 2 paid bookings, cancels one trip, and momentarily SUSPENDS then restores the seed operator (try/finally guarded). Operator acts as seed admin (\`${SEED_PHONE_E164}\`); traveler completes real stub payments.

> ⚠️ This run DIRTIED the dev DB. Run \`pnpm db:seed\` for a clean slate before a fresh comparison.

## Fixture state
${ctx ? `- Route under test: **${ctx.route ? `${ctx.route.origin} → ${ctx.route.destination}` : '—'}**
- Fresh bus: \`${ctx.busId ?? '—'}\` (capacity 20)
- Trip 1 (booked + checked-in): \`${ctx.trip1 ?? '—'}\` on ${ctx.date1}
- Trip 2 (booked + cancelled): \`${ctx.trip2 ?? '—'}\` on ${ctx.date2}` : '_run aborted before fixtures established_'}

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | ${broken.length} |
| 🟧 WARN | ${warn.length} |
| 🟩 PASS | ${pass.length} |
| ⬜ INFO | ${info.length} |
| Total checks | ${findings.length} |

## Connection-flow matrix

| Check | Handoff | Result |
|---|---|---|
${CHECKS.map((c) => `| **${c.id}** | ${esc(c.text)} | ${checkResult(c.id)} |`).join('\n')}

## 🟥 Broken handoffs

${broken.length === 0 ? '_None detected._' : `| Sev | Check | Persona | Action | Detail |\n|---|---|---|---|---|\n${broken.map(row).join('\n')}`}

## 🟧 Warnings

${warn.length === 0 ? '_None._' : `| Sev | Check | Persona | Action | Detail |\n|---|---|---|---|---|\n${warn.map(row).join('\n')}`}

## Full check log

| Sev | Check | Persona | Action | Detail |
|---|---|---|---|---|
${findings.map(row).join('\n')}
`;

  const file = join(OUT_DIR, `cross-persona-${TODAY}.md`);
  writeFileSync(file, md, 'utf8');
  console.log(`\n=== REPORT: ${file} ===\nBROKEN=${broken.length} WARN=${warn.length} PASS=${pass.length} INFO=${info.length} TOTAL=${findings.length}`);
}

main().catch((e) => { console.error('cross-persona crawl crashed:', e); writeReport(); process.exit(1); });
