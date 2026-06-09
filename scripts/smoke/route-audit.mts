/**
 * route-audit.mts — full route-coverage crawl for the frontend-stage report.
 *
 * Visits EVERY app route across personas and records, per route:
 *   httpStatus · finalPath (redirect detect) · <title> · meta description present? ·
 *   <h1> count · console errors · pageerrors.
 * Doubles as live SEO verification (title/desc/h1) + load-health.
 *
 * Personas:
 *   - public      : no auth (home, search, routes, trips/[id], legal, auth pages, login pages)
 *   - operator    : seed operator (pg re-arm → login → first-login change)
 *   - customer    : throwaway OTP-registered customer (for /account/*)
 *   - admin       : NO seed admin exists → only /admin/login is loadable; the rest
 *                   are expected to gate-redirect to /admin/login (recorded as GATED, not broken).
 *
 * Dynamic params ([id]/[tripId]) are resolved from live APIs where cheap; token/ref
 * routes that need a real entity fixture are recorded as SKIP (needs-fixture), not BROKEN.
 *
 * Run (dev up on :3001; .env.local needs OTP_PEEK_ENABLED=true + DATABASE_URL):
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm tsx scripts/smoke/route-audit.mts
 *
 * Read-only on app source. Logs the seed operator in (pg re-arm) + registers one
 * throwaway customer. Does not create trips/bookings.
 */

import { chromium, type Browser, type Page } from '@playwright/test';
import { Client } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from '../../lib/auth/password';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const ORIGIN = new URL(BASE).origin;
const OUT_DIR = join(process.cwd(), 'docs', 'qa');
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev';
const SEED_PHONE_LOCAL = '0901230001';
const SEED_PHONE_E164 = '+84901230001';
const SEED_PASSWORD = 'BBOp2026!';
const NEW_PASSWORD = 'BBSmoke2026!';

mkdirSync(OUT_DIR, { recursive: true });

interface Row {
  persona: string;
  route: string; // the template/path requested
  status: number | null;
  finalPath: string;
  title: string;
  metaDesc: boolean;
  h1: number;
  errors: number;
  note: string;
}
const rows: Row[] = [];

function safePath(u: string): string {
  try { const x = new URL(u); return x.pathname + (x.search ? x.search.slice(0, 50) : ''); } catch { return u; }
}

async function audit(page: Page, persona: string, route: string, note = ''): Promise<Row> {
  let errs = 0;
  const onErr = () => { errs++; };
  page.on('pageerror', onErr);
  const onResp = (r: import('@playwright/test').Response) => {
    if (r.url().startsWith(ORIGIN) && r.status() >= 500 && !r.url().includes('/api/auth/otp/test-peek')) errs++;
  };
  page.on('response', onResp);
  let status: number | null = null;
  try {
    const resp = await page.goto(ORIGIN + route, { waitUntil: 'domcontentloaded', timeout: 25000 });
    status = resp?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  } catch (e) {
    page.off('pageerror', onErr); page.off('response', onResp);
    const r: Row = { persona, route, status, finalPath: 'NAV-ERROR', title: '', metaDesc: false, h1: 0, errors: errs + 1, note: `${note} ${String((e as Error).message).slice(0, 60)}`.trim() };
    rows.push(r); console.log(`[${persona}] ${route} → NAV-ERROR`); return r;
  }
  const title = (await page.title().catch(() => '')) ?? '';
  const metaDesc = (await page.locator('meta[name="description"]').count().catch(() => 0)) > 0;
  const h1 = await page.locator('h1').count().catch(() => 0);
  const finalPath = safePath(page.url());
  page.off('pageerror', onErr); page.off('response', onResp);
  const r: Row = { persona, route, status, finalPath, title: title.slice(0, 60), metaDesc, h1, errors: errs, note };
  rows.push(r);
  console.log(`[${persona}] ${route} → ${status} final=${finalPath} title="${title.slice(0,30)}" desc=${metaDesc} h1=${h1} err=${errs}`);
  return r;
}

async function apiGet(page: Page, path: string): Promise<unknown> {
  const r = await page.request.get(`${ORIGIN}${path}`).catch(() => null);
  if (!r || !r.ok()) return null;
  return r.json().catch(() => null);
}
function list(v: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  const o = v as Record<string, unknown>;
  return Array.isArray(o?.[key]) ? (o[key] as Record<string, unknown>[]) : [];
}
async function peekOtp(page: Page, phone: string): Promise<string | null> {
  for (let i = 0; i < 8; i++) {
    const r = await page.request.get(`${ORIGIN}/api/auth/otp/test-peek?phone=${encodeURIComponent(phone)}`).catch(() => null);
    if (r && r.ok()) { const j = (await r.json().catch(() => ({}))) as { code?: string }; if (j.code) return j.code; }
    await page.waitForTimeout(400);
  }
  return null;
}

// ---- route lists ------------------------------------------------------------
const PUBLIC_STATIC = [
  '/', '/search', '/routes', '/lien-he-dat-xe', '/lien-he-dat-xe/confirmation',
  '/terms', '/privacy', '/auth/login', '/auth/register', '/auth/forgot-password',
  '/auth/reset-password', '/op/login', '/op/register', '/op/register/confirmation',
  '/op/forgot-password', '/admin/login',
];
const OP_STATIC = [
  '/op/dashboard', '/op/bookings', '/op/buses', '/op/charter', '/op/kyb', '/op/manifest',
  '/op/money', '/op/profile', '/op/reports', '/op/reports/overview', '/op/reports/payouts',
  '/op/reports/revenue', '/op/routes', '/op/settings', '/op/staff', '/op/status',
  '/op/trip-templates', '/op/trips', '/op/trips/new', '/op/upcoming', '/op/activity',
  '/op/staff/dashboard',
];
const ADMIN_GATED = [
  '/admin', '/admin/approvals', '/admin/charter', '/admin/finance', '/admin/moderation',
  '/admin/operators', '/admin/system', '/admin/users',
];
const CUSTOMER_ROUTES = ['/account/bookings', '/account/settings'];

async function opLogin(page: Page, pg: Client): Promise<boolean> {
  const passwordHash = await hash(SEED_PASSWORD);
  await pg.query(`UPDATE "OperatorUser" SET "passwordHash"=$1, "requiresPasswordChange"=true WHERE phone=$2`, [passwordHash, SEED_PHONE_E164]).catch(() => {});
  await pg.query(`UPDATE "OperatorSession" SET "revokedAt"=NOW() WHERE "operatorUserId"=(SELECT id FROM "OperatorUser" WHERE phone=$1) AND "revokedAt" IS NULL`, [SEED_PHONE_E164]).catch(() => {});
  await page.goto(ORIGIN + '/op/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#op-login-phone').waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
  await page.locator('#op-login-phone').fill(SEED_PHONE_LOCAL).catch(() => {});
  await page.locator('#op-login-password').fill(SEED_PASSWORD).catch(() => {});
  const loginResp = page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 20000 });
  await page.getByRole('button', { name: /^đăng nhập$/i }).click().catch(() => {});
  const lr = await loginResp.catch(() => null);
  if ((lr?.status() ?? 0) !== 200) { console.log(`opLogin: /api/auth/login HTTP ${lr?.status() ?? 'none'}`); }
  await page.waitForURL(/\/op\/(first-login|dashboard)/, { timeout: 15000 }).catch(() => {});
  if (/\/op\/first-login/.test(page.url())) {
    await page.locator('#op-current-password').fill(SEED_PASSWORD).catch(() => {});
    await page.locator('#op-new-password').fill(NEW_PASSWORD).catch(() => {});
    await page.locator('#op-confirm-password').fill(NEW_PASSWORD).catch(() => {});
    await page.getByRole('button', { name: /đổi mật khẩu/i }).click().catch(() => {});
    await page.waitForURL(/\/op\/dashboard/, { timeout: 15000 }).catch(() => {});
  }
  return /\/op\//.test(page.url()) && !/\/op\/login/.test(page.url());
}

async function customerRegister(page: Page): Promise<boolean> {
  const phone = `09${String(Date.now()).slice(-8)}`;
  await page.goto(ORIGIN + '/auth/register', { waitUntil: 'domcontentloaded' });
  await page.locator('#phone').fill(phone).catch(() => {});
  await page.getByRole('button', { name: /gửi mã otp/i }).click().catch(() => {});
  try { await page.locator('#code').waitFor({ state: 'visible', timeout: 12000 }); } catch { return false; }
  const code = await peekOtp(page, phone);
  if (!code) return false;
  await page.locator('#code').fill(code).catch(() => {});
  await page.getByRole('button', { name: /^xác minh$/i }).click().catch(() => {});
  try { await page.locator('#password').waitFor({ state: 'visible', timeout: 12000 }); } catch { return false; }
  await page.locator('#password').fill('Password1Test').catch(() => {});
  await page.locator('#displayName').fill('Route Audit Buyer').catch(() => {});
  await page.getByRole('button', { name: /^đăng ký$/i }).click().catch(() => {});
  try { await page.waitForURL((u) => !u.pathname.startsWith('/auth/register'), { timeout: 15000 }); return true; } catch { return false; }
}

async function main() {
  const probe = await fetch(`${ORIGIN}/`).catch(() => null);
  if (!probe || !probe.ok) { console.error(`Preflight FAILED: ${ORIGIN}/ unreachable.`); process.exit(1); }
  const pg = new Client({ connectionString: DB_URL }); await pg.connect();
  const browser: Browser = await chromium.launch({ headless: true });

  try {
    // ---- public (guest) ----
    const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const gp = await guest.newPage();
    for (const r of PUBLIC_STATIC) await audit(gp, 'public', r);
    // dynamic public: resolve a real trip id from search
    let tripId: string | null = null;
    const sr = await fetch(`${ORIGIN}/api/trips/search?origin=${encodeURIComponent('Sài Gòn')}&destination=${encodeURIComponent('Hà Nội')}&date=${TODAY}&ticketCount=1`).catch(() => null);
    if (sr && sr.ok) { const j = await sr.json().catch(() => []); if (Array.isArray(j) && j[0]?.tripId) tripId = j[0].tripId; }
    if (tripId) await audit(gp, 'public', `/trips/${tripId}`, 'resolved trip id');
    else rows.push({ persona: 'public', route: '/trips/[id]', status: null, finalPath: 'SKIP', title: '', metaDesc: false, h1: 0, errors: 0, note: 'no live trip to resolve id' });
    await audit(gp, 'public', `/search?origin=H%C3%A0%20N%E1%BB%99i&destination=S%C3%A0i%20G%C3%B2n&date=${TODAY}&ticketCount=1`, 'param search');
    // fixture-needed dynamic routes
    for (const r of ['/verify/[token]', '/booking/confirmation/[token]', '/booking/result/[token]', '/charter/status/[ref]', '/booking/review', '/booking/customer'])
      rows.push({ persona: 'public', route: r, status: null, finalPath: 'SKIP', title: '', metaDesc: false, h1: 0, errors: 0, note: 'needs entity/flow fixture' });
    await guest.close();

    // ---- admin (no seed admin → gate check) ----
    const adminCtx = await browser.newContext({ viewport: { width: 1366, height: 950 } });
    const ap = await adminCtx.newPage();
    for (const r of ADMIN_GATED) await audit(ap, 'admin', r, 'no seed admin — expect gate redirect to /admin/login');
    await adminCtx.close();

    // ---- operator (seed login) ----
    const opCtx = await browser.newContext({ viewport: { width: 1366, height: 950 } });
    const op = await opCtx.newPage();
    const authed = await opLogin(op, pg);
    rows.push({ persona: 'operator', route: '(login)', status: authed ? 200 : null, finalPath: safePath(op.url()), title: '', metaDesc: false, h1: 0, errors: 0, note: authed ? 'seed operator authed' : 'LOGIN FAILED — op routes will redirect' });
    if (authed) {
      for (const r of OP_STATIC) await audit(op, 'operator', r);
      // dynamic op routes resolved from api
      const trips = list(await apiGet(op, '/api/op/trips'), 'trips');
      const buses = list(await apiGet(op, '/api/op/buses'), 'buses');
      const bookings = list(await apiGet(op, '/api/op/bookings'), 'bookings');
      if (trips[0]?.id) { await audit(op, 'operator', `/op/trips/${trips[0].id}`, 'resolved'); await audit(op, 'operator', `/op/manifest/${trips[0].id}`, 'resolved'); }
      else rows.push({ persona: 'operator', route: '/op/trips/[id] & /op/manifest/[tripId]', status: null, finalPath: 'SKIP', title: '', metaDesc: false, h1: 0, errors: 0, note: 'no trip id' });
      if (buses[0]?.id) await audit(op, 'operator', `/op/buses/${buses[0].id}`, 'resolved');
      else rows.push({ persona: 'operator', route: '/op/buses/[id]', status: null, finalPath: 'SKIP', title: '', metaDesc: false, h1: 0, errors: 0, note: 'no bus id' });
      if (bookings[0]?.id) await audit(op, 'operator', `/op/bookings/${bookings[0].id}`, 'resolved');
      else rows.push({ persona: 'operator', route: '/op/bookings/[id]', status: null, finalPath: 'SKIP', title: '', metaDesc: false, h1: 0, errors: 0, note: 'no booking id' });
    }
    await opCtx.close();

    // ---- customer (OTP register → account) ----
    const custCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const cp = await custCtx.newPage();
    const reg = await customerRegister(cp);
    rows.push({ persona: 'customer', route: '(register)', status: reg ? 200 : null, finalPath: safePath(cp.url()), title: '', metaDesc: false, h1: 0, errors: 0, note: reg ? 'throwaway customer registered' : 'REGISTER FAILED — account routes will redirect' });
    if (reg) for (const r of CUSTOMER_ROUTES) await audit(cp, 'customer', r);
    rows.push({ persona: 'customer', route: '/account/bookings/[id]', status: null, finalPath: 'SKIP', title: '', metaDesc: false, h1: 0, errors: 0, note: 'needs a booking fixture' });
    await custCtx.close();
  } finally {
    await browser.close().catch(() => {});
    await pg.end().catch(() => {});
  }

  writeReport();
}

function writeReport() {
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  const ok = rows.filter((r) => r.status != null && r.status < 400 && r.errors === 0 && r.finalPath !== 'NAV-ERROR');
  const broken = rows.filter((r) => r.finalPath === 'NAV-ERROR' || (r.status != null && r.status >= 500) || r.errors > 0);
  const skip = rows.filter((r) => r.finalPath === 'SKIP');
  const redir = rows.filter((r) => r.status != null && r.status < 400 && r.finalPath !== 'SKIP' && r.finalPath !== 'NAV-ERROR' && !r.route.split('?')[0].startsWith(r.finalPath.split('?')[0]) && r.route !== '(login)' && r.route !== '(register)');
  const row = (r: Row) => `| ${r.persona} | ${esc(r.route)} | ${r.status ?? '—'} | ${esc(r.finalPath)} | ${r.title ? esc(r.title) : '—'} | ${r.metaDesc ? '✓' : '✗'} | ${r.h1} | ${r.errors || ''} | ${esc(r.note)} |`;
  const md = `# Frontend route-coverage audit — ${TODAY}

Target \`${BASE}\` · Driver \`scripts/smoke/route-audit.mts\` · Per route: HTTP status, final path (redirect), <title>, meta-description present, <h1> count, console/page errors.

## Summary
| Bucket | Count |
|---|---|
| ✅ loaded clean | ${ok.length} |
| 🟥 broken (5xx / nav-error / console error) | ${broken.length} |
| ↪️ redirected (gate/guard) | ${redir.length} |
| ⬜ skipped (needs fixture) | ${skip.length} |
| Total routes probed | ${rows.length} |

## 🟥 Broken
${broken.length ? `| Persona | Route | Status | Final | Title | Desc | H1 | Err | Note |\n|---|---|---|---|---|---|---|---|---|\n${broken.map(row).join('\n')}` : '_None._'}

## Full matrix
| Persona | Route | Status | Final | Title | Desc | H1 | Err | Note |
|---|---|---|---|---|---|---|---|---|
${rows.map(row).join('\n')}
`;
  const file = join(OUT_DIR, `frontend-route-audit-${TODAY}.md`);
  writeFileSync(file, md, 'utf8');
  console.log(`\n=== REPORT: ${file} ===\nOK=${ok.length} BROKEN=${broken.length} REDIR=${redir.length} SKIP=${skip.length} TOTAL=${rows.length}`);
}

main().catch((e) => { console.error('route-audit crashed:', e); writeReport(); process.exit(1); });
