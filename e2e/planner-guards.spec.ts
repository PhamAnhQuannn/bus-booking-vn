// Guard suite — KHÔNG cần data KB. Khoá bề mặt chip-only #506: free-text ẩn, action-chip ẩn,
// 0 call /api/planner/chat, chip 28 city, API slug-lạ 404, SSR block. Chạy CI trần (cả 2 project).
import { test, expect } from '@playwright/test';

test.describe('planner guards (chip-only surface)', () => {
  test('G1 — free-text + action-chip ẩn (FREE_TEXT_ENABLED=false)', async ({ page }) => {
    await page.goto('/tro-ly-du-lich');
    await expect(page.getByText('Chào bạn! Chọn thành phố để bắt đầu:')).toBeVisible();
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('input[type="text"]')).toHaveCount(0);
    for (const l of ['🔄 Đổi chỗ ăn trưa', '➕ Thêm 1 ngày', '💸 Tiết kiệm hơn'])
      await expect(page.getByRole('button', { name: l })).toHaveCount(0);
  });

  test('G2 — chip thành phố (28) + "+ Chuyến mới" sau lượt đầu', async ({ page }) => {
    await page.goto('/tro-ly-du-lich');
    await expect(page.getByRole('button', { name: 'Đà Lạt', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hồ Chí Minh', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Đà Lạt', exact: true }).click();
    await expect(page.getByRole('button', { name: '+ Chuyến mới' })).toBeVisible();
  });

  test('G3 — 0 request /api/planner/chat qua luồng chip', async ({ page }) => {
    const chat: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/planner/chat')) chat.push(r.url()); });
    await page.goto('/tro-ly-du-lich');
    await page.getByRole('button', { name: 'Đà Lạt', exact: true }).click();
    await page.getByRole('button', { name: '3 ngày 2 đêm' }).click();
    await page.getByRole('button', { name: '2 người' }).click();
    await page.getByRole('button', { name: 'Bỏ qua' }).click();
    await page.waitForResponse((r) => r.url().includes('/api/planner/itinerary')).catch(() => {});
    expect(chat).toHaveLength(0);
  });

  test('G4 — API slug ngoài-28 → 404 city_unavailable', async ({ page }) => {
    const res = await page.request.get('/api/planner/itinerary?slug=sa-pa&days=3&pace=moderate');
    expect(res.status()).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'city_unavailable' });
  });

  test('G5 — SSR slug-lạ → block 200 (không 500/notFound) + link về', async ({ page }) => {
    const res = await page.goto('/lich-trinh?slug=totally-fake-city&days=3');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Chưa hỗ trợ thành phố này' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Chọn thành phố khác/ })).toHaveAttribute('href', '/tro-ly-du-lich');
  });
});
