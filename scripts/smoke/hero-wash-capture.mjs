// Capture what the mobile wash measurement needs: the bare photograph under the
// hero, plus the real bounding box and computed colour of every text element
// that sits directly on it.
//
// Analysis is done in wash-solve.py -- this repo has no sharp/pngjs, so pixel
// work happens in Python.

import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const URL = 'http://localhost:3001/';
const OUT = process.argv[2] || '.';
const WIDTH = Number(process.argv[3] || 390);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: 844 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const targets = await page.evaluate(() => {
  // The badge and the search card carry their own backgrounds, so they are not
  // gated by the wash. These three sit directly on the photograph.
  const pick = [
    ['h1 line 1', 'section#search h1 span:nth-child(1)'],
    ['h1 line 2', 'section#search h1 span:nth-child(2)'],
    ['subcopy', 'section#search p'],
  ];
  // Tailwind v4 resolves text colours to lab()/oklab(), which no amount of
  // string parsing turns into sRGB correctly. Paint each one onto a canvas and
  // read the pixel back, so the numbers are exactly what the browser displays.
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const toRGBA = (css) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = css;
    cx.globalAlpha = 1;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };

  const out = [];
  for (const [name, sel] of pick) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push({
      name, selector: sel, color: cs.color, rgba: toRGBA(cs.color),
      fontSize: parseFloat(cs.fontSize), fontWeight: cs.fontWeight,
      x: r.x, y: r.y, w: r.width, h: r.height,
    });
  }
  return out;
});

const heroBox = await page.locator('section#search').boundingBox();

// Screenshot WITH everything on, for the before/after image.
writeFileSync(`${OUT}/wash-with.png`, await page.locator('section#search').screenshot());

// Plate 2: every overlay ON but the text itself hidden. This is the ACTUAL
// composited background each glyph sits on, so contrast can be measured on the
// real render instead of re-derived from a single-alpha model -- which no longer
// describes the page now that a local scrim composites with the wash.
await page.evaluate((sels) => {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el) el.style.visibility = 'hidden';
  }
}, targets.map((t) => t.selector));
await page.waitForTimeout(250);
writeFileSync(`${OUT}/wash-bg.png`, await page.locator('section#search').screenshot());
await page.evaluate((sels) => {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el) el.style.visibility = '';
  }
}, targets.map((t) => t.selector));

// Hide every non-photo overlay so we sample the bare photograph.
const hidden = await page.evaluate(() => {
  const layers = document.querySelectorAll('section#search > div[aria-hidden="true"]');
  let n = 0;
  for (const el of layers) {
    if (!/landing-golden/.test(getComputedStyle(el).backgroundImage)) {
      el.style.opacity = '0';
      n++;
    }
  }
  return n;
});
await page.waitForTimeout(300);
writeFileSync(`${OUT}/wash-raw.png`, await page.locator('section#search').screenshot());

writeFileSync(`${OUT}/wash-meta.json`, JSON.stringify(
  { viewport: WIDTH, dpr: 2, heroBox, targets, overlaysHidden: hidden }, null, 2));

console.log(`viewport ${WIDTH}  hero ${heroBox.width.toFixed(0)}x${heroBox.height.toFixed(0)}`);
console.log(`overlays hidden: ${hidden}`);
for (const t of targets) {
  console.log(`  ${t.name.padEnd(10)} rgba(${t.rgba.map((v, i) => i === 3 ? v.toFixed(2) : v).join(',')})  `
    + `${t.fontSize}px/${t.fontWeight}  box ${t.w.toFixed(0)}x${t.h.toFixed(0)} `
    + `at ${t.x.toFixed(0)},${t.y.toFixed(0)}`);
}
await browser.close();
