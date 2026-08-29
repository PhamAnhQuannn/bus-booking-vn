/**
 * Playwright E2E for the site header's login affordance.
 *
 * Navbar redesign: the header's guest auth is TWO buttons — "Đăng nhập" → /auth/login and
 * "Đăng ký" → /auth/register (customer signup, ADR-021). NEITHER points at /op/* (the #349
 * trap). "Nhà xe" nav item removed; operators reach their console via the footer's "Hợp tác"
 * column. These tests pin both halves against a viewport-specific layout (header switches at xl).
 *
 * All tests run in the GUEST state (no session) — SessionBootstrap fires a refresh on
 * load which 401s for a guest, so the header shows the login CTA, not the account menu.
 *
 * Requires the dev server on http://localhost:3001 (auto-started by playwright.config.ts).
 */

import { test, expect } from '@playwright/test';

const OPERATOR_LOGIN_LABEL = 'Đăng nhập nhà xe';
/** Tailwind's xl. The header switches layouts here; both sides must be correct. */
const XL_BREAKPOINT = 1280;

test.describe('SiteHeader — guest auth (navbar redesign)', () => {
  test('at xl and above: header has Đăng nhập → /auth/login + Đăng ký → /auth/register', async ({ page }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width < XL_BREAKPOINT, 'mobile layout is covered by its own test');

    await page.goto('/');

    const header = page.getByRole('banner');
    const login = header.locator('a[href="/auth/login"]:visible');
    const signup = header.locator('a[href="/auth/register"]:visible');
    await expect(login).toBeVisible();
    await expect(login).toContainText('Đăng nhập');
    await expect(signup).toBeVisible();
    await expect(signup).toContainText('Đăng ký');

    // NEITHER auth button points at the operator console (#349 trap). "Nhà xe" removed.
    await expect(header.locator('a[href^="/op"]:visible')).toHaveCount(0);
  });

  test('below xl: drawer offers Đăng nhập + Đăng ký, no operator link', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width >= XL_BREAKPOINT, 'drawer does not render at xl and above');

    await page.goto('/');
    await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('a[href="/auth/login"]')).toBeVisible();
    await expect(dialog.locator('a[href="/auth/register"]')).toBeVisible();
    await expect(dialog.locator('a[href^="/op"]:visible')).toHaveCount(0);
  });

  test('operator login stays reachable via the footer', async ({ page }) => {
    await page.goto('/');

    // Operators reach their console from the footer's "Hợp tác" column now that the
    // header CTA belongs to customers — pin it as load-bearing, not incidental.
    const footerLogin = page.getByRole('contentinfo').locator('a[href="/op/login"]');
    await expect(footerLogin).toBeVisible();
    await expect(footerLogin).toContainText(OPERATOR_LOGIN_LABEL);
  });
});
