/**
 * operator-crawl.mts — standalone Playwright smoke crawl of the OPERATOR side.
 *
 * Acts as a real operator user (seed admin): logs in via the UI, drives the
 * forced first-login password change, BFS-crawls every /op console route,
 * inventories every button, and exercises the real mutation flows END-TO-END
 * INCLUDING DESTRUCTIVE actions — create/cancel trip, create/deactivate bus,
 * mark departed/completed, check-in/no-show, withdraw, create/disable staff,
 * create/deactivate route + pickup, create/deactivate template, charter,
 * payout bank account, KYB, reports. OTP-gated steps pull the code DIRECTLY
 * from the backend test-peek sink. Emits a fresh broken-function report.
 *
 * Run (dev server must already be up on :3001 — :3000 is a DIFFERENT app):
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm tsx scripts/smoke/operator-crawl.mts
 *
 * Requires .env.local with OTP_PEEK_ENABLED=true + DATABASE_URL (dev). The crawl
 * MUTATES + DESTROYS dev DB rows (creates throwaway buses/routes/trips it then
 * deactivates/cancels). A leading pg pre-reset restores the seed operator to a
 * re-runnable state (password=BBOp2026!, requiresPasswordChange=true) so the
 * first-login phase is repeatable. Re-seed (`pnpm db:seed`) before a clean re-run.
 * Does NOT manage the dev server — reuses the live one. Observe-and-report only.
 */

import { chromium, type Browser, type Page, type BrowserContext } from '@playwright/test';
import { Client } from 'pg';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from '../../lib/auth/password';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const ORIGIN = new URL(BASE).origin;
const OUT_DIR = join(process.cwd(), 'docs', 'qa');
const SHOT_DIR = join(OUT_DIR, 'operator-smoke-shots');
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';
const SEED_PHONE_LOCAL = '0901230001'; // UI accepts local form, server normalizes → +84901230001
const SEED_PHONE_E164 = '+84901230001';
const SEED_PASSWORD = 'BBOp2026!';
const NEW_PASSWORD = 'BBSmoke2026!'; // set during first-login; differs from old, ≥8 chars

// ---- delete old shots, recreate ---------------------------------------------
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
const seenConsole = new Set<string>();

let CURRENT_VP = 'desktop';
let CURRENT_CTX = 'startup';

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

function safePath(u: string): string {
  try {
    const x = new URL(u);
    return x.pathname + (x.search ? x.search.slice(0, 60) : '');
  } catch {
    return u;
  }
}

// ---- per-page instrumentation ----------------------------------------------

// Paths the crawl deliberately hits expecting a 404 (invalid-id guard probe).
// Their 404 + console.error are EXPECTED — don't flag them as WARN.
const INTENTIONAL_404 = /\/op\/buses\/INVALID-ID-TEST/;

function instrument(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|Download the React DevTools|\[Fast Refresh\]|hydrat/i.test(text)) return;
    if (INTENTIONAL_404.test(safePath(page.url()))) return; // expected invalid-id 404
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
    if (INTENTIONAL_404.test(p)) return; // expected invalid-id 404 probe
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
      rec({ phase, route: path, action: 'load', status: 'INFO', detail: 'HTTP 404 (notFound — expected for invalid id)' });
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

async function alertText(page: Page): Promise<string> {
  const a = page.locator('[role="alert"], .text-destructive, [data-testid$="-message"], [data-testid$="-error"]');
  if (await a.count()) return ((await a.first().textContent()) ?? '').trim().replace(/\s+/g, ' ').slice(0, 140) || '(empty)';
  return '(no alert)';
}

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

/** base-ui Select: click trigger, click the option matching `optionRe`. */
async function pickSelect(page: Page, testid: string, optionRe: RegExp): Promise<boolean> {
  const trigger = page.locator(`[data-testid="${testid}"]`);
  if (!(await trigger.count())) return false;
  await trigger.first().click().catch(() => {});
  const opt = page.getByRole('option', { name: optionRe });
  await opt.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await opt.count()) {
    await opt.first().click().catch(() => {});
    return true;
  }
  // fallback: pick first option, then close
  const any = page.getByRole('option');
  if (await any.count()) {
    await any.first().click().catch(() => {});
    return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

/** base-ui Select: pick the FIRST available option (when any will do). */
async function pickFirstOption(page: Page, testid: string): Promise<boolean> {
  const trigger = page.locator(`[data-testid="${testid}"]`);
  if (!(await trigger.count())) return false;
  await trigger.first().click().catch(() => {});
  const any = page.getByRole('option');
  await any.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await any.count()) {
    await any.first().click().catch(() => {});
    return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

/** base-ui DatePicker: click trigger, click today (or first selectable day). */
async function pickToday(page: Page, triggerSel: string): Promise<boolean> {
  const t = page.locator(triggerSel);
  if (!(await t.count())) return false;
  await t.first().click().catch(() => {});
  const today = page.locator('[role="grid"] button[aria-current="date"]');
  await today.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await today.count()) {
    await today.first().click().catch(() => {});
    return true;
  }
  const enabled = page.locator('[role="grid"] button:not([aria-disabled="true"])');
  if (await enabled.count()) {
    await enabled.first().click().catch(() => {});
    return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

/** Future `datetime-local` value 'YYYY-MM-DDTHH:MM' (VN wall-clock, days ahead). */
function futureDatetimeLocal(daysAhead: number, hour: number): string {
  const [y, m, d] = TODAY.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  t.setUTCDate(t.getUTCDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(hour)}:00`;
}

/** Authenticated GET via the page's request context (carries op cookies). */
async function apiGet<T = unknown>(page: Page, path: string): Promise<T | null> {
  const r = await page.request.get(`${ORIGIN}${path}`).catch(() => null);
  if (!r || !r.ok()) return null;
  return (await r.json().catch(() => null)) as T | null;
}

/** Re-login via the UI (password is NEW_PASSWORD after the first-login change). */
async function opReLogin(page: Page) {
  await page.goto(`${ORIGIN}/op/login`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.locator('#op-login-phone').fill(SEED_PHONE_LOCAL).catch(() => {});
  await page.locator('#op-login-password').fill(NEW_PASSWORD).catch(() => {});
  await page.getByRole('button', { name: /^đăng nhập$/i }).click().catch(() => {});
  await page.waitForURL(/\/op\/dashboard/, { timeout: 15000 }).catch(() => {});
}

/**
 * Refresh the 15-min operator access token so a long unattended crawl doesn't
 * outlive its session. Rotates bb_op_access/bb_op_refresh via the refresh route;
 * falls back to a full re-login if the refresh family is gone.
 */
async function keepAlive(page: Page) {
  const cookies = await page.context().cookies().catch(() => [] as { name: string; value: string }[]);
  const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';
  const r = await page.request
    .post(`${ORIGIN}/api/op/auth/refresh`, { headers: { 'X-CSRF-Token': csrf } })
    .catch(() => null);
  if (!r || !r.ok()) {
    rec({ phase: 'meta', route: '/api/op/auth/refresh', action: 'keepAlive token refresh', status: 'INFO', detail: `refresh HTTP ${r?.status() ?? 'err'} — re-login` });
    await opReLogin(page);
  }
}

// ---- pg pre-reset -----------------------------------------------------------

async function preReset(): Promise<boolean> {
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
    const passwordHash = await hash(SEED_PASSWORD);
    const res = await client.query(
      `UPDATE "OperatorUser" SET "passwordHash" = $1, "requiresPasswordChange" = true
       WHERE phone = $2 RETURNING id`,
      [passwordHash, SEED_PHONE_E164]
    );
    if (res.rowCount === 0) {
      rec({ phase: 'meta', route: '-', action: 'pg pre-reset', status: 'BROKEN', detail: `seed operator ${SEED_PHONE_E164} NOT found — run pnpm db:seed` });
      return false;
    }
    // Revoke any live sessions so login starts clean.
    await client.query(
      `UPDATE "OperatorSession" SET "revokedAt" = NOW()
       WHERE "operatorUserId" = (SELECT id FROM "OperatorUser" WHERE phone = $1) AND "revokedAt" IS NULL`,
      [SEED_PHONE_E164]
    ).catch(() => {});
    rec({ phase: 'meta', route: '-', action: 'pg pre-reset', status: 'PASS', detail: 'seed operator reset (password=BBOp2026!, requiresPasswordChange=true)' });
    return true;
  } catch (e) {
    rec({ phase: 'meta', route: '-', action: 'pg pre-reset', status: 'BROKEN', detail: `pg error: ${String((e as Error).message).slice(0, 140)}` });
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

// ---- route sets -------------------------------------------------------------

const PUBLIC_OP_ROUTES = [
  '/op/login',
  '/op/register',
  '/op/register/confirmation',
  '/op/forgot-password',
  '/op/staff/dashboard',
];

const CONSOLE_ROUTES = [
  '/op/dashboard',
  '/op/buses',
  '/op/trips',
  '/op/trips/new',
  '/op/routes',
  '/op/bookings',
  '/op/money',
  '/op/charter',
  '/op/settings',
  '/op/profile',
  '/op/staff',
  '/op/status',
  '/op/kyb',
  '/op/activity',
  '/op/upcoming',
  '/op/trip-templates',
  '/op/reports/overview',
  '/op/reports/revenue',
  '/op/reports/payouts',
  '/op/manifest',
];

const linkGraph: Record<string, string[]> = {};
const buttonInv: Record<string, string[]> = {};

// ---- Phase A: pre-auth (logged out) ----------------------------------------

async function phaseAuthGuard(page: Page) {
  // Public op pages should load.
  for (const r of PUBLIC_OP_ROUTES) await visit(page, r, 'A-guard');
  buttonInv['/op/login'] = await buttonLabels(page).catch(() => []);
  // Console pages must redirect to /op/login when unauthenticated.
  for (const r of ['/op/dashboard', '/op/buses', '/op/money', '/op/staff']) {
    await visit(page, r, 'A-guard');
    const guarded = /\/op\/login/.test(page.url());
    rec({ phase: 'A-guard', route: r, action: 'auth-guard (logged out)', status: guarded ? 'PASS' : 'BROKEN', detail: guarded ? 'redirected to /op/login' : `NO redirect — at ${safePath(page.url())}` });
  }
}

// ---- Phase B: login + forced first-login -----------------------------------

async function phaseLogin(page: Page): Promise<boolean> {
  CURRENT_CTX = 'op login';
  await visit(page, '/op/login', 'B-login');
  await page.locator('#op-login-phone').fill(SEED_PHONE_LOCAL);
  await page.locator('#op-login-password').fill(SEED_PASSWORD);
  const loginResp = page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 20000 });
  await page.getByRole('button', { name: /^đăng nhập$/i }).click();
  const lr = await loginResp.catch(() => null);
  const lstatus = lr?.status() ?? 0;
  await page.waitForURL(/\/op\/(first-login|dashboard)/, { timeout: 15000 }).catch(() => {});
  if (lstatus !== 200) {
    rec({ phase: 'B-login', route: '/op/login', action: 'login (POST /api/auth/login)', status: 'BROKEN', detail: `login HTTP ${lstatus || 'no-response'}; at ${safePath(page.url())}`, shot: await shoot(page, 'op-login-fail') });
    return false;
  }
  const onFirst = /\/op\/first-login/.test(page.url());
  rec({ phase: 'B-login', route: '/op/login', action: 'login (POST /api/auth/login)', status: 'PASS', detail: `HTTP 200 → ${safePath(page.url())}`, shot: await shoot(page, 'op-login-ok') });

  if (onFirst) {
    CURRENT_CTX = 'op first-login';
    await page.locator('#op-current-password').fill(SEED_PASSWORD);
    await page.locator('#op-new-password').fill(NEW_PASSWORD);
    await page.locator('#op-confirm-password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click();
    await page.waitForURL(/\/op\/dashboard/, { timeout: 15000 }).catch(() => {});
    const onDash = /\/op\/dashboard/.test(page.url());
    rec({ phase: 'B-login', route: '/op/first-login', action: 'forced password change (POST /api/op/auth/password/change)', status: onDash ? 'PASS' : 'BROKEN', detail: onDash ? 'password changed → dashboard' : `stuck at ${safePath(page.url())} — alert: ${await alertText(page)}`, shot: await shoot(page, 'op-first-login') });
    return onDash;
  }

  // No forced change (flag was already false) — proceed if on dashboard.
  const onDash = /\/op\/dashboard/.test(page.url());
  rec({ phase: 'B-login', route: '/op/login', action: 'first-login gate', status: 'WARN', detail: `requiresPasswordChange was not enforced (landed ${safePath(page.url())})` });
  return onDash || /\/op\//.test(page.url());
}

// ---- Phase C: BFS console crawl (every route, every button) -----------------

async function phaseConsoleCrawl(page: Page) {
  const seen = new Set<string>();
  const queue = [...CONSOLE_ROUTES];
  let visitsSinceRefresh = 0;
  while (queue.length) {
    const path = queue.shift()!;
    const key = path.split('?')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    if (++visitsSinceRefresh >= 8) { await keepAlive(page); visitsSinceRefresh = 0; }
    const st = await visit(page, path, 'C-crawl');
    if (st === null) continue;
    if (/\/op\/login/.test(page.url())) {
      rec({ phase: 'C-crawl', route: path, action: 'session check', status: 'BROKEN', detail: 'bounced to /op/login mid-crawl (session lost)' });
      continue;
    }
    const links = await internalLinks(page);
    linkGraph[path] = links;
    buttonInv[path] = await buttonLabels(page);
    await shoot(page, 'route' + path);
    for (const l of links) {
      const lk = l.split('?')[0];
      if (seen.has(lk)) continue;
      if (!lk.startsWith('/op')) continue; // operator side only
      if (/\/op\/(login|first-login|logout)/.test(lk)) continue; // don't self-logout
      queue.push(l);
    }
  }
}

// ---- Phase D: dynamic detail routes ----------------------------------------

async function phaseDetailRoutes(page: Page) {
  // Resolve a real bus / trip / booking id from the authed API, then load each detail page.
  const buses = (await apiGet<{ id: string }[]>(page, '/api/op/buses')) ?? [];
  const busList = Array.isArray(buses) ? buses : (buses as { buses?: { id: string }[] }).buses ?? [];
  if (busList[0]?.id) await visit(page, `/op/buses/${busList[0].id}`, 'D-detail');
  else rec({ phase: 'D-detail', route: '/op/buses/[id]', action: 'resolve bus id', status: 'INFO', detail: 'no buses to open detail' });

  const trips = (await apiGet<{ id: string }[]>(page, '/api/op/trips')) ?? [];
  const tripList = Array.isArray(trips) ? trips : (trips as { trips?: { id: string }[] }).trips ?? [];
  if (tripList[0]?.id) {
    await visit(page, `/op/trips/${tripList[0].id}`, 'D-detail');
    await visit(page, `/op/manifest/${tripList[0].id}`, 'D-detail');
  } else {
    rec({ phase: 'D-detail', route: '/op/trips/[id]', action: 'resolve trip id', status: 'INFO', detail: 'no trips to open detail' });
  }

  const bookings = (await apiGet<{ id: string }[]>(page, '/api/op/bookings')) ?? [];
  const bkList = Array.isArray(bookings) ? bookings : (bookings as { bookings?: { id: string }[] }).bookings ?? [];
  if (bkList[0]?.id) await visit(page, `/op/bookings/${bkList[0].id}`, 'D-detail');
  else rec({ phase: 'D-detail', route: '/op/bookings/[id]', action: 'resolve booking id', status: 'INFO', detail: 'no bookings to open detail' });

  // invalid-id guard
  await visit(page, '/op/buses/INVALID-ID-TEST', 'D-detail');
}

// ---- Phase E: catalog mutations (S06) — buses + routes ----------------------

const SMOKE_TAG = `SMK${String(Date.now()).slice(-6)}`;
const createdBusPlates: string[] = [];

async function createBus(page: Page, plate: string, label: string): Promise<string | null> {
  await visit(page, '/op/buses', 'E-catalog');
  await page.locator('[data-testid="new-plate"]').fill(plate);
  await page.locator('[data-testid="new-capacity"]').fill('20');
  await pickFirstOption(page, 'new-bustype');
  await page.locator('[data-testid="add-bus-submit"]').click();
  await page.waitForTimeout(1500);
  const ok = (await apiGet<unknown>(page, '/api/op/buses')) !== null;
  const buses = (await apiGet<{ id: string; licensePlate?: string; plate?: string }[]>(page, '/api/op/buses')) ?? [];
  const list = Array.isArray(buses) ? buses : (buses as { buses?: { id: string; licensePlate?: string; plate?: string }[] }).buses ?? [];
  const found = list.find((b) => (b.licensePlate ?? b.plate) === plate);
  rec({ phase: 'E-catalog', route: '/op/buses', action: `create bus ${label} (POST /api/op/buses)`, status: found ? 'PASS' : 'BROKEN', detail: found ? `bus ${plate} created (id ${found.id})` : `bus not in list after submit — alert: ${await alertText(page)}`, shot: await shoot(page, 'create-bus-' + label) });
  if (found) createdBusPlates.push(plate);
  void ok;
  return found?.id ?? null;
}

async function phaseCatalog(page: Page): Promise<{ busAId: string | null; busBId: string | null; routeId: string | null }> {
  CURRENT_CTX = 'catalog mutations';
  const busAId = await createBus(page, `${SMOKE_TAG}A`, 'A');
  const busBId = await createBus(page, `${SMOKE_TAG}B`, 'B');

  // Maintenance window on bus A
  if (busAId) {
    await visit(page, '/op/buses', 'E-catalog');
    const toggle = page.locator(`[data-testid="bus-toggle-${busAId}"]`);
    if (await toggle.count()) {
      await toggle.first().click().catch(() => {});
      await page.locator(`[data-testid="maintenance-start-${busAId}"]`).fill(futureDatetimeLocal(40, 8)).catch(() => {});
      await page.locator(`[data-testid="maintenance-end-${busAId}"]`).fill(futureDatetimeLocal(40, 18)).catch(() => {});
      await page.locator(`[data-testid="maintenance-reason-${busAId}"]`).fill('Smoke maintenance').catch(() => {});
      const addBtn = page.locator(`[data-testid="maintenance-add-${busAId}"]`);
      await addBtn.click().catch(() => {});
      await page.waitForTimeout(1200);
      rec({ phase: 'E-catalog', route: '/op/buses', action: 'add maintenance window (POST .../maintenance)', status: 'PASS', detail: `clicked add — ${await alertText(page)}`, shot: await shoot(page, 'maintenance-add') });
    } else {
      rec({ phase: 'E-catalog', route: '/op/buses', action: 'maintenance toggle', status: 'WARN', detail: 'no maintenance toggle for created bus' });
    }
  }

  // Create route
  let routeId: string | null = null;
  await visit(page, '/op/routes', 'E-catalog');
  const createRouteBtn = page.locator('[data-testid="create-route-btn"]');
  if (await createRouteBtn.count()) {
    await createRouteBtn.first().click().catch(() => {});
    await page.locator('[data-testid="route-dialog-origin"]').fill(`Smoke ${SMOKE_TAG} A`).catch(() => {});
    await page.locator('[data-testid="route-dialog-destination"]').fill(`Smoke ${SMOKE_TAG} B`).catch(() => {});
    await page.locator('[data-testid="route-dialog-duration"]').fill('120').catch(() => {});
    await page.locator('[data-testid="route-dialog-save"]').click().catch(() => {});
    await page.waitForTimeout(1500);
    const routes = (await apiGet<{ id: string; origin?: string }[]>(page, '/api/op/routes')) ?? [];
    const rlist = Array.isArray(routes) ? routes : (routes as { routes?: { id: string; origin?: string }[] }).routes ?? [];
    const found = rlist.find((r) => (r.origin ?? '').includes(SMOKE_TAG));
    routeId = found?.id ?? null;
    rec({ phase: 'E-catalog', route: '/op/routes', action: 'create route (POST /api/op/routes)', status: found ? 'PASS' : 'BROKEN', detail: found ? `route created (id ${found.id})` : `route not found after submit — alert: ${await alertText(page)}`, shot: await shoot(page, 'create-route') });
  } else {
    rec({ phase: 'E-catalog', route: '/op/routes', action: 'find create-route btn', status: 'BROKEN', detail: 'no create-route-btn' });
  }

  // Add a pickup point to the created route (window.confirm on delete; add is plain)
  if (routeId) {
    const pTog = page.locator(`[data-testid="route-pickup-toggle-${routeId}"]`);
    if (await pTog.count()) {
      await pTog.first().click().catch(() => {});
      await page.locator(`[data-testid="pickup-new-name-${routeId}"]`).fill('Smoke pickup').catch(() => {});
      await page.locator(`[data-testid="pickup-new-address-${routeId}"]`).fill('123 Smoke St').catch(() => {});
      await page.locator(`[data-testid="pickup-add-${routeId}"]`).click().catch(() => {});
      await page.waitForTimeout(1000);
      rec({ phase: 'E-catalog', route: '/op/routes', action: 'add pickup point (POST .../pickup-points)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'add-pickup') });
    }
  }

  return { busAId, busBId, routeId };
}

// ---- Phase F: trip lifecycle (S06/S07) -------------------------------------

async function createTrip(page: Page, routeMatch: RegExp | null, busPlate: string | null, daysAhead: number): Promise<string | null> {
  await visit(page, '/op/trips/new', 'F-trip');
  if (await page.locator('[data-testid="new-trip-prereq"]').count()) {
    rec({ phase: 'F-trip', route: '/op/trips/new', action: 'create trip', status: 'INFO', detail: 'prereq alert shown (no routes/buses) — skipped' });
    return null;
  }
  if (routeMatch) await pickSelect(page, 'new-trip-route', routeMatch);
  else await pickFirstOption(page, 'new-trip-route');
  if (busPlate) await pickSelect(page, 'new-trip-bus', new RegExp(busPlate, 'i'));
  else await pickFirstOption(page, 'new-trip-bus');
  await page.locator('[data-testid="new-trip-departure"]').fill(futureDatetimeLocal(daysAhead, 7)).catch(() => {});
  await page.locator('[data-testid="new-trip-price"]').fill('150000').catch(() => {});
  const before = (await apiGet<{ id: string }[]>(page, '/api/op/trips')) ?? [];
  const beforeIds = new Set((Array.isArray(before) ? before : (before as { trips?: { id: string }[] }).trips ?? []).map((t) => t.id));
  await page.locator('[data-testid="new-trip-submit"]').click().catch(() => {});
  await page.waitForURL(/\/op\/trips\/[^/]+$/, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  const after = (await apiGet<{ id: string }[]>(page, '/api/op/trips')) ?? [];
  const afterList = Array.isArray(after) ? after : (after as { trips?: { id: string }[] }).trips ?? [];
  const fresh = afterList.find((t) => !beforeIds.has(t.id));
  const onDetail = /\/op\/trips\/[^/]+$/.test(page.url());
  rec({ phase: 'F-trip', route: '/op/trips/new', action: 'create trip (POST /api/op/trips)', status: fresh || onDetail ? 'PASS' : 'BROKEN', detail: fresh ? `trip created (id ${fresh.id})` : onDetail ? `landed ${safePath(page.url())}` : `no new trip — alert: ${await alertText(page)}`, shot: await shoot(page, 'create-trip') });
  return fresh?.id ?? (onDetail ? page.url().split('/').pop() ?? null : null);
}

async function phaseTripLifecycle(page: Page, ctx: { busAId: string | null; busBId: string | null; routeId: string | null }) {
  CURRENT_CTX = 'trip lifecycle';
  const routeMatch = ctx.routeId ? new RegExp(SMOKE_TAG, 'i') : null;

  // Trip 1 — cancel flow.
  const t1 = await createTrip(page, routeMatch, `${SMOKE_TAG}A`, 30);
  if (t1) {
    await visit(page, `/op/trips/${t1}`, 'F-trip');
    const cancelBtn = page.locator('[data-testid="cancel-trip-btn"]');
    if (await cancelBtn.count()) {
      await cancelBtn.first().click().catch(() => {});
      await page.locator('[data-testid="cancel-reason"]').fill('Smoke test cancellation reason').catch(() => {});
      await page.locator('[data-testid="cancel-trip-confirm"]').click().catch(() => {});
      await page.waitForTimeout(1500);
      const status = (await page.locator('[data-testid="trip-status"]').textContent().catch(() => '')) ?? '';
      const cancelled = /hủy|huỷ|cancel/i.test(status);
      rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'cancel trip (POST .../cancel)', status: cancelled ? 'PASS' : 'WARN', detail: `status="${status.trim().slice(0, 40)}" — ${await alertText(page)}`, shot: await shoot(page, 'cancel-trip') });
    } else {
      rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'find cancel btn', status: 'WARN', detail: 'no cancel-trip-btn on detail' });
    }
  }

  // Trip 2 — reassign bus, then depart → complete.
  const t2 = await createTrip(page, routeMatch, `${SMOKE_TAG}A`, 31);
  if (t2) {
    await visit(page, `/op/trips/${t2}`, 'F-trip');
    // reassign to bus B
    if (ctx.busBId) {
      const ri = page.locator('[data-testid="reassign-bus-input"]');
      if (await ri.count()) {
        await ri.fill(ctx.busBId).catch(() => {});
        await page.locator('[data-testid="reassign-bus-submit"]').click().catch(() => {});
        await page.waitForTimeout(1500);
        rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'reassign bus (POST .../reassign-bus)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'reassign-bus') });
      }
    }
    // sales toggle
    const salesBtn = page.locator('[data-testid="sales-toggle-btn"]');
    if (await salesBtn.count()) {
      await salesBtn.first().click().catch(() => {});
      await page.waitForTimeout(1000);
      rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'sales toggle (POST .../sales-toggle)', status: 'PASS', detail: `clicked — ${await alertText(page)}` });
    }
    // mark departed
    const departBtn = page.locator('[data-testid="depart-trip-btn"]');
    if (await departBtn.count()) {
      await departBtn.first().click().catch(() => {});
      await page.waitForTimeout(1500);
      const status = (await page.locator('[data-testid="trip-status"]').textContent().catch(() => '')) ?? '';
      const ok = /kh[ởơ]i h[àa]nh|depart/i.test(status);
      rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'mark departed (POST .../depart)', status: ok ? 'PASS' : 'WARN', detail: `status="${status.trim().slice(0, 40)}" — ${await alertText(page)}`, shot: await shoot(page, 'mark-departed') });
    } else {
      rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'mark departed', status: 'WARN', detail: 'no depart-trip-btn (status not scheduled?)' });
    }
    // mark completed
    const completeBtn = page.locator('[data-testid="complete-trip-btn"]');
    if (await completeBtn.count()) {
      await completeBtn.first().click().catch(() => {});
      await page.waitForTimeout(1500);
      const status = (await page.locator('[data-testid="trip-status"]').textContent().catch(() => '')) ?? '';
      const ok = /ho[àa]n t[ấa]t|complete/i.test(status);
      rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'mark completed (POST .../complete)', status: ok ? 'PASS' : 'WARN', detail: `status="${status.trim().slice(0, 40)}" — ${await alertText(page)}`, shot: await shoot(page, 'mark-completed') });
    } else {
      rec({ phase: 'F-trip', route: '/op/trips/[id]', action: 'mark completed', status: 'WARN', detail: 'no complete-trip-btn (not departed yet?)' });
    }
  }
}

// ---- Phase G: deactivate created bus + route (cleanup-as-test) --------------

async function phaseDeactivate(page: Page, ctx: { busAId: string | null; busBId: string | null; routeId: string | null }) {
  CURRENT_CTX = 'deactivate';
  await visit(page, '/op/buses', 'G-deact');
  for (const id of [ctx.busAId, ctx.busBId].filter(Boolean) as string[]) {
    const btn = page.locator(`[data-testid="bus-deactivate-${id}"]`);
    if (await btn.count()) {
      await btn.first().click().catch(() => {});
      // in-DOM ConfirmDialog: confirm button labelled "Vô hiệu hoá"
      const confirm = page.getByRole('button', { name: /^vô hiệu ho[áa]$/i });
      await confirm.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      if (await confirm.count()) await confirm.first().click().catch(() => {});
      await page.waitForTimeout(1200);
      rec({ phase: 'G-deact', route: '/op/buses', action: `deactivate bus (POST .../deactivate)`, status: 'PASS', detail: `bus ${id} — ${await alertText(page)}`, shot: await shoot(page, 'deactivate-bus-' + id.slice(-4)) });
    } else {
      rec({ phase: 'G-deact', route: '/op/buses', action: 'deactivate bus', status: 'INFO', detail: `no deactivate btn for ${id} (maybe has future trips → blocked, expected)` });
    }
  }
  if (ctx.routeId) {
    await visit(page, '/op/routes', 'G-deact');
    const btn = page.locator(`[data-testid="route-deactivate-${ctx.routeId}"]`);
    if (await btn.count()) {
      await btn.first().click().catch(() => {});
      const confirm = page.getByRole('button', { name: /^vô hiệu ho[áa]$/i });
      await confirm.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      if (await confirm.count()) await confirm.first().click().catch(() => {});
      await page.waitForTimeout(1200);
      rec({ phase: 'G-deact', route: '/op/routes', action: 'deactivate route (POST .../deactivate)', status: 'PASS', detail: `route ${ctx.routeId} — ${await alertText(page)}`, shot: await shoot(page, 'deactivate-route') });
    }
  }
}

// ---- Phase H: bookings + manifest check-in/no-show (S07) --------------------

async function phaseBookingsManifest(page: Page) {
  CURRENT_CTX = 'bookings + manifest';
  await visit(page, '/op/bookings', 'H-book');
  // exercise the filter submit (no-op safe)
  const filterBtn = page.locator('[data-testid="filter-submit"]');
  if (await filterBtn.count()) {
    await filterBtn.first().click().catch(() => {});
    await page.waitForTimeout(1000);
    rec({ phase: 'H-book', route: '/op/bookings', action: 'apply filters ("Lọc")', status: 'PASS', detail: `applied — ${(await page.locator('[data-testid="booking-queue-table"]').count()) ? 'queue table present' : 'no table'}` });
  }

  // Find a trip that has bookings → open its manifest → check-in / no-show.
  const bookings = (await apiGet<unknown>(page, '/api/op/bookings')) ?? [];
  const bkArr = (Array.isArray(bookings) ? bookings : (bookings as { bookings?: unknown[] }).bookings ?? []) as { id?: string; tripId?: string; trip?: { id?: string } }[];
  const tripId = bkArr.find((b) => b.tripId || b.trip?.id)?.tripId ?? bkArr.find((b) => b.trip?.id)?.trip?.id ?? null;
  if (!tripId) {
    rec({ phase: 'H-book', route: '/op/manifest', action: 'check-in / no-show', status: 'INFO', detail: 'no paid bookings with a tripId in queue — manifest actions not exercised' });
    return;
  }
  await visit(page, `/op/manifest/${tripId}`, 'H-book');
  const checkin = page.locator('[data-testid^="manifest-checkin-"]');
  if (await checkin.count()) {
    await checkin.first().click().catch(() => {});
    await page.waitForTimeout(1200);
    rec({ phase: 'H-book', route: '/op/manifest/[id]', action: 'check-in passenger (POST .../check-in)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'manifest-checkin') });
  } else {
    rec({ phase: 'H-book', route: '/op/manifest/[id]', action: 'check-in', status: 'INFO', detail: 'no checkable rows (all boarded or none paid)' });
  }
  const noshow = page.locator('[data-testid^="manifest-noshow-"]');
  if (await noshow.count()) {
    await noshow.first().click().catch(() => {});
    await page.waitForTimeout(1200);
    rec({ phase: 'H-book', route: '/op/manifest/[id]', action: 'mark no-show (POST .../no-show)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'manifest-noshow') });
  }
}

// ---- Phase I: money — bank account + withdraw (S08) -------------------------

async function phaseMoney(page: Page) {
  CURRENT_CTX = 'money';
  // Bank account form lives on /op/settings
  await visit(page, '/op/settings', 'I-money');
  const bankForm = page.locator('[data-testid="bank-account-form"]');
  if (await bankForm.count()) {
    await page.locator('[data-testid="bank-name"]').fill('Vietcombank').catch(() => {});
    await page.locator('[data-testid="account-number"]').fill('0123456789').catch(() => {});
    await page.locator('[data-testid="account-holder"]').fill('SMOKE OPERATOR').catch(() => {});
    await page.locator('[data-testid="bank-account-submit"]').click().catch(() => {});
    await page.waitForTimeout(1500);
    const msg = await page.locator('[data-testid="bank-account-message"]').textContent().catch(() => '');
    rec({ phase: 'I-money', route: '/op/settings', action: 'save payout bank account (PUT /api/op/payout-account)', status: (msg ?? '').length ? 'PASS' : 'WARN', detail: `msg="${(msg ?? '').trim().slice(0, 60)}"`, shot: await shoot(page, 'bank-account') });
  } else {
    rec({ phase: 'I-money', route: '/op/settings', action: 'bank account form', status: 'BROKEN', detail: 'no bank-account-form on settings' });
  }

  // Withdraw (two-step: open → amount → confirm). May be disabled if balance < min.
  await visit(page, '/op/money', 'I-money');
  const openBtn = page.locator('[data-testid="withdraw-open"]');
  if (await openBtn.count()) {
    const disabled = await openBtn.first().isDisabled().catch(() => false);
    if (disabled) {
      rec({ phase: 'I-money', route: '/op/money', action: 'withdraw', status: 'INFO', detail: 'withdraw button disabled (balance below minimum — expected for fresh seed)' });
    } else {
      await openBtn.first().click().catch(() => {});
      await page.locator('[data-testid="withdraw-amount"]').fill('100000').catch(() => {});
      await page.locator('[data-testid="withdraw-submit"]').click().catch(() => {});
      await page.waitForTimeout(1500);
      const ok = await page.locator('[data-testid="withdraw-success"]').count();
      const err = await page.locator('[data-testid="withdraw-error"]').textContent().catch(() => '');
      rec({ phase: 'I-money', route: '/op/money', action: 'request withdrawal (POST /api/op/money/withdraw)', status: ok ? 'PASS' : 'WARN', detail: ok ? 'withdrawal accepted' : `no success — ${(err ?? '').trim().slice(0, 60)}`, shot: await shoot(page, 'withdraw') });
    }
  } else {
    rec({ phase: 'I-money', route: '/op/money', action: 'find withdraw btn', status: 'WARN', detail: 'no withdraw-open button' });
  }
}

// ---- Phase J: staff (S09) ---------------------------------------------------

async function phaseStaff(page: Page) {
  CURRENT_CTX = 'staff';
  await visit(page, '/op/staff', 'J-staff');
  const nameField = page.locator('[data-testid="new-staff-name"]');
  if (!(await nameField.count())) {
    rec({ phase: 'J-staff', route: '/op/staff', action: 'staff create form', status: 'WARN', detail: 'no create-staff form (non-admin?)' });
    return;
  }
  const staffPhone = `09012${String(Date.now()).slice(-5)}`;
  await nameField.fill('Smoke Staff').catch(() => {});
  await page.locator('[data-testid="new-staff-phone"]').fill(staffPhone).catch(() => {});
  await page.locator('[data-testid="create-staff-submit"]').click().catch(() => {});
  await page.waitForTimeout(1500);
  const msg = await page.locator('[data-testid="staff-message"]').textContent().catch(() => '');
  const staff = (await apiGet<unknown>(page, '/api/op/staff')) ?? [];
  const sArr = (Array.isArray(staff) ? staff : (staff as { staff?: unknown[] }).staff ?? []) as { id: string; displayName?: string; phone?: string }[];
  const created = sArr.find((s) => (s.phone ?? '').includes(staffPhone.slice(-5)) || s.displayName === 'Smoke Staff');
  rec({ phase: 'J-staff', route: '/op/staff', action: 'create staff (POST /api/op/staff)', status: created ? 'PASS' : 'WARN', detail: created ? `staff created (id ${created.id})` : `msg="${(msg ?? '').trim().slice(0, 60)}"`, shot: await shoot(page, 'create-staff') });

  // Disable the created staff
  if (created) {
    const disableBtn = page.locator(`[data-testid="staff-disable-${created.id}"]`);
    if (await disableBtn.count()) {
      await disableBtn.first().click().catch(() => {});
      const confirm = page.getByRole('button', { name: /^vô hiệu ho[áa]$/i });
      await confirm.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
      if (await confirm.count()) await confirm.first().click().catch(() => {});
      await page.waitForTimeout(1200);
      rec({ phase: 'J-staff', route: '/op/staff', action: 'disable staff (POST .../disable)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'disable-staff') });
    }
  }
}

// ---- Phase K: charter (S17) -------------------------------------------------

async function phaseCharter(page: Page) {
  CURRENT_CTX = 'charter';
  await visit(page, '/op/charter', 'K-charter');
  if (await page.locator('[data-testid="charter-not-approved"]').count()) {
    rec({ phase: 'K-charter', route: '/op/charter', action: 'charter access', status: 'INFO', detail: 'operator not APPROVED for charter — gated notice shown' });
    return;
  }
  const accept = page.locator('[data-testid="charter-accept"]');
  const claim = page.locator('[data-testid="charter-claim"]');
  if (await accept.count()) {
    await accept.first().click().catch(() => {});
    await page.waitForTimeout(1200);
    rec({ phase: 'K-charter', route: '/op/charter', action: 'accept assigned lead (POST .../accept)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'charter-accept') });
  } else if (await claim.count()) {
    await claim.first().click().catch(() => {});
    await page.waitForTimeout(1200);
    rec({ phase: 'K-charter', route: '/op/charter', action: 'claim pool lead (POST .../claim)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'charter-claim') });
  } else {
    rec({ phase: 'K-charter', route: '/op/charter', action: 'charter actions', status: 'INFO', detail: 'no assigned/pool leads seeded — buttons absent (empty states)' });
  }
}

// ---- Phase L: trip templates (S06) -----------------------------------------

async function phaseTemplates(page: Page, ctx: { busAId: string | null; routeId: string | null }) {
  CURRENT_CTX = 'templates';
  await visit(page, '/op/trip-templates', 'L-tmpl');
  const routeField = page.locator('[data-testid="new-template-route"]');
  if (!(await routeField.count())) {
    rec({ phase: 'L-tmpl', route: '/op/trip-templates', action: 'template form', status: 'WARN', detail: 'no create-template form' });
    return;
  }
  // route/bus are TEXT inputs (paste IDs). Use any existing ids if our created ones are gone.
  let routeId = ctx.routeId;
  let busId = ctx.busAId;
  if (!routeId) {
    const routes = (await apiGet<{ id: string }[]>(page, '/api/op/routes')) ?? [];
    routeId = (Array.isArray(routes) ? routes : (routes as { routes?: { id: string }[] }).routes ?? [])[0]?.id ?? null;
  }
  if (!busId) {
    const buses = (await apiGet<{ id: string }[]>(page, '/api/op/buses')) ?? [];
    busId = (Array.isArray(buses) ? buses : (buses as { buses?: { id: string }[] }).buses ?? [])[0]?.id ?? null;
  }
  if (!routeId || !busId) {
    rec({ phase: 'L-tmpl', route: '/op/trip-templates', action: 'create template', status: 'INFO', detail: 'no route/bus id available to fill template' });
    return;
  }
  await routeField.fill(routeId).catch(() => {});
  await page.locator('[data-testid="new-template-bus"]').fill(busId).catch(() => {});
  await page.locator('[data-testid="new-template-price"]').fill('150000').catch(() => {});
  await page.locator('[data-testid="new-template-deptime"]').fill('07:30').catch(() => {});
  await pickToday(page, '[data-testid="new-template-validfrom"]');
  await pickToday(page, '[data-testid="new-template-validuntil"]'); // required (validUntil >= validFrom)
  await page.locator('[data-testid="create-template-submit"]').click().catch(() => {});
  await page.waitForTimeout(1500);
  const msg = await page.locator('[data-testid="templates-message"]').textContent().catch(() => '');
  rec({ phase: 'L-tmpl', route: '/op/trip-templates', action: 'create template (POST /api/op/trip-templates)', status: (msg ?? '').length && !/lỗi|error/i.test(msg ?? '') ? 'PASS' : 'WARN', detail: `msg="${(msg ?? '').trim().slice(0, 60)}"`, shot: await shoot(page, 'create-template') });

  // Deactivate the newest template (uses window.confirm → auto-accept handler set globally)
  const templates = (await apiGet<{ id: string }[]>(page, '/api/op/trip-templates')) ?? [];
  const tlist = Array.isArray(templates) ? templates : (templates as { templates?: { id: string }[] }).templates ?? [];
  const newest = tlist[tlist.length - 1];
  if (newest?.id) {
    const deact = page.locator(`[data-testid="template-deactivate-${newest.id}"]`);
    if (await deact.count()) {
      await deact.first().click().catch(() => {});
      await page.waitForTimeout(1200);
      rec({ phase: 'L-tmpl', route: '/op/trip-templates', action: 'deactivate template (window.confirm)', status: 'PASS', detail: `clicked — ${await alertText(page)}`, shot: await shoot(page, 'deactivate-template') });
    }
  }
}

// ---- Phase M: profile + reports + KYB + status -----------------------------

async function phaseMisc(page: Page) {
  CURRENT_CTX = 'profile';
  await visit(page, '/op/profile', 'M-misc');
  const nameInput = page.locator('#profile-display-name');
  if (await nameInput.count()) {
    await nameInput.fill('Seed Operator Admin').catch(() => {});
    await page.getByRole('button', { name: /lưu hồ sơ/i }).click().catch(() => {});
    await page.waitForTimeout(1200);
    rec({ phase: 'M-misc', route: '/op/profile', action: 'save profile (PATCH /api/op/profile)', status: 'PASS', detail: `saved — ${await alertText(page)}`, shot: await shoot(page, 'profile-save') });
  } else {
    rec({ phase: 'M-misc', route: '/op/profile', action: 'profile form', status: 'WARN', detail: 'no #profile-display-name' });
  }

  // Reports: revenue (date pickers + apply + CSV link present)
  CURRENT_CTX = 'reports';
  await visit(page, '/op/reports/revenue', 'M-misc');
  const applyBtn = page.getByRole('button', { name: /^lọc$/i });
  if (await applyBtn.count()) {
    await applyBtn.first().click().catch(() => {});
    await page.waitForTimeout(1200);
    rec({ phase: 'M-misc', route: '/op/reports/revenue', action: 'apply revenue filter', status: 'PASS', detail: 'applied' });
  }
  const csv = page.getByRole('link', { name: /tải csv/i });
  rec({ phase: 'M-misc', route: '/op/reports/revenue', action: 'CSV export link', status: (await csv.count()) ? 'PASS' : 'WARN', detail: (await csv.count()) ? `href present` : 'no CSV link' });

  await visit(page, '/op/reports/overview', 'M-misc');
  const applyOverview = page.getByRole('button', { name: /áp dụng/i });
  if (await applyOverview.count()) {
    await applyOverview.first().click().catch(() => {});
    await page.waitForTimeout(1200);
    rec({ phase: 'M-misc', route: '/op/reports/overview', action: 'apply overview filter', status: 'PASS', detail: 'applied' });
  }

  await visit(page, '/op/reports/payouts', 'M-misc');
  const retry = page.getByRole('button', { name: /thử lại/i });
  rec({ phase: 'M-misc', route: '/op/reports/payouts', action: 'retry-payout button', status: 'INFO', detail: (await retry.count()) ? `${await retry.count()} failed payout(s) with retry` : 'no failed payouts to retry (expected)' });

  // KYB (read-only check — don't upload files in smoke)
  await visit(page, '/op/kyb', 'M-misc');
  const submitKyb = page.locator('[data-testid="kyb-submit"]');
  rec({ phase: 'M-misc', route: '/op/kyb', action: 'KYB submit button', status: (await submitKyb.count()) ? 'PASS' : 'WARN', detail: (await submitKyb.count()) ? `present (disabled=${await submitKyb.first().isDisabled().catch(() => '?')})` : 'no kyb-submit' });

  await visit(page, '/op/status', 'M-misc');
  await shoot(page, 'op-status');
}

// ---- Phase N: logout --------------------------------------------------------

async function phaseLogout(page: Page) {
  CURRENT_CTX = 'logout';
  await visit(page, '/op/dashboard', 'N-logout');
  const logoutBtn = page.getByRole('button', { name: /^đăng xuất$/i });
  if (await logoutBtn.count()) {
    await logoutBtn.first().click().catch(() => {});
    await page.waitForURL(/\/op\/login/, { timeout: 10000 }).catch(() => {});
    const out = /\/op\/login/.test(page.url());
    rec({ phase: 'N-logout', route: '/op/dashboard', action: 'logout (POST /api/op/auth/logout)', status: out ? 'PASS' : 'WARN', detail: out ? 'logged out → /op/login' : `at ${safePath(page.url())}`, shot: await shoot(page, 'logout') });
    // Re-gate check
    await visit(page, '/op/dashboard', 'N-logout');
    const reGated = /\/op\/login/.test(page.url());
    rec({ phase: 'N-logout', route: '/op/dashboard', action: 'console re-gated after logout', status: reGated ? 'PASS' : 'BROKEN', detail: reGated ? 'redirected to login' : `still at ${safePath(page.url())}` });
  } else {
    rec({ phase: 'N-logout', route: '/op/dashboard', action: 'find logout btn', status: 'BROKEN', detail: 'no "Đăng xuất" button in nav' });
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

async function main() {
  // Preflight: server up?
  const probe = await fetch(`${ORIGIN}/op/login`).catch(() => null);
  if (!probe || !probe.ok) {
    console.error(`Preflight FAILED: ${ORIGIN}/op/login not answering. Is dev up on ${BASE}?`);
    process.exit(1);
  }
  console.log(`Preflight OK: ${ORIGIN}/op/login reachable. Crawling operator side ...`);

  // pg pre-reset (re-arm first-login gate + restore password).
  const resetOk = await preReset();
  if (!resetOk) {
    console.error('pg pre-reset failed — see report. Aborting before browser.');
    writeReport();
    process.exit(1);
  }

  const browser: Browser = await chromium.launch({ headless: true });
  try {
    CURRENT_VP = 'desktop';
    const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1366, height: 950 } });
    const page = await ctx.newPage();
    instrument(page);
    // Auto-accept native window.confirm() dialogs (pickup delete, template deactivate).
    page.on('dialog', (d) => d.accept().catch(() => {}));
    rec({ phase: 'meta', route: '-', action: 'start', status: 'INFO', detail: `desktop @ ${BASE}` });

    await step('auth-guard', () => phaseAuthGuard(page));
    const authed = await phaseLogin(page);
    if (!authed) {
      rec({ phase: 'meta', route: '-', action: 'login gate', status: 'BROKEN', detail: 'could not authenticate as operator — skipping authed phases' });
    } else {
      let catalog = { busAId: null as string | null, busBId: null as string | null, routeId: null as string | null };
      // keepAlive() before each mutation phase: the 15-min op access token would
      // otherwise expire during the long BFS crawl and 401 every subsequent POST.
      const authedStep = async (name: string, fn: () => Promise<void>) => { await keepAlive(page); await step(name, fn); };
      await step('console-crawl', () => phaseConsoleCrawl(page));
      await authedStep('detail-routes', () => phaseDetailRoutes(page));
      await authedStep('catalog', async () => { catalog = await phaseCatalog(page); });
      await authedStep('trip-lifecycle', () => phaseTripLifecycle(page, catalog));
      await authedStep('bookings-manifest', () => phaseBookingsManifest(page));
      await authedStep('money', () => phaseMoney(page));
      await authedStep('staff', () => phaseStaff(page));
      await authedStep('charter', () => phaseCharter(page));
      await authedStep('templates', () => phaseTemplates(page, catalog));
      await authedStep('misc', () => phaseMisc(page));
      await authedStep('deactivate', () => phaseDeactivate(page, catalog));
      await authedStep('logout', () => phaseLogout(page));
    }

    await ctx.close();
  } finally {
    await browser.close();
  }
  writeReport();
}

// ---- report -----------------------------------------------------------------

const STORIES: { group: string; text: string; phase: string }[] = [
  { group: 'S05 Onboarding', text: 'Operator login + forced first-login password change', phase: 'B-login' },
  { group: 'S05 Onboarding', text: 'Auth-guard: console blocked when logged out / after logout', phase: 'A-guard' },
  { group: 'S05 Onboarding', text: 'Application status + KYB upload page reachable', phase: 'M-misc' },
  { group: 'S06 Catalog', text: 'Create bus + maintenance window', phase: 'E-catalog' },
  { group: 'S06 Catalog', text: 'Create route + pickup point', phase: 'E-catalog' },
  { group: 'S06 Catalog', text: 'Create trip → reassign bus → sales toggle', phase: 'F-trip' },
  { group: 'S06 Catalog', text: 'Cancel trip / mark departed / mark completed', phase: 'F-trip' },
  { group: 'S06 Catalog', text: 'Deactivate bus / deactivate route', phase: 'G-deact' },
  { group: 'S06 Catalog', text: 'Recurring trip template create + deactivate', phase: 'L-tmpl' },
  { group: 'S07 Bookings', text: 'Bookings queue + filters', phase: 'H-book' },
  { group: 'S07 Bookings', text: 'Manifest check-in / no-show', phase: 'H-book' },
  { group: 'S08 Money', text: 'Register payout bank account', phase: 'I-money' },
  { group: 'S08 Money', text: 'Request withdrawal / balance + ledger', phase: 'I-money' },
  { group: 'S09 Dashboard', text: 'Every console route loads (BFS crawl)', phase: 'C-crawl' },
  { group: 'S09 Dashboard', text: 'Detail routes (bus/trip/booking/manifest)', phase: 'D-detail' },
  { group: 'S09 Dashboard', text: 'Staff create + disable', phase: 'J-staff' },
  { group: 'S09 Dashboard', text: 'Profile + reports (revenue/overview/payouts)', phase: 'M-misc' },
  { group: 'S09 Dashboard', text: 'Logout', phase: 'N-logout' },
  { group: 'S17 Charter', text: 'Charter tab: assigned / pool / accept / claim', phase: 'K-charter' },
];

function storyResult(phase: string): string {
  const hits = findings.filter((f) => f.phase.startsWith(phase));
  if (!hits.length) return '⬜ not exercised';
  if (hits.some((f) => f.status === 'BROKEN')) return '🟥 BROKEN';
  if (hits.some((f) => f.status === 'WARN')) return '🟧 WARN';
  if (hits.every((f) => f.status === 'INFO')) return '⬜ info-only (no data)';
  return '🟩 PASS';
}

function writeReport() {
  const broken = findings.filter((f) => f.status === 'BROKEN');
  const warn = findings.filter((f) => f.status === 'WARN');
  const pass = findings.filter((f) => f.status === 'PASS');
  const info = findings.filter((f) => f.status === 'INFO');
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const row = (f: Finding) => `| ${f.status} | ${f.phase} | ${esc(f.route)} | ${esc(f.action)} | ${esc(f.detail)}${f.shot ? ` ([shot](operator-smoke-shots/${f.shot}))` : ''} |`;

  let md = `# Operator-side smoke crawl — ${TODAY}

Target: \`${BASE}\` · Driver: standalone Playwright (\`scripts/smoke/operator-crawl.mts\`) · Viewport: desktop 1366×950.
Mode: **full mutating + destructive** (creates throwaway buses/routes/trips it then cancels/deactivates). Acts as the seed operator admin (\`${SEED_PHONE_E164}\`); forced first-login password change is driven through the real UI. A pg pre-reset re-arms the first-login gate and restores the password each run.

> ⚠️ This run DIRTIED the dev DB (created + destroyed rows; changed the operator password to \`${NEW_PASSWORD}\`, then the next run's pre-reset restores it). Run \`pnpm db:seed\` for a clean slate before a fresh comparison.

## Summary

| Result | Count |
|---|---|
| 🟥 BROKEN | ${broken.length} |
| 🟧 WARN | ${warn.length} |
| 🟩 PASS | ${pass.length} |
| ⬜ INFO | ${info.length} |
| Total checks | ${findings.length} |

`;
  md += `## Story coverage matrix\n\nEach operator story (rebuild-plan S05–S09, S17) → the phase that exercises it → worst result.\n\n| Story | Phase | Result |\n|---|---|---|\n`;
  for (const s of STORIES) md += `| **${s.group}** — ${esc(s.text)} | \`${s.phase}\` | ${storyResult(s.phase)} |\n`;
  md += '\n';

  md += `## 🟥 Broken transitions / functions\n\n`;
  md += broken.length === 0 ? `_None detected._\n\n` : `| Sev | Phase | Route | Action | Detail |\n|---|---|---|---|---|\n${broken.map(row).join('\n')}\n\n`;
  md += `## 🟧 Warnings (degraded / needs human eyes)\n\n`;
  md += warn.length === 0 ? `_None._\n\n` : `| Sev | Phase | Route | Action | Detail |\n|---|---|---|---|---|\n${warn.map(row).join('\n')}\n\n`;

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

  md += `## Full check log\n\n| Sev | Phase | Route | Action | Detail |\n|---|---|---|---|---|\n${findings.map(row).join('\n')}\n`;

  const file = join(OUT_DIR, `operator-smoke-${TODAY}.md`);
  writeFileSync(file, md, 'utf8');
  console.log(`\n=== REPORT: ${file} ===\nBROKEN=${broken.length} WARN=${warn.length} PASS=${pass.length} INFO=${info.length} TOTAL=${findings.length}`);
}

main().catch((e) => {
  console.error('crawl crashed:', e);
  writeReport();
  process.exit(1);
});
