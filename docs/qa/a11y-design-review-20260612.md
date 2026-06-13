# Accessibility Design Review — Bus-Booking (All Portals)

**Date:** 2026-06-12 | **Target:** WCAG 2.2 Level AA | **Scope:** Customer, Operator, Admin portals

## Summary

| Portal | Compliance | P1 | P2 | P3 |
|--------|-----------|----|----|-----|
| Customer | **Near-compliant** | 1 (contrast) | 1 (semantic button) | 0 |
| Operator | **Compliant** | 0 | 3 (aria-invalid, fieldsets, contrast) | 2 |
| Admin | **Non-compliant** | 2 (login form) | 2 (focus ring, fieldsets) | 2 |

## P1 — Critical (WCAG Level A/AA violations)

### 1. [CONTRAST] Orange primary text on white — WCAG 1.4.3
**Scope:** Customer portal, any normal-sized text using `text-primary`
Primary color `oklch(0.646 0.222 41.116)` on white ≈ 3:1 contrast. Passes for large text (18px+ bold) but **fails 4.5:1 for normal text**.
- Affected: footer links, inline text links, any body-text-sized primary-colored element
- **Fix:** Darken primary from `oklch(0.646...)` to ~`oklch(0.58...)` for text usage, OR use a separate `text-primary-accessible` token for body text

### 2. [FORM LABELS] Admin login — missing `<label>` tags — WCAG 3.3.2
**File:** `app/admin/login/page.tsx:85-120`
All three inputs (email, password, TOTP) use `placeholder` as sole label. Screen readers cannot identify field purpose.
**Fix:** Add `<label htmlFor="admin-login-email">Email</label>` etc. for each input.

### 3. [ERROR ANNOUNCEMENT] Admin login — no `role="alert"` — WCAG 4.1.3
**File:** `app/admin/login/page.tsx:82`
Error message renders as plain `<p>` without `role="alert"` or `aria-live`. Screen readers do not announce login failures.
**Fix:** Add `role="alert"` to the error container.

## P2 — High (should fix before launch)

### 4. [SEMANTICS] Disabled date chip as `<span>` — WCAG 4.1.2
**File:** `app/(customer)/search/page.tsx:194-200`
Disabled past-date navigation renders as `<span aria-disabled="true">` instead of `<button disabled>`. Loses keyboard semantics.
**Fix:** Use `<button disabled>` with appropriate styling.

### 5. [FORM ERRORS] Missing `aria-invalid` on operator forms — WCAG 3.3.1
**Scope:** `app/op/login/page.tsx`, `BankAccountForm.tsx`, trip/bus/route creation forms
Inputs do not set `aria-invalid="true"` on validation failure. Errors displayed in Alert container but not associated with specific fields via `aria-describedby`.
**Fix:** Add `aria-invalid={!!error}` and `aria-describedby="field-error"` to inputs on error.

### 6. [FOCUS] Admin login button — no focus ring — WCAG 2.4.7
**File:** `app/admin/login/page.tsx:104,121`
Submit buttons use raw Tailwind classes without `focus-visible:ring-*`. Browser default focus indicator may be invisible on some themes.
**Fix:** Add `focus-visible:ring-3 focus-visible:ring-ring/50`.

### 7. [STRUCTURE] Trip creation form — no fieldsets — WCAG 1.3.1
**File:** `app/op/(console)/trips/new/NewTripClient.tsx`
Large form with logically grouped fields (route+bus, departure+price, pickup areas) lacks `<fieldset><legend>` grouping.

### 8. [CONTRAST] CSS variable colors need manual testing — WCAG 1.4.3
All portals use CSS custom properties for text colors. Actual contrast ratios cannot be verified from code alone. Requires runtime testing with axe-core/Lighthouse.

## P3 — Low (address when convenient)

### 9. Admin nav aria-label in English ("Admin console") while rest of UI is Vietnamese
### 10. Operator forms display errors in Alert container only, not inline per-field
### 11. DataTable lacks `aria-sort` (acceptable — no sorting UI exists yet)
### 12. Skip-link wording in operator portal could be clearer

## Strengths

### Customer Portal — Excellent
- All landmarks correct (`<header>`, `<main>`, `<nav>`, `<aside>`, `<footer>`)
- Forms fully labeled with `htmlFor`, `aria-required`, `aria-describedby` for errors
- `<fieldset>` + `<legend>` for pickup selection group
- All animations guarded with `motion-safe:` or `@media (prefers-reduced-motion)`
- Touch targets ≥ 44px (min-h-11) on all interactive elements
- `<html lang="vi">` declared, locale-aware date formatting
- `aria-live="polite"` on hold timer, result count, total price
- Roving tabindex on calendar (`tabIndex={iso === tabDate ? 0 : -1}`)
- Focus management on conditional reveal (custom pickup input)
- Decorative images/icons all `aria-hidden="true"`
- JSON-LD structured data uses `dangerouslySetInnerHTML` safely (no user HTML)

### Operator Portal — Strong
- `<nav aria-label="Bảng điều khiển">` with `aria-current="page"` on active links
- Skip-to-content link present and functional
- DataTable uses semantic `<table>`, `<thead>`, `<th>`, `<caption class="sr-only">`
- Mobile card view uses `<dl>`/`<dt>`/`<dd>` semantics
- `aria-expanded` on expandable rows
- `aria-live="polite"` for pagination/loading announcements
- Collapsed sidebar uses `<span class="sr-only">` for icon labels
- Badge count announced via `aria-label`
- Dialog focus trap via base-ui primitives

### Admin Portal — Adequate (except login)
- Console layout has skip link, `<main id="admin-main">`
- Navigation uses `aria-current` on active tabs
- Approval page uses semantic `<nav>` with status filter
- Toast notifications use base-ui ARIA live regions

## Pre-Launch Checklist

- [ ] Fix P1: Admin login labels + error announcement
- [ ] Fix P1: Verify orange text contrast; darken for body text if needed
- [ ] Fix P2: Add `aria-invalid` to operator forms
- [ ] Fix P2: Admin login focus rings
- [ ] Run axe-core scan on all 3 portals (Lighthouse a11y audit)
- [ ] Screen reader test: NVDA on admin login + operator booking queue
- [ ] Keyboard-only test: complete a booking flow without mouse
