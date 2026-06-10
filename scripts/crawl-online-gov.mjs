import { chromium } from '@playwright/test';

const START = 'https://online.gov.vn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0 Safari/537.36';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: UA, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

let landed = '';
for (const url of [START, 'http://online.gov.vn']) {
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    landed = url;
    console.log(`LOADED ${url} → HTTP ${resp?.status()}  title="${(await page.title()).slice(0,60)}"`);
    break;
  } catch (e) {
    console.log(`FAIL goto ${url}: ${e.message.split('\n')[0]}`);
  }
}
if (!landed) { console.log('Cannot reach portal at all.'); await browser.close(); process.exit(2); }

// give JS a moment
await page.waitForTimeout(2500);

const raw = await page.$$eval('a[href]', as =>
  as.map(a => ({ text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 45), href: a.href }))
);

// dedupe + filter
const seen = new Set();
const links = [];
for (const l of raw) {
  if (!/^https?:\/\//i.test(l.href)) continue;
  if (seen.has(l.href)) continue;
  seen.add(l.href);
  links.push(l);
}
console.log(`\nCollected ${links.length} unique http(s) links from homepage.\n`);

// validate (bounded concurrency)
const CAP = Math.min(links.length, 120);
const subset = links.slice(0, CAP);
const results = [];
let i = 0;
const CONC = 5;
async function worker() {
  while (i < subset.length) {
    const idx = i++;
    const l = subset[idx];
    try {
      const r = await ctx.request.get(l.href, { timeout: 20000, maxRedirects: 5 });
      results[idx] = { status: r.status(), ...l };
    } catch (e) {
      results[idx] = { status: 'ERR', err: e.message.split('\n')[0].slice(0, 40), ...l };
    }
    await page.waitForTimeout(150); // politeness
  }
}
await Promise.all(Array.from({ length: CONC }, worker));

const ok = results.filter(r => typeof r.status === 'number' && r.status < 400);
const bad = results.filter(r => !(typeof r.status === 'number' && r.status < 400));

console.log(`=== RESULT: ${ok.length} OK, ${bad.length} BROKEN (of ${results.length} checked) ===\n`);
console.log('--- BROKEN / SUSPECT ---');
for (const r of bad) console.log(`[${r.status}${r.err ? ' '+r.err : ''}] ${r.href}  «${r.text}»`);
console.log('\n--- OK (label → url) ---');
for (const r of ok) console.log(`[${r.status}] «${r.text || '-'}» ${r.href}`);

await browser.close();
