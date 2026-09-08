// smoke:prod — ALERT-ONLY post-deploy profile. Read-only EXCEPT one minimal planner-chat liveness
// POST (plannerCheck #2): it drives a single /api/planner/chat turn (1 Gemini call + a little
// rate-limit budget) so a getEnv/env-config or upstream break — invisible to /api/health and the
// itinerary GET, which never call getEnv() — is caught. Still imports NO cron/holds/otp and NO
// operator-crawl (that one does a login POST → OTP/lockout). Safe to run against a real prod hostname.
import { httpAsserts } from './http-asserts.mjs';
import { headersCheck } from './headers-check.mjs';
import { plannerCheck } from './planner-check.mjs';
import type { Check } from './http-asserts.mjs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

// #684: the smoke runs against the deployment's per-build `environment_url` (a `*.vercel.app` URL),
// which Vercel Deployment Protection (SSO) gates — every fetch is 302→vercel.com/sso-api. Because
// fetch() follows redirects, the SSO LOGIN page returns 200 and SPOOFS "homepage/health 200" as PASS
// while JSON routes hard-401 — a misleading 8-PASS/5-FAIL that hides "the app was never reached".
// Detect protection up-front (manual redirect) and fail LOUDLY + actionably instead. We do NOT disable
// protection; if the owner sets VERCEL_AUTOMATION_BYPASS_SECRET the checks send it as a bypass header.
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const EXTRA_HEADERS: Record<string, string> = BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};

// A genuine SSO/protection signal (kind:'protection') gets the actionable Deployment-Protection
// remediation. A preflight fetch THROW — DNS fail / connection refused / timeout, i.e. a real
// app/edge outage — is a DIFFERENT problem (kind:'unreachable'); mislabeling it as a protection
// config issue misdirects on-call. Both still exit 2 so the run alerts.
type Wall = { kind: 'protection' | 'unreachable'; detail: string };

async function protectionWall(baseUrl: string): Promise<Wall | null> {
  try {
    const r = await fetch(baseUrl, { redirect: 'manual', headers: EXTRA_HEADERS });
    const loc = r.headers.get('location') ?? '';
    const setCookie = r.headers.get('set-cookie') ?? '';
    if ((r.status >= 300 && r.status < 400 && /vercel\.com\/sso|\/sso-api/i.test(loc)) || /_vercel_sso_nonce/i.test(setCookie))
      return { kind: 'protection', detail: `HTTP ${r.status}${loc ? ` → ${loc.split('?')[0]}` : ''}` };
    return null;
  } catch (e) {
    return { kind: 'unreachable', detail: (e as Error).message };
  }
}

async function main() {
  const wall = await protectionWall(BASE_URL);
  if (wall?.kind === 'protection') {
    console.error(`BLOCKED: Vercel Deployment Protection is gating ${BASE_URL} (${wall.detail}).`);
    console.error('The app was never reached — no assertion below would be meaningful. Fix ONE of:');
    console.error('  1. Vercel → Settings → Deployment Protection: exclude Production (or "Only Preview").');
    console.error('  2. Trusted Sources: allow the CI caller development → production.');
    console.error('  3. Generate a Protection Bypass for Automation secret and set the GH Actions secret');
    console.error('     VERCEL_AUTOMATION_BYPASS_SECRET (this script forwards it as x-vercel-protection-bypass).');
    process.exit(2);
  }
  if (wall?.kind === 'unreachable') {
    console.error(`UNREACHABLE: preflight fetch to ${BASE_URL} failed (${wall.detail}).`);
    console.error('The app/edge could not be reached — DNS failure, connection refused, or timeout.');
    console.error('This is a network/deployment outage, NOT a Deployment Protection config issue.');
    console.error('Check: the deployment finished and is serving, the hostname/DNS resolves, and the edge is up.');
    process.exit(2);
  }
  const checks: Check[] = [];
  checks.push(...await httpAsserts(BASE_URL, EXTRA_HEADERS));
  checks.push(...await headersCheck(BASE_URL, EXTRA_HEADERS));
  checks.push(...await plannerCheck(BASE_URL, EXTRA_HEADERS));

  let pass = 0, fail = 0, warn = 0;
  for (const c of checks) {
    const tag = c.ok ? 'PASS' : (c.optional ? 'WARN' : 'FAIL');
    if (c.ok) pass++; else if (c.optional) warn++; else fail++;
    console.log(`  ${tag}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  }
  console.log(`\nsmoke:prod [${BASE_URL}] — ${pass} PASS / ${fail} FAIL / ${warn} WARN(optional) / 0 BROKEN`);
  process.exit(fail === 0 ? 0 : 1); // optional (WARN) does not fail the suite
}
main().catch((e) => { console.error('BROKEN:', e.message); process.exit(2); });
