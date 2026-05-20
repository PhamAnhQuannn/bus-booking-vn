---
feature: typography-hierarchy
decision: single sans type scale (Tailwind defaults) + mono for codes; muted-on-background rule (F2)
last-updated: 2026-05-20
status: ready-to-build
inherits: docs/design/design-system.md
resolves: design-system.md "No formal type scale doc — defer to /typography-hierarchy-spec"
---

# Typography Hierarchy Spec — Bus-Booking VN

Resolves the deferred type-scale flag in `design-system.md`. Gates all text styling in the
operator-console normalization (and later auth/account/customer). No new tokens, no custom font
sizes — uses Tailwind's default size scale + the `--font-sans` / `--font-mono` tokens already in
`globals.css`. This doc fixes WHICH size maps to WHICH role so surfaces stop ad-hoc picking.

## Fonts (already wired)

| Token | Source | Applied | Use |
|-------|--------|---------|-----|
| `--font-sans` | Geist Sans | `html` in `@layer base` (`font-sans`) | all UI text |
| `--font-mono` | `--font-geist-mono` | `font-mono` per-element | trip IDs, `bookingRef`, plate, raw phone in tables |
| `--font-heading` | aliases `--font-sans` | headings | no separate display face Phase A |

No second typeface. Headings are weight/size differentiated, not face differentiated.

## Type Scale

Tailwind defaults only. `leading` defaults unless noted. Weight via `font-*`.

| Role | Class | px / line | Weight | Element | Notes |
|------|-------|-----------|--------|---------|-------|
| Page title (h1) | `text-2xl font-bold` | 24 / 32 | 700 | `<h1>` | one per page; top of `<main>` |
| Section (h2) | `text-lg font-semibold` | 18 / 28 | 600 | `<h2>` | Card section, account-settings region |
| Subsection (h3) | `text-base font-semibold` | 16 / 24 | 600 | `<h3>` | CardTitle default; nested groups |
| Minor head (h4) | `text-sm font-semibold` | 14 / 20 | 600 | `<h4>` | dense panel/label-group head |
| Body | `text-base` | 16 / 24 | 400 | `<p>`/cell | default reading text; **mobile form inputs stay ≥16px to avoid iOS zoom** |
| Body dense | `text-sm` | 14 / 20 | 400 | table cells, form help | desktop tables, metadata rows |
| Meta / caption | `text-sm text-muted-foreground` | 14 / 20 | 400 | `<CardDescription>`, timestamps | F2 rule below |
| Micro | `text-xs` | 12 / 16 | 400/500 | badge text, flag chip labels, table `<caption>` sr-only | never below 12px |
| Code / ref | `font-mono text-sm` | 14 | 400/500 | `bookingRef`, `tripId` prefix, plate | tabular alignment for IDs |

Input/Button primitives already pin their own sizes (`Input` `text-base md:text-sm`, Button per
size variant) — do NOT override with scale classes; the primitive owns its text size.

## F2 Contrast Rule (mandatory)

`text-muted-foreground` (oklch 0.556 ≈ 4.45:1 on white) is borderline. **Secondary/muted text
renders ONLY on `background` or `card` fill — NEVER muted-on-muted** (`text-muted-foreground` on
`bg-muted`/`bg-secondary`/`bg-accent` fails AA). Inside a filled chip/badge/banner, use that
surface's own `*-foreground` token, not `muted-foreground`. Table header text sits on
`background` (not a muted fill) for the same reason (see `data-table-design.md` sticky-header note).

## Weight & Style Rules

- Emphasis = `font-semibold`/`font-bold`, never italic for UI emphasis (italic reserved for true
  citation, none Phase A).
- Status meaning is carried by Badge text + token color together — never weight-only or
  color-only (WCAG 1.4.1).
- No `text-transform: uppercase` on Vietnamese copy (diacritics legibility); labels are
  sentence-case VN.
- Numeric currency/columns: right-align in tables; `font-mono` optional for column alignment but
  body sans is acceptable since VND has no decimals.

## Heading Outline Discipline

- Exactly one `<h1>` per page (the page title band).
- `CardTitle` accepts `as` (`h2|h3|h4`, default `h3`) — caller picks the level that keeps the
  document outline monotonic (no skipped levels). Account-settings section cards = `h2`; mobile
  data-table record cards = `h3` under the page `h2`/`h1`. (Contract from `dashboard-layout.md`.)
- Visual size is decoupled from level: a `h2` may render `text-lg` — pick the LEVEL for structure,
  the CLASS for size.

## Out of Scope
- Display/marketing type, fluid `clamp()` scales, custom line-height tokens.
- A second typeface or variable-font axis tuning.
