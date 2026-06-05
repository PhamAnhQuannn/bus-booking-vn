import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/qa/hero-shots';
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:3001/';
const SEL = process.env.SEL || '#search';
const TAG = process.env.TAG || 'hero';

const browser = await chromium.launch();
try {
  for (const [name, w, h] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      reducedMotion: 'reduce', // freeze css animations so the shot is deterministic
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });
    const el = page.locator(SEL);
    await el.waitFor({ state: 'visible' });
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
    console.log(`shot: ${OUT}/${TAG}-${name}.png (${w}x${h})`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
