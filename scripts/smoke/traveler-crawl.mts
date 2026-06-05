/**
 * traveler-crawl.mts — standalone Playwright smoke crawl of the TRAVELER side.
 *
 * Acts as a customer: loads every customer-facing route, follows every in-app
 * link (BFS route graph), inventories every button, and drives the real flows —
 * guest booking (stub success + fail), register / forgot-password / reset-password
 * (OTP pulled DIRECTLY from the backend test-peek sink), account area, charter.
 * Emits a fresh broken-transition / broken-function report (old content deleted).
 *
 * Run (dev server must already be up on :3001 — :3000 is a DIFFERENT app):
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm tsx scripts/smoke/traveler-crawl.mts
 *
 * Requires .env.local with OTP_PEEK_ENABLED=true + PAYMENTS_STUB=true (dev).
 * Observe-and-report only — no app source changes; mutations hit the dev DB.
 * Does NOT manage the dev server (no kill/restart/spawn) — reuses the live one.
 */

import { chromium, devices, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const ORIGIN = new URL(BASE).origin;
const OUT_DIR = join(process.cwd(), 'docs', 'qa');
const SHOT_DIR = join(OUT_DIR, 'traveler-smoke-shots');
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

// ---- delete old content, recreate shot dir ---------------------------------
rmSync(SHOT_DIR, { recursive: true, force: true });
mkdirSync(SHOT_DIR, { recursive: true });

// ---- finding recorder -------------------------------------------------------

type Sev = 'PASS' | 'WARN' | 'BROKEN' | 'INFO';
interface Finding {
  phase: string;
  viewport: string;
  route: string;
  action: string;
  status: Sev;
  detail: string;
  shot?: string;
}
const findings: Finding[] = [];
let shotN = 0;
const seenConsole = new Set<string>(); // dedupe console/pageerror spam

function rec(f: Omit<Finding, 'viewport'> & { viewport?: string }) {
  findings.push({ viewport: CURRENT_VP, ...f });
  // eslint-disable-next-line no-console
  console.log(`[${f.status}] ${f.viewport ?? CURRENT_VP} ${f.phase} | ${f.route} | ${f.action} :: ${f.detail}`.slice(0, 200));
}

async function shoot(page: Page, name: string): Promise<string> {
  const file = `${String(++shotN).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`.slice(0, 80);
  try {
    await page.screenshot({ path: join(SHOT_DIR, file), fullPage: false });
  } catch {
    /* best-effort */
  }
  return file;
}

let CURRENT_VP = 'desktop';
let CURRENT_CTX = 'startup';

// Routes we deliberately probe with bad input — their 4xx is the asserted behaviour,
// not a regression. Mirrors the /api/auth/otp/test-peek allowlist on the response listener.
const EXPECTED_NEG_PATH = /\/charter\/status\/INVALID-REF-TEST|\/verify\/invalid-token-test/;
let EXPECT_LOGIN_401 = false; // toggled around the deliberate wrong-password submit

function safePath(u: string): string {
  try {
    const x = new URL(u);
    return x.pathname + (x.search ? x.search.slice(0, 60) : '');
  } catch {
    return u;
  }
}

// ---- per-page instrumentation ----------------------------------------------

function instrument(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|Download the React DevTools|\[Fast Refresh\]|hydrat/i.test(text)) return;
    const cp = safePath(page.url());
    if (EXPECTED_NEG_PATH.test(cp)) return;                   // expected 404-page resource noise
    if (EXPECT_LOGIN_401 && /\/auth\/login/.test(cp)) return; // expected 401 fetch noise
    const key = `${CURRENT_VP}|${safePath(page.url())}|${text.slice(0, 80)}`;
    if (seenConsole.has(key)) return;
    seenConsole.add(key);
    rec({ phase: 'console', route: safePath(page.url()), action: CURRENT_CTX, status: 'WARN', detail: `console.error: ${text.slice(0, 200)}` });
  });
  page.on('pageerror', (err) => {
    const text = String(err.message);
    const key = `${CURRENT_VP}|${safePath(page.url())}|${text.slice(0, 80)}`;
    if (seenConsole.has(key)) return;
    seenConsole.add(key);
    rec({ phase: 'console', route: safePath(page.url()), action: CURRENT_CTX, status: 'BROKEN', detail: `pageerror: ${text.slice(0, 200)}` });
  });
  page.on('response', (res) => {
    const u = res.url();
    if (!u.startsWith(ORIGIN)) return;
    const st = res.status();
    if (st < 400) return;
    const p = safePath(u);
    if (p.startsWith('/api/auth/otp/test-peek')) return; // 404 until a code exists — expected
    if (st === 404 && EXPECTED_NEG_PATH.test(p)) return;                   // deliberate invalid-ref/token probe
    if (st === 401 && p === '/api/auth/login' && EXPECT_LOGIN_401) return; // deliberate wrong-password probe
    const key = `http|${CURRENT_VP}|${p}|${st}|${CURRENT_CTX}`;
    if (seenConsole.has(key)) return;
    seenConsole.add(key);
    rec({ phase: 'http', route: p, action: `${res.request().method()} (ctx:${CURRENT_CTX})`, status: st >= 500 ? 'BROKEN' : 'WARN', detail: `HTTP ${st}` });
  });
}

// ---- navigation helpers -----------------------------------------------------

async function visit(page: Page, path: string, phase: string): Promise<number | null> {
  CURRENT_CTX = `visit ${path}`;
  const url = path.startsWith('http') ? path : ORIGIN + path;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const st = resp?.status() ?? null;
    const landed = safePath(page.url());
    const redirected = landed.split('?')[0] !== path.split('?')[0];
    if (st && st >= 500) {
      rec({ phase, route: path, action: 'load', status: 'BROKEN', detail: `HTTP ${st}`, shot: await shoot(page, 'err' + path) });
    } else if (st === 404) {
      rec({ phase, route: path, action: 'load', status: 'INFO', detail: 'HTTP 404 (notFound — expected for invalid id/token)' });
    } else {
      rec({ phase, route: path, action: 'load', status: 'PASS', detail: `HTTP ${st ?? '?'}${redirected ? ` → redirected to ${landed}` : ''}` });
    }
    return st;
  } catch (e) {
    rec({ phase, route: path, action: 'load', status: 'BROKEN', detail: `nav error: ${String((e as Error).message).slice(0, 140)}`, shot: await shoot(page, 'navfail' + path) });
    return null;
  }
}

async function internalLinks(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') || '')).catch(() => []);
  const out = new Set<string>();
  for (const h of hrefs) {
    if (!h || h.startsWith('#') || h.startsWith('tel:') || h.startsWith('mailto:')) continue;
    if (h.startsWith('http') && !h.startsWith(ORIGIN)) continue;
    const path = h.startsWith('http') ? new URL(h).pathname + new URL(h).search : h;
    if (path.startsWith('/')) out.add(path);
  }
  return [...out];
}

async function buttonLabels(page: Page): Promise<string[]> {
  return page
    .$$eval('button, [role="button"]', (els) => els.map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter((t) => t.length > 0 && t.length < 60))
    .catch(() => []);
}

function vnTomorrow(): string {
  const [y, m, d] = TODAY.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  t.setUTCDate(t.getUTCDate() + 1);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
const TOMORROW = vnTomorrow();
const SEARCH_QS = new URLSearchParams({ origin: 'Hà Nội', destination: 'TP.HCM', date: TOMORROW, ticketCount: '1' }).toString();

/** OTP straight from the backend test-peek sink. */
async function peekOtp(page: Page, phone: string): Promise<string | null> {
  for (let i = 0; i < 6; i++) {
    const r = await page.request.get(`${ORIGIN}/api/auth/otp/test-peek?phone=${encodeURIComponent(phone)}`).catch(() => null);
    if (r && r.ok()) {
      const j = (await r.json().catch(() => ({}))) as { code?: string };
      if (j.code) return j.code;
    }
    await page.waitForTimeout(400);
  }
  return null;
}

/** First visible error/alert text on the page (for diagnosing failed flows). */
async function alertText(page: Page): Promise<string> {
  const a = page.locator('p[role="alert"], .text-destructive');
  if (await a.count()) return ((await a.first().textContent()) ?? '').trim().replace(/\s+/g, ' ').slice(0, 120) || '(empty)';
  return '(no alert)';
}

let phoneSeq = 0;
function freshPhone(): string {
  // E.164, gitleaks-safe (built at runtime), matches /^\+84[35789]\d{8}$/.
  phoneSeq += 1;
  const suffix = String(Date.now()).slice(-6) + String(phoneSeq);
  return `+8493${suffix.slice(-7)}`;
}

const STATIC_ROUTES = [
  '/',
  `/search?${SEARCH_QS}`,
  '/search',
  '/routes',
  '/lien-he-dat-xe',
  '/lien-he-dat-xe/confirmation',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/account/bookings',
  '/account/settings',
  '/booking/customer',
  '/booking/review',
  '/privacy',
  '/terms',
  '/charter/status/INVALID-REF-TEST',
  '/verify/invalid-token-test',
];

const linkGraph: Record<string, string[]> = {};
const buttonInv: Record<string, string[]> = {};

// ---- Phase A: static + BFS link graph --------------------------------------

async function phaseStaticCrawl(page: Page) {
  const seen = new Set<string>();
  const queue = [...STATIC_ROUTES];
  while (queue.length) {
    const path = queue.shift()!;
    const key = path.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const st = await visit(page, path, 'A-static');
    if (st === null) continue;
    const links = await internalLinks(page);
    linkGraph[path] = links;
    buttonInv[path] = await buttonLabels(page);
    for (const l of links) {
      const lk = l.split('?')[0];
      if (seen.has(lk)) continue;
      if (/^\/(booking|account|dev)/.test(lk)) continue; // covered by flow phases
      if (lk.startsWith('/op') || lk.startsWith('/admin')) continue; // not traveler side
      queue.push(l);
    }
  }
}

// ---- Phase B: guest booking funnel -----------------------------------------

async function gotoReview(page: Page, phase: string, buyerPhone = '0901234567'): Promise<boolean> {
  CURRENT_CTX = 'booking: search';
  await visit(page, `/search?${SEARCH_QS}`, phase);
  const bookBtn = page.getByRole('button', { name: /đặt vé|book/i });
  if ((await bookBtn.count()) === 0) {
    rec({ phase, route: '/search', action: 'find BookButton', status: 'BROKEN', detail: 'no book button on results', shot: await shoot(page, 'no-trips') });
    return false;
  }
  rec({ phase, route: '/search', action: 'results', status: 'PASS', detail: `${await bookBtn.count()} book button(s)` });
  CURRENT_CTX = 'booking: click book';
  await bookBtn.first().click();
  try {
    await page.waitForURL('**/booking/customer', { timeout: 15000 });
    rec({ phase, route: '/search→/booking/customer', action: 'BookButton', status: 'PASS', detail: 'reached customer form' });
  } catch {
    rec({ phase, route: '/search→/booking/customer', action: 'BookButton', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'book-stuck') });
    return false;
  }
  CURRENT_CTX = 'booking: customer form';
  await page.getByLabel(/họ và tên|name/i).first().fill('Nguyen Van Test');
  await page.getByLabel(/số điện thoại|phone/i).first().fill(buyerPhone);
  const email = page.getByLabel(/email/i);
  if (await email.count()) await email.first().fill('test@example.com').catch(() => {});
  await page.getByRole('button', { name: /tiếp tục|continue|xác nhận/i }).first().click();
  try {
    await page.waitForURL('**/booking/review**', { timeout: 15000 });
    rec({ phase, route: '/booking/customer→/booking/review', action: 'submit customer form (POST /api/holds)', status: 'PASS', detail: 'hold created, reached review' });
  } catch {
    rec({ phase, route: '/booking/customer→/booking/review', action: 'submit customer form', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'review-stuck') });
    return false;
  }
  const timer = page.getByTestId('hold-timer-countdown');
  if (await timer.count()) {
    const t = (await timer.first().textContent())?.trim() ?? '';
    rec({ phase, route: '/booking/review', action: 'hold timer', status: /^\d{2}:\d{2}$/.test(t) ? 'PASS' : 'WARN', detail: `countdown="${t}"` });
  } else {
    rec({ phase, route: '/booking/review', action: 'hold timer', status: 'WARN', detail: 'no hold-timer-countdown testid' });
  }
  return true;
}

async function bookingPayOutcome(page: Page, phase: string, outcome: 'success' | 'fail') {
  CURRENT_CTX = `booking: pay ${outcome}`;
  const rail = page.locator('input[name="paymentMethod"][value="zalopay"]');
  if (await rail.count()) await rail.first().check({ force: true }).catch(() => {});
  const payBtn = page.getByRole('button', { name: /xác nhận thanh toán/i });
  const disabledBefore = await payBtn.first().isDisabled().catch(() => false);
  rec({ phase, route: '/booking/review', action: 'pay disabled before consent', status: disabledBefore ? 'PASS' : 'WARN', detail: `disabled=${disabledBefore}` });
  await page.locator('input[name="consent-no-refund"]').first().check({ force: true }).catch(() => {});
  await page.locator('input[name="consent-pii-storage"]').first().check({ force: true }).catch(() => {});
  await payBtn.first().click();
  try {
    await page.waitForURL('**/dev/stub-pay**', { timeout: 15000 });
    rec({ phase, route: '/booking/review→/dev/stub-pay', action: 'initiate (POST /api/bookings/initiate)', status: 'PASS', detail: 'reached stub gateway' });
  } catch {
    rec({ phase, route: '/booking/review→/dev/stub-pay', action: 'initiate', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'initiate-stuck') });
    return;
  }
  CURRENT_CTX = `stub-pay ${outcome}`;
  await page.getByRole('button', { name: outcome === 'success' ? /thanh toán/i : /thất bại/i }).first().click();
  try {
    await page.waitForURL('**/booking/result/**', { timeout: 20000 });
  } catch {
    rec({ phase, route: '/dev/stub-pay→/booking/result', action: `pay ${outcome}`, status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'result-stuck') });
    return;
  }
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  const body = (await page.textContent('body')) ?? '';
  if (outcome === 'success') {
    const ok = /thành công/i.test(body);
    rec({ phase, route: '/booking/result', action: 'pay success → result', status: ok ? 'PASS' : 'WARN', detail: ok ? 'shows "thành công"' : `no success text at ${safePath(page.url())}`, shot: await shoot(page, 'result-success') });
    const confLink = page.locator('a[href*="/booking/confirmation/"]');
    if (await confLink.count()) {
      await confLink.first().click();
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      rec({ phase, route: '/booking/result→/booking/confirmation', action: 'view confirmation', status: /\/booking\/confirmation\//.test(page.url()) ? 'PASS' : 'WARN', detail: `at ${safePath(page.url())}`, shot: await shoot(page, 'confirmation') });
    } else {
      rec({ phase, route: '/booking/result', action: 'confirmation link', status: 'WARN', detail: 'no confirmation link on paid result page' });
    }
  } else {
    const failed = /thất bại|hết hạn|failed/i.test(body);
    rec({ phase, route: '/booking/result', action: 'pay fail → result', status: failed ? 'PASS' : 'WARN', detail: failed ? 'shows failure messaging' : `no failure text at ${safePath(page.url())}`, shot: await shoot(page, 'result-fail') });
  }
}

// Pay leg is OPT-IN: set SMOKE_RUN_PAY=1 to drive stub-pay/result/confirmation.
// Default skips it (booking can't be paid in this env) — the funnel is still
// proven out to /booking/review + the consent-gated pay button.
const RUN_PAY = process.env.SMOKE_RUN_PAY === '1';

async function phaseBooking(page: Page, withFail: boolean) {
  if (!(await gotoReview(page, 'B-booking'))) return;

  if (!RUN_PAY) {
    // Assert the pay button exists and is disabled before consent — read-only,
    // no gateway navigation (pay step intentionally skipped).
    const payBtn = page.getByRole('button', { name: /xác nhận thanh toán/i });
    const present = (await payBtn.count()) > 0;
    const disabled = present ? await payBtn.first().isDisabled().catch(() => false) : false;
    rec({
      phase: 'B-booking',
      route: '/booking/review',
      action: 'pay button (pay step skipped — SMOKE_RUN_PAY unset)',
      status: present && disabled ? 'PASS' : 'WARN',
      detail: `present=${present} disabledBeforeConsent=${disabled}`,
    });
    return;
  }

  await bookingPayOutcome(page, 'B-booking', 'success');
  if (withFail && (await gotoReview(page, 'B-booking-fail'))) await bookingPayOutcome(page, 'B-booking-fail', 'fail');
}

// ---- Phase C: register (OTP from backend) ----------------------------------

async function registerViaUi(page: Page, phase: string, phone: string = freshPhone()): Promise<string | null> {
  CURRENT_CTX = `register ${phone}`;
  await visit(page, '/auth/register', phase);
  await page.locator('#phone').waitFor({ state: 'visible', timeout: 12000 });
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: /gửi mã otp/i }).click();
  try {
    await page.locator('#code').waitFor({ state: 'visible', timeout: 12000 });
    rec({ phase, route: '/auth/register', action: 'step1 send OTP', status: 'PASS', detail: 'advanced to OTP step' });
  } catch {
    rec({ phase, route: '/auth/register', action: 'step1 send OTP', status: 'BROKEN', detail: 'did not advance to OTP', shot: await shoot(page, 'reg-otp-stuck') });
    return null;
  }
  const code = await peekOtp(page, phone);
  if (!code) {
    rec({ phase, route: '/auth/register', action: 'OTP peek (backend)', status: 'BROKEN', detail: 'test-peek returned no code' });
    return null;
  }
  rec({ phase, route: '/auth/register', action: 'OTP peek (backend)', status: 'PASS', detail: `got code from backend sink` });
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: /^xác minh$/i }).click();
  try {
    await page.locator('#password').waitFor({ state: 'visible', timeout: 12000 });
    rec({ phase, route: '/auth/register', action: 'step2 verify OTP', status: 'PASS', detail: 'advanced to details' });
  } catch {
    rec({ phase, route: '/auth/register', action: 'step2 verify OTP', status: 'BROKEN', detail: 'did not advance', shot: await shoot(page, 'reg-details-stuck') });
    return null;
  }
  await page.locator('#password').fill('Password1Test');
  await page.locator('#displayName').fill('Smoke Tester');
  await page.getByRole('button', { name: /^đăng ký$/i }).click();
  try {
    await page.waitForURL((u) => !u.pathname.startsWith('/auth/register'), { timeout: 15000 });
    rec({ phase, route: '/auth/register', action: 'step3 register', status: 'PASS', detail: `registered, landed ${safePath(page.url())}` });
    return phone;
  } catch {
    rec({ phase, route: '/auth/register', action: 'step3 register', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'reg-final-stuck') });
    return null;
  }
}

// ---- Phase C2: forgot-password (OTP from backend) --------------------------

async function phaseForgotPassword(page: Page) {
  // needs an existing registered phone → register a throwaway first
  const phone = await registerViaUi(page, 'C-forgot(setup)');
  if (!phone) {
    rec({ phase: 'C-forgot', route: '/auth/forgot-password', action: 'setup register', status: 'BROKEN', detail: 'could not create test account' });
    return;
  }
  CURRENT_CTX = `forgot ${phone}`;
  await visit(page, '/auth/forgot-password', 'C-forgot');
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: /gửi mã otp/i }).click();
  try {
    await page.locator('#code').waitFor({ state: 'visible', timeout: 12000 });
    rec({ phase: 'C-forgot', route: '/auth/forgot-password', action: 'step1 request OTP', status: 'PASS', detail: 'advanced to reset step' });
  } catch {
    rec({ phase: 'C-forgot', route: '/auth/forgot-password', action: 'step1 request OTP', status: 'BROKEN', detail: 'did not advance', shot: await shoot(page, 'forgot-stuck') });
    return;
  }
  const code = await peekOtp(page, phone);
  if (!code) {
    rec({ phase: 'C-forgot', route: '/auth/forgot-password', action: 'OTP peek (backend)', status: 'BROKEN', detail: 'no code from sink' });
    return;
  }
  await page.locator('#code').fill(code);
  await page.locator('#newPassword').fill('Password2New');
  await page.locator('#confirmPassword').fill('Password2New');
  await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  // verify→reset is a two-fetch chain; the done screen renders after both settle.
  await page.getByText(/đã được cập nhật/i).first().waitFor({ state: 'visible', timeout: 9000 }).catch(() => {});
  const done = await page.getByText(/đã được cập nhật/i).count();
  const fErr = done ? '' : await alertText(page);
  const fStatus: Sev = done ? 'PASS' : fErr && fErr !== '(no alert)' ? 'BROKEN' : 'WARN';
  rec({ phase: 'C-forgot', route: '/auth/forgot-password', action: 'verify OTP + reset password', status: fStatus, detail: done ? 'password reset OK (done screen)' : `no done screen — alert: ${fErr} @ ${safePath(page.url())}`, shot: await shoot(page, 'forgot-done') });
}

// ---- Phase C3: reset-password direct (OTP from backend) --------------------

async function phaseResetPassword(page: Page) {
  const phone = await registerViaUi(page, 'C-reset(setup)');
  if (!phone) {
    rec({ phase: 'C-reset', route: '/auth/reset-password', action: 'setup register', status: 'BROKEN', detail: 'could not create test account' });
    return;
  }
  // trigger an OTP send for this phone via the backend (forgot-password POST)
  CURRENT_CTX = `reset send ${phone}`;
  const send = await page.request.post(`${ORIGIN}/api/auth/forgot-password`, { data: { phone }, headers: { 'content-type': 'application/json' } }).catch(() => null);
  rec({ phase: 'C-reset', route: '/api/auth/forgot-password', action: 'trigger OTP send', status: send && send.ok() ? 'PASS' : 'WARN', detail: `status ${send?.status() ?? 'err'}` });
  const code = await peekOtp(page, phone);
  if (!code) {
    rec({ phase: 'C-reset', route: '/auth/reset-password', action: 'OTP peek (backend)', status: 'BROKEN', detail: 'no code from sink' });
    return;
  }
  await visit(page, `/auth/reset-password?phone=${encodeURIComponent(phone)}`, 'C-reset');
  CURRENT_CTX = `reset form ${phone}`;
  await page.locator('#phone').fill(phone);
  await page.locator('#code').fill(code);
  await page.locator('#newPassword').fill('Password3Rst');
  await page.locator('#confirmPassword').fill('Password3Rst');
  await page.getByRole('button', { name: /đặt lại mật khẩu/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.getByText(/đã được cập nhật|thành công/i).first().waitFor({ state: 'visible', timeout: 9000 }).catch(() => {});
  const done = await page.getByText(/đã được cập nhật|thành công/i).count();
  const rErr = done ? '' : await alertText(page);
  const rStatus: Sev = done ? 'PASS' : rErr && rErr !== '(no alert)' ? 'BROKEN' : 'WARN';
  rec({ phase: 'C-reset', route: '/auth/reset-password', action: 'verify OTP + reset password', status: rStatus, detail: done ? 'password reset OK (done screen)' : `no done screen — alert: ${rErr} @ ${safePath(page.url())}`, shot: await shoot(page, 'reset-done') });
}

// ---- Phase D: account area (SPA-continuous right after register) ------------

async function phaseAccount(page: Page) {
  // register lands on '/' (SPA, in-memory token alive). Reach account via header link.
  const registered = await registerViaUi(page, 'D-account');
  if (!registered) return;

  CURRENT_CTX = 'account: header link';
  const acctLink = page.getByRole('link', { name: /tài khoản/i });
  if (await acctLink.count()) {
    await acctLink.first().click();
    try {
      await page.waitForURL('**/account/**', { timeout: 12000 });
      const authed = !/\/auth\/login/.test(page.url());
      rec({ phase: 'D-account', route: '/account/bookings', action: 'header "Tài khoản" link (SPA)', status: authed ? 'PASS' : 'BROKEN', detail: authed ? 'reached bookings authed' : 'bounced to login (token lost)', shot: await shoot(page, 'acct-bookings') });
    } catch {
      rec({ phase: 'D-account', route: '/account/bookings', action: 'header link', status: 'BROKEN', detail: `at ${safePath(page.url())}` });
    }
  } else {
    rec({ phase: 'D-account', route: 'header', action: 'find Tài khoản link', status: 'BROKEN', detail: 'no account nav link' });
  }

  // tabs
  for (const tab of [/sắp tới|upcoming/i, /đã đi|lịch sử|past|hoàn tất/i]) {
    const t = page.getByRole('button', { name: tab }).or(page.getByRole('tab', { name: tab }));
    if (await t.count()) {
      await t.first().click().catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      rec({ phase: 'D-account', route: '/account/bookings', action: `tab ${tab.source.slice(0, 20)}`, status: 'PASS', detail: 'clicked' });
    }
  }

  // booking detail (if any booking row links)
  const detailLink = page.locator('a[href*="/account/bookings/"]');
  if (await detailLink.count()) {
    await detailLink.first().click();
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    rec({ phase: 'D-account', route: '/account/bookings/[id]', action: 'open booking detail', status: /\/account\/bookings\/[^/]+$/.test(page.url()) ? 'PASS' : 'WARN', detail: `at ${safePath(page.url())}`, shot: await shoot(page, 'acct-detail') });
  } else {
    rec({ phase: 'D-account', route: '/account/bookings', action: 'booking detail link', status: 'INFO', detail: 'no booking rows for this fresh account (expected — guest booking used a different phone)' });
  }

  // settings reachability — check the in-app link WHILE authed (SPA, on the live
  // bookings page). A hard reload would drop the in-memory token and bounce to
  // login, so the link MUST be read here, not after a fresh navigation.
  const settingsLink = page.locator('a[href="/account/settings"]');
  rec({ phase: 'D-account', route: '/account/bookings', action: 'link to /account/settings', status: (await settingsLink.count()) ? 'PASS' : 'BROKEN', detail: (await settingsLink.count()) ? 'settings link present' : 'NO in-app link to /account/settings (orphan route)' });

  // Auth-guard: a hard load of /account/settings has no in-memory token → must
  // redirect to login (parity with /account/bookings). The authed settings
  // mutations themselves are exercised in phaseSettingsMutations (SPA continuity).
  CURRENT_CTX = 'account: settings (hard load)';
  await visit(page, '/account/settings', 'D-account');
  rec({ phase: 'D-account', route: '/account/settings', action: 'auth-guard on hard load', status: /\/auth\/login/.test(page.url()) ? 'PASS' : 'WARN', detail: /\/auth\/login/.test(page.url()) ? 'redirected to login (guard works)' : `no redirect — at ${safePath(page.url())}` });
}

// ---- Phase E: charter -------------------------------------------------------

async function phaseCharter(page: Page) {
  CURRENT_CTX = 'charter';
  await visit(page, '/lien-he-dat-xe', 'E-charter');
  rec({ phase: 'E-charter', route: '/lien-he-dat-xe', action: 'form buttons', status: 'INFO', detail: (await buttonLabels(page)).join(' | ').slice(0, 180) });
  const fillByLabel = async (re: RegExp, val: string) => {
    const f = page.getByLabel(re);
    if (await f.count()) { await f.first().fill(val).catch(() => {}); return true; }
    return false;
  };
  await fillByLabel(/họ và tên|tên|name/i, 'Charter Tester');
  await fillByLabel(/số điện thoại|điện thoại|phone/i, '0901234567');
  await fillByLabel(/email/i, 'charter@example.com');
  // Required by the form + API: origin, destination, passengers, startDate.
  await fillByLabel(/điểm đón|origin/i, 'Hà Nội');
  await fillByLabel(/điểm đến|destination/i, 'Sầm Sơn');
  await fillByLabel(/số người|số khách|hành khách|passenger/i, '16');
  await fillByLabel(/ghi chú|note/i, 'Smoke test charter');
  // DatePicker is a base-ui Popover button (not a native input): open it and click
  // today (selectable since min=todayVN), which writes the hidden departureDate.
  const dateOk = await (async () => {
    const trigger = page.locator('#departureDate');
    if (!(await trigger.count())) return false;
    await trigger.first().click().catch(() => {});
    const todayCell = page.locator('[role="grid"] button[aria-current="date"]');
    await todayCell.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await todayCell.count()) {
      await todayCell.first().click().catch(() => {});
      return true;
    }
    // Fallback: first enabled day in the grid.
    const enabled = page.locator('[role="grid"] button:not([aria-disabled="true"])');
    if (await enabled.count()) {
      await enabled.first().click().catch(() => {});
      return true;
    }
    return false;
  })();
  rec({ phase: 'E-charter', route: '/lien-he-dat-xe', action: 'pick departure date', status: dateOk ? 'PASS' : 'WARN', detail: dateOk ? 'date selected via DatePicker popover' : 'could not select a date' });
  // Ensure the DatePicker popover is closed so it can't overlay the submit button.
  await page.keyboard.press('Escape').catch(() => {});
  const submit = page.getByRole('button', { name: /gửi yêu cầu|đặt xe|submit/i });
  if (await submit.count()) {
    await submit.first().click().catch(() => {});
    // On 201 the form does a client-side router.push to the confirmation page —
    // a SOFT navigation that networkidle alone doesn't await. Wait for the URL.
    await page.waitForURL('**/lien-he-dat-xe/confirmation**', { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const moved = /confirmation|charter\/status/.test(page.url());
    // Ref comes back in the confirmation URL (?ref=CH-…); fall back to body text.
    const urlRef = (() => { try { return new URL(page.url()).searchParams.get('ref'); } catch { return null; } })();
    const bodyRef = (await page.textContent('body'))?.match(/CH-\d{4}-[A-Z0-9]+/i)?.[0] ?? null;
    const ref = urlRef ?? bodyRef;
    rec({ phase: 'E-charter', route: '/lien-he-dat-xe', action: 'submit charter form', status: moved || ref ? 'PASS' : 'WARN', detail: ref ? `ref ${ref} → ${safePath(page.url())}` : moved ? `navigated to ${safePath(page.url())}` : 'no confirmation/ref (may need more required fields)', shot: await shoot(page, 'charter-submit') });
    if (ref) {
      await visit(page, `/charter/status/${ref}`, 'E-charter');
      const cancel = page.getByRole('button', { name: /hủy|cancel/i });
      if (await cancel.count()) {
        await cancel.first().click().catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        rec({ phase: 'E-charter', route: `/charter/status/${ref}`, action: 'cancel charter', status: 'PASS', detail: 'cancel clicked', shot: await shoot(page, 'charter-cancel') });
      } else {
        rec({ phase: 'E-charter', route: '/charter/status', action: 'cancel button', status: 'INFO', detail: 'no cancel button (status not cancellable)' });
      }
    }
  } else {
    rec({ phase: 'E-charter', route: '/lien-he-dat-xe', action: 'find submit', status: 'WARN', detail: 'no submit button matched' });
  }
}

// ---- Phase F: search interactions (sort / filter / date-nav) ----------------

async function phaseSearchInteractions(page: Page) {
  CURRENT_CTX = 'search interactions';
  await visit(page, `/search?${SEARCH_QS}`, 'F-search');

  // Sort: open the base-ui Select and pick "Giá thấp → cao" (price_asc).
  const sortTrigger = page.locator('#sort-select');
  if (await sortTrigger.count()) {
    await sortTrigger.first().click().catch(() => {});
    const opt = page.getByRole('option', { name: /giá thấp/i });
    await opt.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    if (await opt.count()) {
      await opt.first().click().catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500); // let the client router.replace commit the URL
      const ok = /sort=price_asc/.test(page.url());
      rec({ phase: 'F-search', route: '/search', action: 'sort → Giá thấp→cao', status: ok ? 'PASS' : 'WARN', detail: ok ? 'URL has sort=price_asc' : `no sort param: ${safePath(page.url())}` });
    } else {
      rec({ phase: 'F-search', route: '/search', action: 'sort dropdown', status: 'WARN', detail: 'no "Giá thấp" option after open' });
    }
  } else {
    rec({ phase: 'F-search', route: '/search', action: 'sort dropdown', status: 'WARN', detail: 'no #sort-select trigger' });
  }

  // Filter: toggle a bus-type chip (desktop rail / mobile sheet button).
  const chip = page.getByRole('button', { name: /giường nằm/i });
  if (await chip.count()) {
    await chip.first().click().catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500); // let the client router.replace commit the URL
    const ok = /busType=/.test(page.url());
    rec({ phase: 'F-search', route: '/search', action: 'filter chip "Giường nằm"', status: ok ? 'PASS' : 'WARN', detail: ok ? `URL has busType: ${safePath(page.url())}` : `no busType param: ${safePath(page.url())}` });
  } else {
    rec({ phase: 'F-search', route: '/search', action: 'filter chip', status: 'INFO', detail: 'no bus-type chip visible (single-facet or mobile sheet collapsed)' });
  }

  // Date nav: click "Sau →" (next day) — assert the date query param advances.
  const dateBefore = (() => { try { return new URL(page.url()).searchParams.get('date'); } catch { return null; } })();
  const next = page.getByRole('link', { name: /ngày sau|tìm ngày sau|sau →/i });
  if (await next.count()) {
    await next.first().click().catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const dateAfter = (() => { try { return new URL(page.url()).searchParams.get('date'); } catch { return null; } })();
    const ok = !!dateAfter && dateAfter !== dateBefore;
    rec({ phase: 'F-search', route: '/search', action: 'date-nav next day', status: ok ? 'PASS' : 'WARN', detail: ok ? `${dateBefore} → ${dateAfter}` : `date unchanged (${dateAfter})` });
  } else {
    rec({ phase: 'F-search', route: '/search', action: 'date-nav next day', status: 'WARN', detail: 'no next-day nav link' });
  }
}

// ---- Phase G: trip-detail funnel (stepper + book) ---------------------------

async function phaseTripDetail(page: Page) {
  CURRENT_CTX = 'trip detail';
  await visit(page, `/search?${SEARCH_QS}`, 'G-trip');
  const detail = page.locator('a[href^="/trips/"]');
  if ((await detail.count()) === 0) {
    rec({ phase: 'G-trip', route: '/search', action: 'find "Xem chi tiết" link', status: 'BROKEN', detail: 'no trip-detail link on results' });
    return;
  }
  await detail.first().click();
  try {
    await page.waitForURL('**/trips/**', { timeout: 12000 });
    rec({ phase: 'G-trip', route: '/search→/trips/[id]', action: 'Xem chi tiết', status: 'PASS', detail: `at ${safePath(page.url())}` });
  } catch {
    rec({ phase: 'G-trip', route: '/search→/trips/[id]', action: 'Xem chi tiết', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'trip-detail-stuck') });
    return;
  }
  // ticket-count stepper
  const plus = page.getByRole('button', { name: /tăng số vé/i });
  const minus = page.getByRole('button', { name: /giảm số vé/i });
  if (await plus.count()) {
    await plus.first().click().catch(() => {});
    await plus.first().click().catch(() => {});
    if (await minus.count()) await minus.first().click().catch(() => {});
    rec({ phase: 'G-trip', route: '/trips/[id]', action: 'ticket stepper +/-', status: 'PASS', detail: 'stepper clicked (2× tăng, 1× giảm)', shot: await shoot(page, 'trip-stepper') });
  } else {
    rec({ phase: 'G-trip', route: '/trips/[id]', action: 'ticket stepper', status: 'WARN', detail: 'no stepper buttons' });
  }
  const book = page.getByRole('button', { name: /đặt vé/i });
  if (await book.count()) {
    await book.first().click().catch(() => {});
    try {
      await page.waitForURL('**/booking/customer', { timeout: 12000 });
      rec({ phase: 'G-trip', route: '/trips/[id]→/booking/customer', action: 'Đặt vé', status: 'PASS', detail: 'reached customer form' });
    } catch {
      rec({ phase: 'G-trip', route: '/trips/[id]→/booking/customer', action: 'Đặt vé', status: 'BROKEN', detail: `stuck at ${safePath(page.url())}`, shot: await shoot(page, 'trip-book-stuck') });
    }
  } else {
    rec({ phase: 'G-trip', route: '/trips/[id]', action: 'book button', status: 'WARN', detail: 'no Đặt vé button on detail page' });
  }
}

// ---- Phase H: login with password (S04) ------------------------------------

async function phaseLogin(page: Page) {
  const phone = await registerViaUi(page, 'H-login(setup)');
  if (!phone) {
    rec({ phase: 'H-login', route: '/auth/login', action: 'setup register', status: 'BROKEN', detail: 'could not create an account to log in with' });
    return;
  }
  // wrong password → error message
  CURRENT_CTX = `login wrong ${phone}`;
  await visit(page, '/auth/login?returnTo=/account/bookings', 'H-login');
  await page.locator('#phone').fill(phone);
  await page.locator('#password').fill('WrongPass999');
  EXPECT_LOGIN_401 = true;
  await page.getByRole('button', { name: /^đăng nhập$/i }).click();
  // wait for the error to render AND the button to return to idle before re-submitting
  await page.getByText(/không đúng/i).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  EXPECT_LOGIN_401 = false;
  const wrongErr = await page.getByText(/không đúng/i).count();
  rec({ phase: 'H-login', route: '/auth/login', action: 'wrong password → error', status: wrongErr ? 'PASS' : 'WARN', detail: wrongErr ? 'shows "không đúng"' : 'no error shown for wrong password', shot: await shoot(page, 'login-wrong') });
  // correct password → authed landing on returnTo. Capture the login response so a
  // slow-but-successful POST isn't misread as broken (the button label flips to
  // "Đang đăng nhập..." while loading, so we wait on the response, not the label).
  CURRENT_CTX = `login ok ${phone}`;
  await page.locator('#password').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.locator('#phone').fill(phone);
  await page.locator('#password').fill('Password1Test');
  const loginResp = page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 20000 });
  await page.getByRole('button', { name: /^đăng nhập$/i }).click();
  const lr = await loginResp.catch(() => null);
  const lstatus = lr?.status() ?? 0;
  if (lstatus === 200) await page.waitForURL('**/account/bookings', { timeout: 15000 }).catch(() => {});
  const authed = /\/account\/bookings/.test(page.url());
  rec({
    phase: 'H-login',
    route: '/auth/login→/account/bookings',
    action: 'login (POST /api/auth/login)',
    status: authed ? 'PASS' : lstatus === 200 ? 'WARN' : 'BROKEN',
    detail: authed ? `HTTP 200, reached bookings authed` : `login HTTP ${lstatus || 'no-response'}; at ${safePath(page.url())}`,
    shot: await shoot(page, 'login-ok'),
  });
}

// ---- Phase I: account settings mutations (SPA continuity) -------------------

/** From post-register '/', reach settings WITHOUT a hard reload (in-memory token). */
async function gotoSettingsSpa(page: Page, phase: string): Promise<boolean> {
  const acct = page.getByRole('link', { name: /tài khoản/i });
  if (!(await acct.count())) {
    rec({ phase, route: 'header', action: 'find Tài khoản link', status: 'BROKEN', detail: 'no account nav link' });
    return false;
  }
  await acct.first().click().catch(() => {});
  await page.waitForURL('**/account/**', { timeout: 12000 }).catch(() => {});
  if (/\/auth\/login/.test(page.url())) {
    rec({ phase, route: '/account/bookings', action: 'reach account (SPA)', status: 'BROKEN', detail: 'bounced to login (token lost)' });
    return false;
  }
  const settings = page.locator('a[href="/account/settings"]');
  if (!(await settings.count())) {
    rec({ phase, route: '/account/bookings', action: 'find settings link', status: 'BROKEN', detail: 'no in-app settings link' });
    return false;
  }
  await settings.first().click().catch(() => {});
  await page.waitForURL('**/account/settings', { timeout: 12000 }).catch(() => {});
  const onSettings = /\/account\/settings/.test(page.url());
  rec({ phase, route: '/account/settings', action: 'reach settings (SPA, token alive)', status: onSettings ? 'PASS' : 'BROKEN', detail: onSettings ? 'on settings page authed' : `at ${safePath(page.url())}` });
  return onSettings;
}

async function phaseSettingsMutations(page: Page) {
  // Account A — change name + change phone (both session-preserving).
  if (await registerViaUi(page, 'I-settings-A(setup)')) {
    if (await gotoSettingsSpa(page, 'I-settings')) {
      await page.locator('#displayName').fill('Renamed Tester');
      await page.getByRole('button', { name: /lưu tên/i }).click();
      await page.waitForTimeout(1200);
      const nameOk = await page.getByText(/đã cập nhật tên hiển thị/i).count();
      rec({ phase: 'I-settings', route: '/account/settings', action: 'change displayName (PATCH /api/account/name)', status: nameOk ? 'PASS' : 'BROKEN', detail: nameOk ? 'name updated' : `no success — alert: ${await alertText(page)}`, shot: await shoot(page, 'settings-name') });

      const newPhone = freshPhone();
      await page.locator('#newPhone').fill(newPhone);
      await page.getByRole('button', { name: /gửi mã otp/i }).click();
      const otpField = page.locator('#phone-otp');
      const advanced = await otpField.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
      if (advanced) {
        const code = await peekOtp(page, newPhone);
        if (code) {
          await otpField.fill(code);
          await page.getByRole('button', { name: /^xác nhận$/i }).click();
          await page.waitForTimeout(1500);
          const phoneOk = await page.getByText(/đã đổi số điện thoại thành công/i).count();
          rec({ phase: 'I-settings', route: '/account/settings', action: 'change phone (OTP from backend)', status: phoneOk ? 'PASS' : 'BROKEN', detail: phoneOk ? 'phone changed' : `no success — alert: ${await alertText(page)}`, shot: await shoot(page, 'settings-phone') });
        } else {
          rec({ phase: 'I-settings', route: '/account/settings', action: 'change phone OTP peek', status: 'BROKEN', detail: 'no code from backend sink' });
        }
      } else {
        rec({ phase: 'I-settings', route: '/account/settings', action: 'change phone init (POST /api/account/phone/init)', status: 'BROKEN', detail: `did not advance to OTP — alert: ${await alertText(page)}` });
      }
    }
  }

  // Account B — change password (invalidates the session by design).
  if (await registerViaUi(page, 'I-password(setup)')) {
    if (await gotoSettingsSpa(page, 'I-password')) {
      await page.locator('#currentPassword').fill('Password1Test');
      await page.locator('#newPassword').fill('Password9New');
      await page.locator('#confirmPassword').fill('Password9New');
      await page.getByRole('button', { name: /đổi mật khẩu/i }).click();
      await page.waitForTimeout(1500);
      const ok = await page.getByText(/đã đổi mật khẩu/i).count();
      rec({ phase: 'I-password', route: '/account/settings', action: 'change password (POST /api/account/password)', status: ok ? 'PASS' : 'BROKEN', detail: ok ? 'password changed' : `no success — alert: ${await alertText(page)}`, shot: await shoot(page, 'settings-password') });
    }
  }

  // Account C — delete account.
  if (await registerViaUi(page, 'I-delete(setup)')) {
    if (await gotoSettingsSpa(page, 'I-delete')) {
      await page.getByRole('button', { name: /^xóa tài khoản$/i }).click().catch(() => {});
      const confirm = page.getByRole('button', { name: /xác nhận xóa/i });
      if (await confirm.count()) {
        await confirm.first().click().catch(() => {});
        await page.waitForURL((u) => u.pathname === '/', { timeout: 12000 }).catch(() => {});
        const deleted = (() => { try { return new URL(page.url()).pathname === '/'; } catch { return false; } })();
        rec({ phase: 'I-delete', route: '/account/settings', action: 'delete account (DELETE /api/account/delete)', status: deleted ? 'PASS' : 'BROKEN', detail: deleted ? 'account deleted, redirected home' : `at ${safePath(page.url())} — alert: ${await alertText(page)}`, shot: await shoot(page, 'settings-delete') });
      } else {
        rec({ phase: 'I-delete', route: '/account/settings', action: 'delete confirm', status: 'BROKEN', detail: 'no "Xác nhận xóa" button after first click' });
      }
    }
  }
}

// ---- Phase J: guest → account link (shared phone, S04) ----------------------

async function phaseGuestLink(page: Page) {
  const shared = freshPhone();
  CURRENT_CTX = `guest-link ${shared}`;
  // 1) guest booking with the shared phone (funnel to review; pay skipped)
  const reached = await gotoReview(page, 'J-link', shared);
  rec({ phase: 'J-link', route: '/booking/review', action: 'guest booking w/ shared phone', status: reached ? 'PASS' : 'WARN', detail: reached ? `hold created for ${shared}` : 'did not reach review' });
  // 2) register with the SAME phone → guest-link mechanism runs on register
  const registered = await registerViaUi(page, 'J-link', shared);
  if (!registered) {
    rec({ phase: 'J-link', route: '/auth/register', action: 'register w/ shared phone', status: 'BROKEN', detail: 'could not register the shared phone' });
    return;
  }
  // 3) view bookings authed; record outcome (+ skip-pay caveat)
  const acct = page.getByRole('link', { name: /tài khoản/i });
  if (await acct.count()) {
    await acct.first().click().catch(() => {});
    await page.waitForURL('**/account/**', { timeout: 12000 }).catch(() => {});
    const authed = !/\/auth\/login/.test(page.url());
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const rows = await page.locator('a[href*="/account/bookings/"]').count();
    rec({ phase: 'J-link', route: '/account/bookings', action: 'guest→account link result', status: authed ? 'PASS' : 'BROKEN', detail: authed ? `bookings list authed; ${rows} attached row(s) — skip-pay: held(unpaid) booking is NOT attached (only paid bookings link), so 0 rows is expected this pass` : 'bounced to login', shot: await shoot(page, 'guest-link') });
  } else {
    rec({ phase: 'J-link', route: 'header', action: 'find Tài khoản link', status: 'BROKEN', detail: 'no account nav link after register' });
  }
}

// ---- driver ----------------------------------------------------------------

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    rec({ phase: 'phase-error', route: '-', action: name, status: 'BROKEN', detail: `phase threw: ${String((e as Error).message).slice(0, 160)}` });
  }
}

async function runViewport(browser: Browser, vp: 'desktop' | 'mobile', full: boolean) {
  CURRENT_VP = vp;
  const ctx: BrowserContext = await browser.newContext(
    vp === 'mobile' ? { ...devices['iPhone SE'], viewport: { width: 390, height: 844 } } : { viewport: { width: 1280, height: 900 } }
  );
  const page = await ctx.newPage();
  instrument(page);
  rec({ phase: 'meta', route: '-', action: 'start viewport', status: 'INFO', detail: `${vp} @ ${BASE}` });

  await step('static-crawl', () => phaseStaticCrawl(page));
  await step('search-interactions', () => phaseSearchInteractions(page));
  await step('trip-detail', () => phaseTripDetail(page));
  await step('guest-booking', () => phaseBooking(page, full));
  await step('charter', () => phaseCharter(page));
  await step('account', () => phaseAccount(page));
  if (full) {
    await step('login', () => phaseLogin(page));
    await step('settings-mutations', () => phaseSettingsMutations(page));
    await step('guest-link', () => phaseGuestLink(page));
    await step('forgot-password', () => phaseForgotPassword(page));
    await step('reset-password', () => phaseResetPassword(page));
  }

  await ctx.close();
}

async function main() {
  const probe = await fetch(`${ORIGIN}/api/trips/search?origin=${encodeURIComponent('Hà Nội')}&destination=${encodeURIComponent('TP.HCM')}&date=${TOMORROW}&ticketCount=1`).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`Preflight FAILED: ${ORIGIN} not answering /api/trips/search. Is dev up on ${BASE}?`);
    process.exit(1);
  }
  const trips = (await probe.json().catch(() => [])) as unknown[];
  if (!Array.isArray(trips) || trips.length === 0) {
    console.error(`Preflight FAILED: no seeded trips for Hà Nội→TP.HCM on ${TOMORROW}. Run prisma seed.`);
    process.exit(1);
  }
  console.log(`Preflight OK: ${trips.length} trips for ${TOMORROW}. Crawling ${BASE} ...`);

  const browser = await chromium.launch({ headless: true });
  try {
    await runViewport(browser, 'desktop', true);
    await runViewport(browser, 'mobile', false);
  } finally {
    await browser.close();
  }
  writeReport();
}

// ---- report -----------------------------------------------------------------

// Maps each restated traveler story to the phase that exercises it. The Result
// column is derived from the worst finding under that phase prefix at run time.
const STORIES: { group: string; text: string; phase: string; mode: 'covered' | 'skip-pay' }[] = [
  { group: 'S02 Search', text: 'Search trips (origin/dest/date/qty) → results load', phase: 'A-static', mode: 'covered' },
  { group: 'S02 Search', text: 'Filter (bus-type) / sort (price) / next-prev-day nav', phase: 'F-search', mode: 'covered' },
  { group: 'S02 Search', text: 'Trip detail page + ticket-count stepper', phase: 'G-trip', mode: 'covered' },
  { group: 'S03 Buy', text: 'Guest checkout: buyer form → seat hold + countdown → review', phase: 'B-booking', mode: 'covered' },
  { group: 'S03 Buy', text: 'Pay rail → result → confirmation → ticket PDF → /verify page', phase: '__skip__', mode: 'skip-pay' },
  { group: 'S04 Account', text: 'Register via phone + OTP (+ password)', phase: 'D-account', mode: 'covered' },
  { group: 'S04 Account', text: 'Login via phone + password (+ wrong-password path)', phase: 'H-login', mode: 'covered' },
  { group: 'S04 Account', text: 'Bookings list (upcoming/past tabs) + detail', phase: 'D-account', mode: 'covered' },
  { group: 'S04 Account', text: 'Settings: change name / phone (OTP) / password / delete', phase: 'I-', mode: 'covered' },
  { group: 'S04 Account', text: 'Guest → account auto-link by shared phone', phase: 'J-link', mode: 'covered' },
  { group: 'S04 Account', text: 'Forgot password (OTP from backend)', phase: 'C-forgot', mode: 'covered' },
  { group: 'S04 Account', text: 'Reset password (OTP from backend)', phase: 'C-reset', mode: 'covered' },
  { group: 'S16 Charter', text: 'Charter request → confirmation ref → status → cancel', phase: 'E-charter', mode: 'covered' },
];

function storyResult(phase: string): string {
  const hits = findings.filter((f) => f.phase.startsWith(phase));
  if (!hits.length) return '⬜ not exercised';
  if (hits.some((f) => f.status === 'BROKEN')) return '🟥 BROKEN';
  if (hits.some((f) => f.status === 'WARN')) return '🟧 WARN';
  return '🟩 PASS';
}

function writeReport() {
  const broken = findings.filter((f) => f.status === 'BROKEN');
  const warn = findings.filter((f) => f.status === 'WARN');
  const pass = findings.filter((f) => f.status === 'PASS');
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const row = (f: Finding) => `| ${f.status} | ${f.viewport} | ${f.phase} | ${esc(f.route)} | ${esc(f.action)} | ${esc(f.detail)}${f.shot ? ` ([shot](traveler-smoke-shots/${f.shot}))` : ''} |`;

  let md = `# Traveler-side smoke crawl — ${TODAY}

Target: \`${BASE}\` · Driver: standalone Playwright (\`scripts/smoke/traveler-crawl.mts\`) · Viewports: desktop 1280 + mobile-390.
Mode: full mutating flows. OTP for every otp-gated flow pulled directly from the backend test-peek sink (\`/api/auth/otp/test-peek\`).

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | ${broken.length} |
| 🟧 WARN | ${warn.length} |
| 🟩 PASS | ${pass.length} |
| Total checks | ${findings.length} |

`;
  md += `## Story coverage matrix\n\nEach restated traveler story → the phase that exercises it → result.\n\n| Story | Coverage | Result |\n|---|---|---|\n`;
  for (const s of STORIES) {
    const result = s.mode === 'skip-pay' ? '⏭ skip-pay (payment step intentionally skipped)' : storyResult(s.phase);
    md += `| **${s.group}** — ${esc(s.text)} | \`${s.phase === '__skip__' ? '—' : s.phase}\` | ${result} |\n`;
  }
  md += '\n';
  md += `## 🟥 Broken transitions / functions\n\n`;
  md += broken.length === 0 ? `_None detected._\n\n` : `| Sev | VP | Phase | Route | Action | Detail |\n|---|---|---|---|---|---|\n${broken.map(row).join('\n')}\n\n`;
  md += `## 🟧 Warnings (degraded / needs human eyes)\n\n`;
  md += warn.length === 0 ? `_None._\n\n` : `| Sev | VP | Phase | Route | Action | Detail |\n|---|---|---|---|---|---|\n${warn.map(row).join('\n')}\n\n`;

  md += `## Route load matrix\n\n| Route | Result |\n|---|---|\n`;
  const byRoute = new Map<string, Finding>();
  for (const f of findings.filter((x) => x.action === 'load')) if (!byRoute.has(f.route)) byRoute.set(f.route, f);
  for (const [r, f] of byRoute) md += `| ${esc(r)} | ${f.status} — ${esc(f.detail)} |\n`;
  md += '\n';

  md += `## In-app link graph (from → to)\n\n`;
  for (const [from, tos] of Object.entries(linkGraph)) { if (tos.length) md += `- \`${from}\` → ${[...new Set(tos)].slice(0, 30).map((t) => `\`${t}\``).join(', ')}\n`; }
  md += '\n## Button inventory (per route)\n\n';
  for (const [r, bs] of Object.entries(buttonInv)) { if (bs.length) md += `- \`${r}\`: ${[...new Set(bs)].map((b) => `"${b}"`).join(', ')}\n`; }
  md += '\n';

  md += `## Full check log\n\n| Sev | VP | Phase | Route | Action | Detail |\n|---|---|---|---|---|---|\n${findings.map(row).join('\n')}\n`;

  const file = join(OUT_DIR, `traveler-smoke-${TODAY}.md`);
  writeFileSync(file, md, 'utf8');
  console.log(`\n=== REPORT: ${file} ===\nBROKEN=${broken.length} WARN=${warn.length} PASS=${pass.length} TOTAL=${findings.length}`);
}

main().catch((e) => {
  console.error('crawl crashed:', e);
  writeReport();
  process.exit(1);
});
