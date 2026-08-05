// smoke:prod — READ-ONLY profile. Imports NO cron/holds/otp checks (HG-B/HG-C).
// Safe against any target: only GET asserts + security headers + operator page-load crawl.
// Per E4, default target is local; may be pointed at a prod hostname (read-only) with care.
import { httpAsserts } from './http-asserts.mjs';
import { headersCheck } from './headers-check.mjs';
import { operatorCrawl } from './operator-crawl.mjs';
import type { Check } from './http-asserts.mjs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

async function main() {
  const checks: Check[] = [];
  checks.push(...await httpAsserts(BASE_URL));
  checks.push(...await headersCheck(BASE_URL));
  checks.push(...await operatorCrawl(BASE_URL));

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
