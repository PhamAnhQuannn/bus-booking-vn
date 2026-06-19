> ← [Previous](../03a-frontend-design-system/) | [Index](../README.md) | [Next →](../04-networking/)

### 3.7 Accessibility Architecture

Section 2.7 sets the **targets** (WCAG 2.2 Level AA, 44×44px touch targets, 4.5:1 contrast). This section explains **how** accessibility is implemented — the patterns, ARIA attributes, and testing approach.

#### Document-Level Baseline

Every page starts with:
- `<html lang="vi">` — screen readers use Vietnamese pronunciation rules
- **Skip-link**: Hidden link "Chuyển đến nội dung chính" that becomes visible on focus, jumps to `<main id="main">` — allows keyboard users to bypass repeated navigation
- **Landmarks**: `<header>` (site header), `<nav aria-label="...">` (navigation), `<main>` (primary content), `<footer>` (site footer) — screen readers can jump between landmarks
- **Unique `<title>`**: Every page has a descriptive title (e.g., "Tìm chuyến xe — BBVN") — distinguishes tabs and is the first thing a screen reader announces

#### Focus Management

- **Focus ring**: `focus-visible:ring-3` on all interactive elements — a visible ring that appears only on keyboard focus (not mouse click). Ring token chosen for ≥3:1 contrast ratio against backgrounds.
- **Focus trap**: Dialog and Drawer components trap focus inside — Tab cycles between elements within the overlay, preventing focus from escaping to obscured content behind it. Esc closes.
- **Focus restoration**: When a Dialog closes, focus returns to the element that opened it.
- **Keyboard navigation**: Every action reachable via Tab (forward) / Shift+Tab (backward) / Enter or Space (activate) / Esc (close/cancel). Arrow keys for RadioGroup, Select options, and Tab panels.

#### ARIA Patterns

**ARIA** (Accessible Rich Internet Applications) attributes provide semantic meaning to custom UI that native HTML elements don't cover.

| Pattern | ARIA | Where |
|---------|------|-------|
| Field errors | `role="alert"`, `aria-describedby` linking input→error | Every form field |
| Form banners | `role="alert"` (assertive) | Server-returned errors above submit button |
| Toasts | `role="status"` (polite) | Success messages, "Đã lưu" confirmations |
| Hold countdown | `role="timer"` | Booking review page (Section 13.2 step 4) |
| Data table headers | `<th scope="col">`, `aria-sort="ascending|descending|none"` | Operator tables (fleet, trips, bookings) |
| Row expanders | `aria-expanded="true|false"` | Maintenance windows, pickup points |
| Navigation | `<nav aria-label="Bảng điều khiển">`, `aria-current="page"` | Operator sidebar |
| Step indicator | `aria-label="Bước 2 trên 3"` | Registration wizard |
| Password meter | `aria-live="polite"` (text description) | Register + change password forms |
| OTP input | `inputmode="numeric"`, `autocomplete="one-time-code"` | Register step 2, forgot-password step 2 |
| Toggle/switch | `role="switch"`, `aria-checked` (NOT `role="checkbox"`) | `salesClosed` toggle on trip management |
| Tabs panel | Roving tabindex (Arrow Left/Right, Home/End), automatic activation (selection-follows-focus) | Staff dashboard, reports |
| Card regions | Card is NOT a landmark — callers add `<section aria-labelledby>` when a Card needs region semantics | Dashboard tiles, report summaries |

#### Live-Region Collision Policy

The app has 5 distinct live-region channels. The rule: **never fire `aria-live="assertive"` on more than one region simultaneously** (screen readers can only read one assertive announcement at a time — concurrent ones are dropped or garbled).

| Channel | ARIA | Priority | Example |
|---------|------|----------|---------|
| Field validation | `role="alert"` | Assertive | Inline error below a form field |
| Form banner | `role="alert"` (assertive) | Assertive | Server error above submit button |
| Toast | `role="status"` (polite) | Polite | "Đã lưu" success confirmation |
| Async poll | `role="status"` (polite) | Polite | Payment status polling updates |
| Hold timer | `role="timer"` (off until critical) → polite | Off→Polite | Countdown on booking review page |

When form submit triggers both a field error AND a banner error, only the banner fires as assertive — field errors are linked via `aria-describedby` (read when the field receives focus, not broadcast).

#### Reduced Motion — What "Non-Essential" Means

Under `prefers-reduced-motion: reduce`, **state cues are preserved**: dialog scrim (background overlay), focus ring, disabled styling all remain visible. Only **movement** is removed (slide, scale, translate animations). "Non-essential" = movement transitions, NOT visual state indicators.

#### iOS Zoom Prevention

Mobile form inputs use `text-base` (16px) at <768px, `md:text-sm` (14px) at ≥768px. Inputs below 16px trigger Safari's automatic zoom on focus — breaking the viewport for the user. The `Input` primitive owns this responsive class; do NOT override it.

#### Touch Targets & Dense Tables

**Minimum**: 44×44px on all interactive elements — buttons, links, checkboxes, radio buttons. This covers the fingertip area of most adults (per WCAG 2.5.8 Target Size).

**Dense data tables** (operator console): Row actions compressed to 44px height with icon-only buttons (tooltip on hover/focus for sighted users, `aria-label` for screen readers). Below 768px, tables collapse to stacked card layouts where each card has full-sized tap targets.

#### Color Contrast

Design tokens are pre-validated for WCAG AA compliance:
- **Normal text** (< 24px / 19px bold): 4.5:1 minimum — `foreground` on `background` ≈ 12:1 ✓
- **Large text** (≥ 24px / 19px bold): 3:1 minimum
- **Muted text** (`text-muted-foreground`): Only used on `background` or `card` fills (≈4.5:1). Never on `muted` or `accent` fills where the ratio drops below 4.5:1.
- **Status colors**: Success (green-50 bg / green-900 text), warning (amber-50 bg / amber-900 text), destructive (red) — all AA-passing pairs from Tailwind's default palette.

**Known open contrast defects** (tracked under NFR-015 "at-risk"):

| ID | Token | Computed ratio | Required | Fix guidance |
|----|-------|---------------|----------|-------------|
| F1 | `ring` (`oklch(0.708...)`) | 2.6:1 | ≥3:1 (WCAG 1.4.11 non-text contrast) | Darken ring token |
| F2 | `muted-foreground` on `muted` fill | 4.45:1 | ≥4.5:1 (fractionally below AA) | Avoid muted-on-muted body text; or darken token |
| F3 | `border-input` | 1.26:1 | ≥3:1 (WCAG 1.4.11) | Darken input border token |

**WCAG scope**: WCAG 2.2 AA applies to **both** public customer pages AND the operator console (`/op/*`). NFR-013 target is AA on all customer pages; the operator console is held to the same standard (not exempt from accessibility requirements).

#### Testing Approach

- **Automated**: axe-core scans on all customer-facing pages (catches ~57% of WCAG issues automatically — missing alt text, contrast failures, broken ARIA references)
- **Manual**: Keyboard-only navigation test (can you complete every flow without a mouse?), screen reader spot-check (VoiceOver on Mac, NVDA on Windows)
- Per-surface contracts were consolidated into this section from the former `docs/design/a11y-*.md` files (site-wide baseline, customer booking, auth, account, operator console)
