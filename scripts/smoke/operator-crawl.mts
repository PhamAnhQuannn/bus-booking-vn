// Operator-portal read-only crawl (Playwright). Drives the login FORM, then GET-navigates each
// console page and asserts no page 500s / throws. Navigation only — no mutations.
//
// OPTIONAL / best-effort: operator login is mandatory 2FA (username/password → SMS-OTP step) plus
// requiresPasswordChange on the seed account. A headless smoke cannot complete it without reading
// the OTP sink (OTP_PEEK). So all checks here are `optional:true` — they REPORT but never fail the
// suite. Authenticated operator-page coverage lives in e2e/*.spec.ts (which reset the seed op via
// SQL). Future: wire OTP_PEEK (GET /api/auth/otp/test-peek) to fully automate this locally.
import { chromium } from '@playwright/test';
import type { Check } from './http-asserts.mjs';

const OP_USERNAME = process.env.SMOKE_OP_USERNAME ?? 'PB-0001';
const OP_PASSWORD = process.env.SMOKE_OP_PASSWORD ?? 'BBOp2026!';
const PAGES = ['/op/dashboard', '/op/buses', '/op/routes', '/op/bookings', '/op/manifest', '/op/reports/revenue'];

export async function operatorCrawl(baseUrl: string): Promise<Check[]> {
  const out: Check[] = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: baseUrl });
  const page = await ctx.newPage();

  // Drive the real login FORM — the client CSRF helper echoes the bb_csrf cookie in X-CSRF-Token
  // (a bare API POST is rejected 403 by the double-submit guard in proxy.ts).
  await page.goto('/op/login', { waitUntil: 'domcontentloaded' });
  await page.fill('#op-login-username', OP_USERNAME);
  await page.fill('#op-login-password', OP_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith('/op/login'), { timeout: 15_000 }).catch(() => {});
  const landed = new URL(page.url()).pathname;
  const loggedIn = !landed.endsWith('/op/login');
  out.push({ name: 'operator login (optional — 2FA/OTP)', ok: loggedIn, optional: true, detail: loggedIn ? `landed=${landed}` : `blocked at ${landed} (2FA/OTP — verify via e2e)` });
  if (!loggedIn) { await browser.close(); return out; }

  for (const path of PAGES) {
    try {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const status = res?.status() ?? 0;
      out.push({ name: `GET ${path}`, ok: status > 0 && status < 500, optional: true, detail: `status=${status}` });
    } catch (e) {
      out.push({ name: `GET ${path}`, ok: false, optional: true, detail: `threw: ${(e as Error).message.slice(0, 60)}` });
    }
  }
  await browser.close();
  return out;
}
