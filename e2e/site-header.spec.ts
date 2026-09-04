/**
 * Playwright E2E for the site header's login affordance.
 *
 * ADR-021 un-gate: customer email+password auth is live. Per the navbar redesign
 * (#669) the single combined CTA was split into two customer buttons — "Đăng nhập"
 * (`/auth/login`) and "Đăng ký" (`/auth/register`) — neither pointing at the operator
 * console. Operator login stays reachable via the footer's "Hợp tác" column. These
 * tests pin the layout against a viewport-specific split (the header switches at md):
 * at md+ both CTAs sit inline in the bar; below md the "Đăng ký" CTA stays in the bar
 * while "Đăng nhập" moves into the drawer.
 *
 * All tests run in the GUEST state (no session) — SessionBootstrap fires a refresh on
 * load which 401s for a guest, so the header shows the login CTAs, not the account menu.
 *
 * Requires the dev server on http://localhost:3001 (auto-started by playwright.config.ts).
 */

import { test, expect } from '@playwright/test';

const CUSTOMER_LOGIN_LABEL = 'Đăng nhập';
const CUSTOMER_REGISTER_LABEL = 'Đăng ký';
const OPERATOR_LOGIN_LABEL = 'Đăng nhập nhà xe';
/** Tailwind's md. The header switches layouts here; both sides must be correct. */
const MD_BREAKPOINT = 768;

test.describe('SiteHeader — login affordance (ADR-021)', () => {
  test('at md and above: the header CTAs are the CUSTOMER login + register', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width < MD_BREAKPOINT, 'mobile layout is covered by its own test');

    await page.goto('/');

    const header = page.getByRole('banner');
    const headerLogin = header.locator('a[href="/auth/login"]:visible');
    await expect(headerLogin).toBeVisible();
    await expect(headerLogin).toContainText(CUSTOMER_LOGIN_LABEL);

    const headerRegister = header.locator('a[href="/auth/register"]:visible');
    await expect(headerRegister).toBeVisible();
    await expect(headerRegister).toContainText(CUSTOMER_REGISTER_LABEL);

    // The header must NOT send a customer to the operator admin console (the #349 trap).
    await expect(header.locator('a[href="/op/login"]:visible')).toHaveCount(0);
  });

  test('below md: the register CTA stays in the bar and the drawer offers login', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width >= MD_BREAKPOINT, 'drawer does not render at md and above');

    await page.goto('/');

    // The "Đăng ký" CTA sits inline in the bar itself at mobile (guests), not the drawer.
    const header = page.getByRole('banner');
    const headerRegister = header.locator('a[href="/auth/register"]:visible');
    await expect(headerRegister).toBeVisible();
    await expect(headerRegister).toContainText(CUSTOMER_REGISTER_LABEL);

    // "Đăng nhập" moved into the drawer.
    await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();

    const drawerLogin = page.getByRole('dialog').locator('a[href="/auth/login"]');
    await expect(drawerLogin).toBeVisible();
    await expect(drawerLogin).toContainText(CUSTOMER_LOGIN_LABEL);

    // The drawer must not offer the operator console CTA either (moved to the footer).
    await expect(page.getByRole('dialog').locator('a[href="/op/login"]:visible')).toHaveCount(0);
  });

  test('operator login stays reachable via the footer', async ({ page }) => {
    await page.goto('/');

    // Operators reach their console from the footer's "Hợp tác" column now that the
    // header CTAs belong to customers — pin it as load-bearing, not incidental.
    const footerLogin = page.getByRole('contentinfo').locator('a[href="/op/login"]');
    await expect(footerLogin).toBeVisible();
    await expect(footerLogin).toContainText(OPERATOR_LOGIN_LABEL);
  });
});
