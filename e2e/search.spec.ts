/**
 * Playwright E2E tests for the trip search flow.
 *
 * AC-4: Results page displays route origin/destination, departureAt, price (VN format),
 *       availableSeats, and operatorLegalName.
 * AC-5: Back navigation ("Tìm lại") returns to home page; form retains last search
 *       values from localStorage (searchStore).
 * AC-6: ±1-day chips are present and navigate to adjacent dates without re-entering form.
 *
 * Requires:
 *   - Next.js dev server running on http://localhost:3000 (auto-started by playwright.config.ts locally)
 *   - DATABASE_URL pointing to a seeded database
 *   - Seed data: Hà Nội → Sài Gòn trips on today+1 (TOMORROW)
 */

import { test, expect, type Page } from '@playwright/test';
import { addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Ho_Chi_Minh';

/** Format Date as YYYY-MM-DD in VN timezone */
function vnDateStr(d: Date): string {
  const vn = toZonedTime(d, TZ);
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, '0');
  const day = String(vn.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TOMORROW = vnDateStr(addDays(new Date(), 1));

/** Build search URL with known seed data for Hà Nội → Sài Gòn */
function searchUrl(date = TOMORROW, ticketCount = '1') {
  const p = new URLSearchParams({
    origin: 'Hà Nội',
    destination: 'Sài Gòn',
    date,
    ticketCount,
  });
  return `/?${p.toString()}`;
}

// ---- AC-4: Results display ----

test.describe('AC-4: Search results display', () => {
  test('shows trip cards with required fields on mobile-390', async ({ page }) => {
    await page.goto(searchUrl());
    await expect(page).toHaveURL(/\?origin=/);

    // At least one trip card should be visible (seed has tomorrow trips)
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    const first = cards.first();

    // Route origin → destination visible
    await expect(first.locator('text=Hà Nội')).toBeVisible();
    await expect(first.locator('text=Sài Gòn')).toBeVisible();

    // Operator name visible (seed: "Công ty TNHH Xe Khách Phương Bắc")
    await expect(first.getByText(/Công ty/)).toBeVisible();

    // Price formatted in VND
    await expect(first.getByText(/đ/i)).toBeVisible();

    // Seats-left badge (PTN-04: "Còn N chỗ" / "Chỉ còn N chỗ")
    await expect(first.getByText(/chỗ/)).toBeVisible();

    // Departure time visible (HH:MM, depart→arrive row — no "Khởi hành" label)
    await expect(first.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible();
  });

  test('shows "Không tìm thấy" for no results', async ({ page }) => {
    const noResultUrl = `/?${new URLSearchParams({
      origin: 'Thành Phố Không Tồn Tại',
      destination: 'Nơi Không Có Thật',
      date: TOMORROW,
      ticketCount: '1',
    }).toString()}`;

    await page.goto(noResultUrl);
    await expect(page.getByText(/Không tìm thấy chuyến xe/)).toBeVisible({ timeout: 10_000 });
  });

  test('results ordered by departure time (ascending)', async ({ page }) => {
    await page.goto(searchUrl());
    const cards = page.locator('article');
    const count = await cards.count();

    if (count > 1) {
      // Extract departure times (first HH:MM in each card's depart→arrive row) and verify ascending order
      const times: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await cards.nth(i).getByText(/\d{1,2}:\d{2}/).first().textContent();
        if (text) times.push(text);
      }
      // Verify each subsequent time is >= previous (lexicographic HH:MM sort works)
      for (let i = 1; i < times.length; i++) {
        expect(times[i] >= times[i - 1]).toBeTruthy();
      }
    }
  });
});

// ---- AC-5: Back-nav restores form state ----

test.describe('AC-5: Back navigation restores search form', () => {
  test('back link navigates to home and form retains origin/destination', async ({ page }) => {
    // Navigate to results
    await page.goto(searchUrl());
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // Click "Tìm lại" back link
    await page.getByRole('link', { name: /Tìm lại/i }).click();
    await expect(page).toHaveURL('/');

    // Form should have origin pre-filled from store
    await expect(page.getByLabel(/Điểm xuất phát/i)).toHaveValue('Hà Nội');
    await expect(page.getByLabel(/Điểm đến/i)).toHaveValue('Sài Gòn');
  });
});

// ---- AC-6: ±1-day chips ----

test.describe('AC-6: Date navigation chips', () => {
  test('results page shows "Ngày trước" and "Ngày sau" chips', async ({ page }) => {
    await page.goto(searchUrl());
    await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('link', { name: /Ngày trước/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ngày sau/i })).toBeVisible();
  });

  test('"Ngày sau" chip navigates to date+1 with same origin/destination', async ({ page }) => {
    await page.goto(searchUrl());
    await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: /Ngày sau/i }).click();

    // URL should contain the next date and same origin/destination
    const dayAfterTomorrow = vnDateStr(addDays(new Date(), 2));
    await expect(page).toHaveURL(new RegExp(`date=${dayAfterTomorrow}`));
    await expect(page).toHaveURL(/origin=H%C3%A0%20N%E1%BB%99i|origin=H%C3%A0\+N%E1%BB%99i/);
  });

  test('"Ngày trước" chip navigates to date-1 with same origin/destination', async ({ page }) => {
    await page.goto(searchUrl());
    await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: /Ngày trước/i }).click();

    const yesterday = vnDateStr(new Date()); // tomorrow - 1 = today
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}`));
  });

  test('empty state also shows ±1-day chips', async ({ page }) => {
    const noResultUrl = `/?${new URLSearchParams({
      origin: 'Không Tồn Tại',
      destination: 'Ảo',
      date: TOMORROW,
      ticketCount: '1',
    }).toString()}`;

    await page.goto(noResultUrl);
    await expect(page.getByText(/Không tìm thấy/)).toBeVisible({ timeout: 10_000 });

    // ±1 chips visible in empty state too
    const prevLink = page.getByRole('link', { name: /Tìm ngày trước/i });
    const nextLink = page.getByRole('link', { name: /Tìm ngày sau/i });
    await expect(prevLink).toBeVisible();
    await expect(nextLink).toBeVisible();
  });

  test('chip navigation preserves ticketCount in URL', async ({ page }) => {
    await page.goto(searchUrl(TOMORROW, '3'));
    await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: /Ngày sau/i }).click();
    await expect(page).toHaveURL(/ticketCount=3/);
  });
});

// ---- Mobile viewport tap-target size ----

test.describe('Mobile tap target requirements', () => {
  test('search form submit button is at least 44px tall on 390px viewport', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: /Tìm chuyến xe/i });
    await expect(button).toBeVisible({ timeout: 5_000 });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('date chips are at least 44px tall', async ({ page }) => {
    await page.goto(searchUrl());
    await expect(page.locator('article').first()).toBeVisible({ timeout: 10_000 });

    const nextChip = page.getByRole('link', { name: /Ngày sau/i });
    const box = await nextChip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
