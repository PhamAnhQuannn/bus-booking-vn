// Authed operator-console screenshots. Logs in the seed operator, completes the
// forced password change, then captures console pages. Re-seed after running.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.env.SHOT_BASE ?? 'http://localhost:3001';
const outDir = 'docs/dev/screenshots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
const page = await ctx.newPage();

const csrf = async () =>
  (await ctx.cookies()).find((c) => c.name === 'bb_csrf')?.value ?? '';

await page.goto(base + '/op/login', { waitUntil: 'networkidle' });
let res = await ctx.request.post(base + '/api/auth/login', {
  data: { scope: 'operator', phone: '0901230001', password: 'BBOp2026!' },
  headers: { 'X-CSRF-Token': await csrf() },
});
console.log('login', res.status());
res = await ctx.request.post(base + '/api/op/auth/password/change', {
  data: { currentPassword: 'BBOp2026!', newPassword: 'NewOpPass2026!' },
  headers: { 'X-CSRF-Token': await csrf() },
});
console.log('pwchange', res.status());

for (const [name, path] of [
  ['op-dashboard', '/op/dashboard'],
  ['op-buses', '/op/buses'],
  ['op-trips', '/op/trips'],
]) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const file = `${outDir}/op-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log('saved', file, '←', page.url());
}
await browser.close();
