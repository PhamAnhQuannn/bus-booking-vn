/**
 * Playwright E2E for the site header's operator-login affordance (#369 / #349).
 *
 * SiteHeader had ZERO test coverage, and the very string under test has already
 * drifted once — docs/design/mockup-home-spec.md prescribed "Đăng nhập nhà xe" while
 * master shipped the old generic label. A component whose copy has drifted before, on
 * the viewport carrying nearly all of the site's traffic, is exactly the thing that
 * needs a test rather than another careful review.
 *
 * The bug: #349's relabel renders only at xl and above. Below that the header showed an
 * icon-only, solid-orange pill whose label existed solely as aria-label — so a sighted
 * customer on a phone tapped the most prominent control in the header and landed on
 * "Đăng nhập — Quản trị viên / VD: PB-0001". These tests pin BOTH halves of the fix:
 * the trap is gone from the mobile header, and the labelled entry still exists in the
 * drawer where the operator can find it.
 *
 * Runs under both Playwright projects; each test asserts against the viewport it got,
 * because the whole defect was a breakpoint discrepancy — asserting on only one width
 * is how it shipped in the first place.
 *
 * Requires the dev server on http://localhost:3001 (auto-started by playwright.config.ts).
 */

import { test, expect } from '@playwright/test';

const OPERATOR_LOGIN_LABEL = 'Đăng nhập nhà xe';
/** Tailwind's xl. The header switches layouts here; both sides must be correct. */
const XL_BREAKPOINT = 1280;

test.describe('SiteHeader — operator login affordance', () => {
  test('below xl: the header exposes no unlabelled link into the operator console', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width >= XL_BREAKPOINT, 'desktop layout is covered by its own test');

    await page.goto('/');

    // The header itself must not offer /op/login below xl. The drawer may (and does) —
    // scope to the banner so this asserts placement, not mere absence.
    const header = page.getByRole('banner');
    await expect(header.locator('a[href="/op/login"]')).toHaveCount(0);
  });

  test('below xl: the drawer still offers operator login, with a VISIBLE label', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width >= XL_BREAKPOINT, 'drawer does not render at xl and above');

    await page.goto('/');
    await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();

    const drawerLogin = page.locator('a[href="/op/login"]').filter({
      hasText: OPERATOR_LOGIN_LABEL,
    });
    await expect(drawerLogin).toBeVisible();

    // Visible TEXT, not just an accessible name: an aria-label alone is precisely what
    // made the old mobile button a trap for sighted users.
    await expect(drawerLogin).toContainText(OPERATOR_LOGIN_LABEL);
  });

  test('at xl and above: the header CTA is present and names the operator console', async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width ?? 0;
    test.skip(width < XL_BREAKPOINT, 'mobile layout is covered by its own test');

    await page.goto('/');

    const headerLogin = page.getByRole('banner').locator('a[href="/op/login"]');
    await expect(headerLogin).toBeVisible();
    // Guards the #349 regression directly: a generic "Đăng nhập / Đăng ký" here sends
    // customers to the operator admin login.
    await expect(headerLogin).toContainText(OPERATOR_LOGIN_LABEL);
  });
});
