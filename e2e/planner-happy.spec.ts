// Happy-path chip flow — cần fixture (da-lat). Chip → dựng lịch → TripReceipt; header=tab; Xuất-PDF→SSR.
import { test, expect } from '@playwright/test';

async function buildDaLat3(page: import('@playwright/test').Page) {
  await page.goto('/tro-ly-du-lich');
  await page.getByRole('button', { name: 'Đà Lạt', exact: true }).click();
  await page.getByRole('button', { name: '3 ngày 2 đêm' }).click();
  await page.getByRole('button', { name: '2 người' }).click();
  await page.getByRole('button', { name: 'Bỏ qua' }).click();
  await expect(page.getByText('Đây là lịch trình gợi ý cho bạn 👇')).toBeVisible({ timeout: 15_000 });
}

test.describe('planner happy path (chip)', () => {
  test('H1 — chip flow dựng lịch → TripReceipt', async ({ page }) => {
    await buildDaLat3(page);
    await expect(page.getByText(/Lịch trình Đà Lạt · 3 ngày/)).toBeVisible();
  });

  test('H2 — header chat = 3 tab ngày (tripDays=days.length)', async ({ page }) => {
    await buildDaLat3(page);
    await expect(page.locator('button', { hasText: /^N\d+$/ })).toHaveCount(3);
  });

  test('H3 — Xuất PDF href → SSR khớp', async ({ page }) => {
    await buildDaLat3(page);
    const pdf = page.getByRole('link', { name: '📄 Xuất PDF' });
    await expect(pdf).toHaveAttribute('href', /^\/lich-trinh\?slug=da-lat/);
    await pdf.click();
    await expect(page.getByRole('heading', { name: /Lịch trình 3 ngày · Đà Lạt/ })).toBeVisible();
  });
});
