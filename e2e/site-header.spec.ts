/**
 * Playwright E2E for the site header's login affordance.
 *
 * ADR-021 un-gate: customer email+password auth is live, so the header's primary
 * login CTA now points customers at THEIR login (`/auth/login`, "Đăng nhập / Đăng ký"),
 * not the operator console. Operator login stays reachable via the footer's "Hợp tác"
 * column. These tests pin both halves against a viewport-specific layout (the header
 * switches at xl), since the copy under test has drifted before.
 *
 * All tests run in the GUEST state (no session) — SessionBootstrap fires a refresh on
 * load which 401s for a guest, so the header shows the login CTA, not the account menu.
 *
 * Requires the dev server on http://localhost:3001 (auto-started by playwright.config.ts).
 */

import { test, expect } from '@playwright/test';

const CUSTOMER_LOGIN_LABEL = 'Đăng nhập / Đăng ký';
const OPERATOR_LOGIN_LABEL = 'Đăng nhập nhà xe';
/** Tailwind's xl. The header switches layouts here; both sides must be correct. */
const XL_BREAKPOINT = 1280;

test.describe('SiteHeader — login affordance (ADR-021)', () => {
  test('at xl and above: the header CTA is the CUSTOMER login', async ({ page }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width < XL_BREAKPOINT, 'mobile layout is covered by its own test');

    await page.goto('/');

    const header = page.getByRole('banner');
    const headerLogin = header.locator('a[href="/auth/login"]');
    await expect(headerLogin).toBeVisible();
    await expect(headerLogin).toContainText(CUSTOMER_LOGIN_LABEL);

    // The header must NOT send a customer to the operator admin console (the #349 trap).
    await expect(header.locator('a[href="/op/login"]:visible')).toHaveCount(0);
  });

  test('below xl: the drawer offers the CUSTOMER login with a visible label', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width >= XL_BREAKPOINT, 'drawer does not render at xl and above');

    await page.goto('/');
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
    // header CTA belongs to customers — pin it as load-bearing, not incidental.
    const footerLogin = page.getByRole('contentinfo').locator('a[href="/op/login"]');
    await expect(footerLogin).toBeVisible();
    await expect(footerLogin).toContainText(OPERATOR_LOGIN_LABEL);
  });
});
