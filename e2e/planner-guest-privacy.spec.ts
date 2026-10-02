/**
 * E2E (#764) — guest planner privacy regression net for the #760 behaviour: a
 * signed-out visitor's chat history lives ONLY in sessionStorage (gone when the tab
 * closes), never in localStorage, and never touches the authed conversations API.
 *
 * This is the browser-level proof the unit tests (#761) cannot give — tab lifetime and
 * the storage backend are only observable in a real browser. A future refactor that moves
 * guest history back to localStorage (indefinite on a shared device) fails here, matching
 * the public privacy policy claim (s9). Runs on the LLM stub (PLANNER_LLM_STUB, ci.yml).
 */

import { test, expect, type Page } from '@playwright/test';

const PLANNER_URL = '/vi/tro-ly-du-lich';
const STORE_KEY = 'bbvn_planner_convos';

const input = (page: Page) => page.locator('[data-testid="planner-input"]:visible');
const sendBtn = (page: Page) => page.locator('[data-testid="planner-send"]:visible');

// Give each test a distinct client IP. The planner chat route throttles anonymous
// callers at 3 turns/min/IP (plannerChatAnonRatelimit), and in CI there is no Redis so
// the bucket is in-memory + process-global — every e2e request from 127.0.0.1 shares it.
// Running after planner-chat.spec.ts (which spends the 3/min budget) meant the first send
// here came back as the "gửi hơi nhanh" throttle (planner-error), not a bot reply, so
// getByTestId('planner-bot') never appeared. clientIp() honours x-forwarded-for
// (lib/core/http/clientIp.ts) and dev/CI trusts it, so a unique IP per test isolates the bucket.
let ipSeq = 0;
const nextClientIp = () => `10.13.${(ipSeq >> 8) & 0xff}.${ipSeq++ & 0xff}`;

async function gotoPlanner(page: Page) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextClientIp() });
  await page.goto(PLANNER_URL);
  await page.waitForLoadState('networkidle');
}

async function sendGuestMessage(page: Page, text: string) {
  // Retry the fill until the send button enables — WebKit can dispatch the input event
  // before React hydrates (mirrors planner-chat.spec.ts).
  await expect(async () => {
    await input(page).fill(text);
    await expect(sendBtn(page)).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await sendBtn(page).click();
  // Bot bubble appearing means the guest conversation was created + persisted.
  await expect(page.getByTestId('planner-bot').last()).toBeVisible({ timeout: 15000 });
  await page.waitForFunction((k) => !!sessionStorage.getItem(k), STORE_KEY, { timeout: 5000 });
}

test.describe('guest planner privacy (#764)', () => {
  test('guest chat is written to sessionStorage, not localStorage, and survives a reload in the same tab', async ({ page }) => {
    await gotoPlanner(page);
    await sendGuestMessage(page, 'test __noop__');

    const afterSend = await page.evaluate((k) => ({
      session: sessionStorage.getItem(k),
      local: localStorage.getItem(k),
    }), STORE_KEY);
    expect(afterSend.session).toBeTruthy();
    expect(JSON.parse(afterSend.session!).length).toBeGreaterThanOrEqual(1);
    expect(afterSend.local).toBeNull(); // NEVER localStorage

    await page.reload();
    await page.waitForLoadState('networkidle');
    const afterReload = await page.evaluate((k) => sessionStorage.getItem(k), STORE_KEY);
    expect(afterReload).toBeTruthy();
    expect(JSON.parse(afterReload!).length).toBeGreaterThanOrEqual(1);
  });

  test('a fresh tab does not see the previous tab’s guest history (session-only)', async ({ page, context }) => {
    await gotoPlanner(page);
    await sendGuestMessage(page, 'test __noop__');
    expect(await page.evaluate((k) => sessionStorage.getItem(k), STORE_KEY)).toBeTruthy();

    // A new tab in the same context = a new top-level browsing context = fresh sessionStorage,
    // exactly what "close the tab, open a new one" yields.
    const tab2 = await context.newPage();
    await tab2.goto(PLANNER_URL);
    await tab2.waitForLoadState('networkidle');
    expect(await tab2.evaluate((k) => sessionStorage.getItem(k), STORE_KEY)).toBeNull();
    await tab2.close();
  });

  test('legacy guest history left in localStorage is purged on load, not rewritten', async ({ page }) => {
    // Older builds persisted guest history in localStorage. Seed that, then load the planner:
    // conversationsClient.readLocal() removes the key (one-time migration) and never writes it back.
    await page.goto('/vi');
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify([{ id: 'legacy', title: 'old', createdAt: 1, updatedAt: 1, messages: [] }])), STORE_KEY);

    await gotoPlanner(page);
    // The purge runs inside the guest conversations mount effect (readLocal → listConversations),
    // which is gated on authStatus resolving — that can land a tick after networkidle. Poll for
    // the end-state rather than reading once, so the assertion isn't racing the effect.
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), STORE_KEY), { timeout: 10000 })
      .toBeNull(); // purged, not rewritten
  });

  test('the authed conversations API rejects a guest with 401 on GET/POST/DELETE', async ({ request }) => {
    await request.get('/'); // prime bb_csrf for the non-safe methods
    const { cookies } = await request.storageState();
    const csrf = cookies.find((c) => c.name === 'bb_csrf')?.value ?? '';

    expect((await request.get('/api/planner/conversations')).status()).toBe(401);
    expect((await request.post('/api/planner/conversations', {
      data: { title: 'x', messages: [] },
      headers: { 'X-CSRF-Token': csrf },
    })).status()).toBe(401);
    expect((await request.delete('/api/planner/conversations', {
      headers: { 'X-CSRF-Token': csrf },
    })).status()).toBe(401);
  });

  test('network-guard: a guest chat never calls the conversations API', async ({ page }) => {
    const convoCalls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/planner/conversations')) convoCalls.push(`${r.method()} ${r.url()}`);
    });

    await gotoPlanner(page);
    await sendGuestMessage(page, 'test __noop__');

    expect(convoCalls, `guest must not hit the conversations API; saw: ${convoCalls.join(', ')}`).toEqual([]);
  });
});
