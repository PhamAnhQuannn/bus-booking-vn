// SSR /lich-trinh qua URL-params (đúng quy tắc CLAUDE.md e2e). Cần fixture (da-lat, mong-cai).
import { test, expect } from '@playwright/test';

test.describe('planner SSR (/lich-trinh URL-params)', () => {
  test('S1 — render đúng số section ngày', async ({ page }) => {
    await page.goto('/lich-trinh?slug=da-lat&days=3&adults=2&pace=moderate');
    await expect(page.getByRole('heading', { name: /Lịch trình 3 ngày · Đà Lạt/ })).toBeVisible();
    await expect(page.locator('h2', { hasText: /^Ngày \d+/ })).toHaveCount(3);
  });

  test('S2 — doctrine: KHÔNG ★/giá/giờ HH:MM', async ({ page }) => {
    await page.goto('/lich-trinh?slug=da-lat&days=3');
    const main = page.locator('main');
    await expect(main).not.toContainText('★');
    await expect(main.getByText(/\d[\d.,]*\s?(đ|₫|VNĐ)\b/)).toHaveCount(0);
    await expect(main.getByText(/\b\d{1,2}:\d{2}\b/)).toHaveCount(0);
  });

  test('S3 — provenance hiện (nguồn + cập nhật)', async ({ page }) => {
    await page.goto('/lich-trinh?slug=da-lat&days=3');
    await expect(page.getByText(/nguồn: \d+/).first()).toBeVisible();
    await expect(page.getByText(/cập nhật/).first()).toBeVisible();
  });

  test('S4 — header-honesty: số ngày header = số section thực (city mỏng)', async ({ page }) => {
    await page.goto('/lich-trinh?slug=mong-cai&days=7&pace=packed');
    const sections = await page.locator('h2', { hasText: /^Ngày \d+/ }).count();
    const h1 = await page.getByRole('heading', { level: 1 }).innerText();
    const headerN = Number(h1.match(/Lịch trình (\d+) ngày/)?.[1]);
    expect(headerN).toBe(sections); // sau fix lich-trinh:43 dùng it.days.length -> khớp
  });
});
