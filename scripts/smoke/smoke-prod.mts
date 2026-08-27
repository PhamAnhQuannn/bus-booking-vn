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

async function main() {
  const checks: Check[] = [];
  checks.push(...await httpAsserts(BASE_URL));
  checks.push(...await headersCheck(BASE_URL));
  checks.push(...await plannerCheck(BASE_URL));

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
