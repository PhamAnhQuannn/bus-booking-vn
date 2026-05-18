/**
 * E2E spec: cash-booking — end-to-end cash payment funnel
 *
 * Covers (Issue 003 acceptance criteria):
 *   - search → customer form → hold → review → cash init → confirmation page
 *   - confirmation page renders bookingRef, route, ticketCount, total, operator,
 *     and "pay on boarding" instructions for pending_cash_payment
 *   - confirmation page reachable without auth (the confirmationToken IS the
 *     access key); a fresh context with no cookies still sees the booking
 *
 * Drives search via URL state to bypass @base-ui/react Input flake (per
 * AGENTS.md Mistake Log 2026-05-17 entry on base-ui inputs).
 *
 * Prerequisites: running dev server + seeded DB with at least one trip on
 * VN-tomorrow for Hà Nội → TP.HCM.
 */

import { test, expect, type Page } from '@playwright/test';

function vnTomorrow(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const todayVN = fmt.format(new Date());
  const [y, m, d] = todayVN.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  t.setUTCDate(t.getUTCDate() + 1);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const TOMORROW = vnTomorrow();

async function gotoResults(page: Page) {
  const params = new URLSearchParams({
    origin: 'Hà Nội',
    destination: 'TP.HCM',
    date: TOMORROW,
    ticketCount: '1',
  });
  await page.goto(`/search?${params.toString()}`);
  await page.waitForLoadState('networkidle');
}

test.describe('Cash booking happy path', () => {
  test('search → customer → review → cash init → confirmation', async ({ page }) => {
    await gotoResults(page);

    const bookButtons = page.getByRole('button', { name: /đặt vé|book/i });
    const count = await bookButtons.count();
    test.skip(count === 0, 'No trips available for tomorrow — re-run prisma db seed');

    await bookButtons.first().click();
    await page.waitForURL('**/booking/customer');

    await page.getByLabel(/họ và tên|name/i).fill('Nguyen Van Cash');
    await page.getByLabel(/số điện thoại|phone/i).fill('0912345678');
    await page.getByRole('button', { name: /tiếp tục|continue/i }).click();

    await page.waitForURL('**/booking/review**');
    const confirmBtn = page.getByRole('button', { name: /xác nhận thanh toán/i });
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();

    await confirmBtn.click();

    await page.waitForURL('**/booking/confirmation/**', { timeout: 15_000 });

    await expect(page.getByText(/Đặt vé thành công/i)).toBeVisible();

    await expect(page.getByText(/BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}/)).toBeVisible();

    await expect(page.getByText(/Chờ thanh toán tiền mặt/i)).toBeVisible();

    await expect(page.getByText('Hà Nội')).toBeVisible();
    await expect(page.getByText('TP.HCM')).toBeVisible();

    await expect(page.getByText(/đ/).first()).toBeVisible();

    await expect(page.getByText('Nguyen Van Cash')).toBeVisible();
    await expect(page.getByText('0912345678')).toBeVisible();

    await expect(
      page.getByText(/Thanh toán tiền mặt khi lên xe/i)
    ).toBeVisible();
  });

  test('confirmation token is the access key — fresh context (no cookies) can view the booking', async ({
    browser,
    page,
  }) => {
    await gotoResults(page);
    const bookButtons = page.getByRole('button', { name: /đặt vé|book/i });
    const count = await bookButtons.count();
    test.skip(count === 0, 'No trips available for tomorrow — re-run prisma db seed');

    await bookButtons.first().click();
    await page.waitForURL('**/booking/customer');
    await page.getByLabel(/họ và tên|name/i).fill('Nguyen Van Token');
    await page.getByLabel(/số điện thoại|phone/i).fill('0912345678');
    await page.getByRole('button', { name: /tiếp tục|continue/i }).click();
    await page.waitForURL('**/booking/review**');
    await page.getByRole('button', { name: /xác nhận thanh toán/i }).click();
    await page.waitForURL('**/booking/confirmation/**', { timeout: 15_000 });

    const confirmationUrl = page.url();
    expect(confirmationUrl).toMatch(/\/booking\/confirmation\/[A-Za-z0-9_-]{32}$/);

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto(confirmationUrl);
    await expect(freshPage.getByText(/Đặt vé thành công/i)).toBeVisible();
    await expect(freshPage.getByText(/BB-\d{4}-[0-9a-z]{4}-[0-9a-z]{4}/)).toBeVisible();
    await fresh.close();
  });
});

test.describe('Cash booking — error surfaces', () => {
  test('unknown confirmation token returns 404', async ({ page }) => {
    const fakeToken = 'A'.repeat(32);
    const res = await page.goto(`/booking/confirmation/${fakeToken}`);
    expect(res?.status()).toBe(404);
  });
});
