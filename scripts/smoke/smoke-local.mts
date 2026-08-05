// smoke:local — full profile against localhost + disposable bbvn_dev. MAY include mutating
// checks (cron invocation) that are forbidden against prod (HG-B). Hard-fails if BASE_URL is
// not localhost.
import { httpAsserts } from './http-asserts.mjs';
import { headersCheck } from './headers-check.mjs';
import { cronCheck } from './cron-check.mjs';
import { operatorCrawl } from './operator-crawl.mjs';
import type { Check } from './http-asserts.mjs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

async function main() {
  const host = new URL(BASE_URL).hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    console.error(`smoke:local REFUSES non-localhost target "${host}" — use smoke:prod for remote (read-only).`);
    process.exit(2);
  }
  const checks: Check[] = [];
  checks.push(...await httpAsserts(BASE_URL));
  checks.push(...await headersCheck(BASE_URL));
  checks.push(...await cronCheck(BASE_URL, process.env.CRON_SECRET));
  checks.push(...await operatorCrawl(BASE_URL));

  let pass = 0, fail = 0, warn = 0;
  for (const c of checks) {
    const tag = c.ok ? 'PASS' : (c.optional ? 'WARN' : 'FAIL');
    if (c.ok) pass++; else if (c.optional) warn++; else fail++;
    console.log(`  ${tag}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  }
  console.log(`\nsmoke:local [${BASE_URL}] — ${pass} PASS / ${fail} FAIL / ${warn} WARN(optional) / 0 BROKEN`);
  process.exit(fail === 0 ? 0 : 1); // optional (WARN) does not fail the suite
}
main().catch((e) => { console.error('BROKEN:', e.message); process.exit(2); });
