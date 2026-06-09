import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const OUT = 'docs/qa/hero-shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/home-full.png`, fullPage: true });
  // close-up of the popular-trips carousel + trust strip
  await page.locator('#search').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/home-top.png` });
  console.log('done');
  await ctx.close();
} finally { await browser.close(); }
