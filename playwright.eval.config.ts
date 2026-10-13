import { defineConfig, devices } from '@playwright/test';

// Config RIÊNG cho runner đánh giá hội thoại planner (e2e-eval/conv-sim.spec.ts). KHÔNG chạy trong CI:
// gọi LLM thật qua eval-proxy (có trần chi phí). Server local do người chạy tự bật với env eval —
// xem header của spec. Không dùng webServer để không vô tình chạy server thiếu PLANNER_EVAL_MODE.
export default defineConfig({
  testDir: './e2e-eval',
  fullyParallel: true,
  workers: Number(process.env.EVAL_WORKERS ?? 4),
  retries: 0,
  timeout: 8 * 60_000,
  reporter: [['line']],
  use: {
    baseURL: process.env.EVAL_BASE_URL || 'http://localhost:3001',
    trace: 'off',
    video: 'off',
  },
  // EVAL_DEVICE=mobile → Pixel 7 (chromium, viewport 412×915) cho đo hiệu năng/UX trên mobile.
  projects: [process.env.EVAL_DEVICE === 'mobile'
    ? { name: 'mobile', use: { ...devices['Pixel 7'] } }
    : { name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
