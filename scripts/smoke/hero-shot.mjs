import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/qa/hero-shots';
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:3001/';
const SEL = process.env.SEL || '#search';
const TAG = process.env.TAG || 'hero';

const browser = await chromium.launch();
try {
  // One entry per BREAKPOINT, not per convenient screen size. The old pair
  // (1280, 390) exercised only the lg and mobile layers; md (768-1023) and 3xl
  // (>=1920) have their own crop, their own asset and their own bg-position, and
  // neither was ever captured. DPR is per-row because the mobile deficit is
  // worst at 3x, while a 3xl shot at 2x would be a 7680px screenshot.
  const SHOTS = [
    ['mobile', 390, 844, 3],
    ['mobile-2x', 390, 844, 2],
    ['md', 900, 800, 2],
    ['lg', 1280, 900, 2],
    ['lg-wide', 1440, 900, 2],
    ['3xl', 1920, 1000, 1],
  ];
  for (const [name, w, h, dpr] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: dpr,
      reducedMotion: 'reduce', // freeze css animations so the shot is deterministic
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    const el = page.locator(SEL);
    await el.waitFor({ state: 'visible' });
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
    // Report which hero asset the browser actually chose. The layers use
    // image-set() density descriptors, so the file fetched depends on DPR as
    // well as viewport -- and a wrong pick is invisible in the screenshot.
    const chosen = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('section#search > div[aria-hidden="true"]')) {
        if (getComputedStyle(el).display === 'none') continue;
        const bi = getComputedStyle(el).backgroundImage;
        const m = bi.match(/landing-golden[a-zA-Z0-9@.-]*/g);
        if (m) out.push([...new Set(m)].join(' | '));
      }
      return out;
    });
    console.log(`shot: ${OUT}/${TAG}-${name}.png (${w}x${h} @${dpr}x)`);
    for (const c of chosen) console.log(`      layer: ${c}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
