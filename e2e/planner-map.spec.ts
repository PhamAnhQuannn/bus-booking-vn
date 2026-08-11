// Map (Leaflet + PMTiles) — chromium desktop only (map inline `hidden lg:flex` >=1024). Cần fixture.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });
test.skip(({ browserName }) => browserName !== 'chromium', 'map inline chỉ desktop chromium');

async function buildDaLat3(page: import('@playwright/test').Page) {
  await page.goto('/tro-ly-du-lich');
  await page.getByRole('button', { name: 'Đà Lạt', exact: true }).click();
  await page.getByRole('button', { name: '3 ngày 2 đêm' }).click();
  await page.getByRole('button', { name: '2 người' }).click();
  await page.getByRole('button', { name: 'Bỏ qua' }).click();
  await expect(page.getByText('Đây là lịch trình gợi ý cho bạn 👇')).toBeVisible({ timeout: 15_000 });
}

test.describe('planner map', () => {
  test('M1 — Leaflet render + có pin', async ({ page }) => {
    await buildDaLat3(page);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.pm-pin').first()).toBeVisible();
    expect(await page.locator('.pm-pin').count()).toBeGreaterThan(0);
  });

  test('M2 — click pin → bottom-sheet "Nguồn"', async ({ page }) => {
    await buildDaLat3(page);
    await page.locator('.pm-pin[data-order="1"]').click();
    await expect(page.getByText('Nguồn', { exact: true })).toBeVisible();
  });

  test('M3 — DayTabBar đổi ngày → aria-pressed + pin còn', async ({ page }) => {
    await buildDaLat3(page);
    const d2 = page.getByRole('button', { name: 'Ngày 2', exact: true });
    await d2.click();
    await expect(d2).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.locator('.pm-pin').count()).toBeGreaterThan(0);
  });

  test('M4 — tile 404 không crash (map + pin còn, 0 pageerror)', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.route('**/api/planner/tiles*', (r) => r.fulfill({ status: 404, body: '' }));
    await buildDaLat3(page);
    await expect(page.locator('.pm-pin').first()).toBeVisible();
    expect(errs).toEqual([]);
  });
});
