/**
 * Playwright E2E — trợ lý du lịch (planner) chat, chạy trên LLM STUB (PLANNER_LLM_STUB=true).
 *
 * Xác nhận UI chat xử đúng các kịch bản stub + KHÔNG chạm upstream thật (network-guard). $0, không key:
 * geminiAdapter thấy PLANNER_LLM_STUB=true → yield SSE canned từ llmStub, KHÔNG fetch Google/Groq.
 * Sentinel trong tin user điều khiển kịch bản (llmStub.ts):
 *   __error__ → ParseIntentError → route phát 'error' SSE → bong bóng lỗi + nút "Tự chọn lịch trình".
 *   __noop__  → chỉ prose, KHÔNG action → giữ lịch, bong bóng bot có văn bản.
 *
 * PHẠM VI: chỉ tầng chat-stream KB-INDEPENDENT. KHÔNG assert itinerary/dto cuối — build gọi
 * /api/planner/itinerary cần KB data (gitignored, vắng ở CI). Sentinel dùng ở đây KHÔNG có slot đủ →
 * KHÔNG short-circuit (PR-2) và KHÔNG build → không phụ thuộc KB.
 *
 * Requires: PLANNER_LLM_STUB=true trên webServer (ci.yml e2e-tests env). NODE_ENV=development (pnpm dev)
 * nên env strict + inline isRealProduction guard KHÔNG chặn stub.
 */

import { test, expect, type Page } from '@playwright/test';

const PLANNER_URL = '/vi/tro-ly-du-lich';

// Locator ô nhập/gửi ĐANG HIỆN (composer mount 3× desktop/mobile/overlay → dùng :visible tránh strict >1).
const input = (page: Page) => page.locator('[data-testid="planner-input"]:visible');
const sendBtn = (page: Page) => page.locator('[data-testid="planner-send"]:visible');

// Route 'use client' → chờ hydrate xong trước khi fill, nếu không WebKit (mobile-390) mất input event.
async function gotoPlanner(page: Page) {
  await page.goto(PLANNER_URL);
  await page.waitForLoadState('networkidle');
}

async function sendMessage(page: Page, text: string) {
  await input(page).fill(text);
  await sendBtn(page).click();
}

test.describe('planner chat (LLM stub)', () => {
  test('__error__ → bong bóng lỗi + nút tự chọn lịch trình (đường degrade)', async ({ page }) => {
    await gotoPlanner(page);
    await sendMessage(page, 'test __error__');

    await expect(page.getByTestId('planner-error').last()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('planner-fallback').last()).toBeVisible();
  });

  test('__noop__ → prose bot, KHÔNG lỗi, giữ lịch', async ({ page }) => {
    await gotoPlanner(page);
    await sendMessage(page, 'test __noop__');

    // Stub prose canned (vi): "Đây là gợi ý cho chuyến đi của bạn."
    await expect(page.getByTestId('planner-bot').last()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('planner-bot').last()).toContainText('gợi ý');
    await expect(page.getByTestId('planner-error')).toHaveCount(0);
  });

  test('network-guard: KHÔNG chạm Groq/Google (stub short-circuit trước fetch)', async ({ page }) => {
    const upstreamHits: string[] = [];
    page.on('request', (r) => {
      if (/api\.groq\.com|generativelanguage\.googleapis\.com/.test(r.url())) upstreamHits.push(r.url());
    });

    await gotoPlanner(page);
    await sendMessage(page, 'test __noop__');
    await expect(page.getByTestId('planner-bot').last()).toBeVisible({ timeout: 15000 });

    expect(upstreamHits, `KHÔNG được gọi upstream thật khi stub bật; đã chạm: ${upstreamHits.join(', ')}`).toEqual([]);
  });
});
