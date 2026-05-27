// Throwaway dev screenshot helper. Usage: node scripts/dev/shot.mjs <label>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const label = process.argv[2] ?? 'shot';
const base = process.env.SHOT_BASE ?? 'http://localhost:3001';
const outDir = 'docs/dev/screenshots';
mkdirSync(outDir, { recursive: true });

const pages = [
  ['home', '/'],
  ['auth-login', '/auth/login'],
  ['account-settings', '/account/settings'],
  ['search-results', '/search?origin=H%C3%A0%20N%E1%BB%99i&destination=TP.HCM&date=2026-05-27&ticketCount=1'],
  ['op-login', '/op/login'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
for (const [name, path] of pages) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const file = `${outDir}/${label}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file);
}
await browser.close();
