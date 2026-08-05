// smoke:prod — STRICTLY READ-ONLY profile. Pure GET only, safe against ANY target incl. a real
// prod hostname. Imports NO cron/holds/otp AND NO operator-crawl: the operator crawl drives a real
// login POST (/api/auth/login) which consumes rate-limit budget, increments the PB-0001 lockout
// counter, and can dispatch an OTP — so it is localhost-only (smoke:local). This profile mutates nothing.
import { httpAsserts } from './http-asserts.mjs';
import { headersCheck } from './headers-check.mjs';
import type { Check } from './http-asserts.mjs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

async function main() {
  const checks: Check[] = [];
  checks.push(...await httpAsserts(BASE_URL));
  checks.push(...await headersCheck(BASE_URL));

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
