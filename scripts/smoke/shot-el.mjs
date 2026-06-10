import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  const sec = page.locator('section', { has: page.getByRole('heading', { name: 'Tuyến phổ biến' }) });
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await sec.screenshot({ path: 'docs/qa/hero-shots/popular-trips.png' });
  console.log('done');
  await ctx.close();
} finally { await browser.close(); }
