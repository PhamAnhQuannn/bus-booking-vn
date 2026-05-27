---
feature: global-baseline
target: WCAG 2.2 AA
last-updated: 2026-05-20
status: draft
---

# A11y Design: Global Baseline — Bus-Booking VN

The site-wide a11y contract every surface inherits. Per-surface files
(`a11y-customer-booking.md`, `a11y-auth.md`, `a11y-account.md`,
`a11y-operator-console.md`) layer keyboard/focus/screen-reader detail on top of
this. Tokens are from `docs/design/design-system.md`; primitives from
`components/ui/` (base-ui flavor).

Language: site is Vietnamese. `<html lang="vi">`. All screen-reader copy below is
the Vietnamese a SR announces — keep verbatim with the form contracts.

## Document-level

| Concern | Decision |
|---------|----------|
| Lang | `<html lang="vi">` site-wide (in `app/layout.tsx`). |
| Skip link | First focusable in `<body>`: `<a href="#main" class="sr-only focus:not-sr-only ...">Bỏ qua tới nội dung</a>`. Target `<main id="main">`. One per layout (root + operator layout), not per page. |
| Landmarks | Exactly one `<main>` per page; `<header>`, `<nav aria-label="…">`, `<footer>` as present. Operator console adds `<nav aria-label="Bảng điều hành">` (sidebar) + `<main>`. |
| Title | Each route sets a unique, descriptive `<title>` (Next metadata) in Vietnamese. |
| Reflow | No horizontal scroll at 320px / 400% zoom (WCAG 1.4.10). Booking flow + operator tables must reflow/stack, not clip. |

## Focus ring (global)

Primitives bake `focus-visible:ring-3` using token `ring`. **FINDING F1 (flag to
design-system):** `ring = oklch(0.708 0 0)` on a white background measures ≈
2.6:1 — below the 3:1 WCAG 2.2 non-text-contrast (1.4.11) / focus-appearance
floor. The 3px width helps perception but the color alone is too light.

- Recommendation (do NOT pick final color in this skill): darken light-mode `ring`
  to ≈ `oklch(0.60 0 0)` (≈ 3.95:1) or pair `ring` with `ring-offset-2
  ring-offset-background` so the ring sits against a contrasting band.
- Until resolved: every interactive element still gets a visible focus-visible
  ring; the *width* (3px) keeps it perceivable, but track F1 as an open contrast
  defect, not a pass.

## Touch targets

All interactive elements ≥ 44×44 CSS px hit area (WCAG 2.5.5 / 2.5.8 AA = 24px
min, we hold the stricter 44px from the design system).

**Caveat — Button sizes.** Button `xs`(h-6=24px), `sm`(h-7=28px), `default`(h-8=32px)
are all under 44px tall by visual height. Rule for build: any standalone tap
target (not in a dense toolbar row) uses `lg`(h-9=36px) minimum AND pads the hit
area to 44px (`min-h-11` wrapper or `py` padding) — visual size may stay small,
hit area must be 44px. Dense operator table row-actions may use `sm`/`icon-sm`
with 44px hit area via row height + padding; flag any naked `xs` control on a
primary flow.

## Color contrast (computed against oklch tokens, light mode)

Luminance for achromatic tokens computed as Y ≈ L³ (oklch lightness → WCAG
relative luminance for chroma≈0); `destructive` mapped to its sRGB equivalent
(#dc2626).

| Foreground | Background | Ratio | AA? |
|------------|------------|-------|-----|
| foreground `oklch(0.145)` | background `oklch(1)` | ≈ 19.8:1 | ✅ |
| foreground `oklch(0.145)` | card `oklch(1)` | ≈ 19.8:1 | ✅ |
| muted-foreground `oklch(0.556)` | background `oklch(1)` | ≈ 4.73:1 | ✅ normal text |
| muted-foreground `oklch(0.556)` | muted `oklch(0.97)` | ≈ 4.45:1 | ⚠ **F2** — just under 4.5:1 |
| primary-foreground `oklch(0.985)` | primary `oklch(0.205)` | ≈ 17.2:1 | ✅ |
| destructive (#dc2626) | background `oklch(1)` | ≈ 4.84:1 | ✅ normal text |
| ring `oklch(0.708)` | background `oklch(1)` | ≈ 2.6:1 | ❌ **F1** non-text |
| border / border-input `oklch(0.922)` | background `oklch(1)` | ≈ 1.26:1 | ❌ **F3** non-text |

**FINDING F2:** `muted-foreground` on a `muted`/`accent` fill (`oklch(0.97)`)
drops to ≈ 4.45:1 — fractionally under AA for normal text. Safe on white
(`background`/`card`). Build rule: do not place `text-muted-foreground` body/meta
text on a `bg-muted` / `bg-accent` / `bg-secondary` fill at normal size; either
use `text-foreground` there or keep muted text on `background`/`card` only.
Large/bold (≥18px or ≥14px bold) is fine (needs only 3:1). Flag token tweak to
design-system if muted-on-muted is required.

**FINDING F3:** `border` / `border-input` at `oklch(0.922)` is ≈ 1.26:1 on white
— below the 3:1 non-text floor when the border is the *only* indication of a
control boundary (1.4.11). Inputs are also indicated by their visible `<Label>`
and the focus ring, so a rest-state field is not unidentifiable — but the border
alone fails. Recommendation: darken `border-input` toward ≈ `oklch(0.65)` (≈
3.2:1) for form fields, or ensure every field pairs a visible label + adequate
focus indicator (we mandate both below). Track F3 as a design-system token
decision.

Status banners reuse the `booking/result` raw palette
(`amber-50/200/900`, `green-50/900`, `red-50/900`) verbatim — these are
established AA-passing tailwind pairs (900-on-50). Do not substitute the neutral
tokens for status semantics.

Dark mode: `.dark` tokens exist but no toggle ships in Phase A (design-system
open question). Contrast above is light-mode; re-run this table for `.dark` if a
toggle is added.

## Motion (`prefers-reduced-motion`)

`tw-animate-css` is imported. Every animated surface needs a reduced-motion
fallback. Global rule: wrap non-essential motion in
`motion-safe:` / `motion-reduce:` variants.

| Animation | Default | reduced-motion |
|-----------|---------|----------------|
| Button spinner (submitting) | rotate 1s loop | static spinner glyph, no spin |
| Dialog/Modal open | fade + scale 150–200ms | fade only |
| Toast slide-in | slide 250ms | fade only |
| HoldTimer pulse (≤60s) | pulse loop | no pulse — color/text change only |
| Drawer (mobile op nav) | slide 250ms | fade only |
| Skeleton shimmer | shimmer loop | static muted block |
| Optimistic reorder (routes) | position transition | instant snap, no tween |

## Live-region strategy (site-wide)

Single coherent contract so announcements don't collide:

| Channel | Role / aria-live | Used for |
|---------|------------------|----------|
| Field error | `role="alert"` (implicit assertive), rendered only when error present, `id="<field>-err"` referenced by the field's `aria-describedby` | inline format/server field validation |
| Form-level banner | `role="alert" aria-live="assertive"` | server outcomes that aren't field-specific (SOLD_OUT, rate_limited, conflict, generic) |
| Toast | `role="status" aria-live="polite"` | success confirmations + non-blocking server notices |
| Async/poll status | `aria-live="polite"` region | hold-create "Đang xử lý…", payment-result poll "Đang xác nhận…" |
| Countdown (HoldTimer) | `role="timer"`, `aria-live="off"` until ≤60s then `polite` | hold expiry |
| Reorder position | `aria-live="polite"` visually-hidden region | drag/keyboard reorder: "Đã chuyển tới vị trí N trên M" |
| Char counter | `aria-live="polite"` | reason textarea remaining-chars |

Rule: never put `aria-live="assertive"` on more than one region that can fire
simultaneously. Field errors (alert) + a banner (assertive) on the same submit:
move focus to the first error field; the banner is read once; individual field
alerts are read on focus via `aria-describedby` — not all at once.

## Missing primitives — a11y build specs

These don't exist in `components/ui/` yet (design-system lists them missing).
Each must be built a11y-correct. base-ui (`@base-ui/react`) provides accessible
headless behavior for most — prefer it over hand-rolled ARIA.

| Primitive | Base | Required a11y behavior |
|-----------|------|------------------------|
| **Label** | `<label>` | `htmlFor` → input `id`. Highest-priority build (every form needs it). Visible, never placeholder-as-label. |
| **Card** | `<section>`/`<div>` | Decorative container; if it has a heading, wrap content so the heading is the accessible name (`aria-labelledby`) when used as a region. No role unless it's a landmark. |
| **Dialog/Modal** | base-ui `Dialog` | `role="dialog" aria-modal="true"`, focus trap, focus moves to dialog (heading or first control) on open, returns to trigger on close, Esc closes (except hold-expiry forced redirect), `aria-labelledby` heading + `aria-describedby` body. Backdrop click closes (except destructive/forced). |
| **Select** | base-ui `Select` | Listbox semantics, keyboard (↑/↓/Home/End/type-ahead), `aria-expanded`, selected announced, label association. Native `<select>` acceptable fallback. Needed for route/bus/template/staff/busType selectors. |
| **RadioGroup** | base-ui `RadioGroup` | `role="radiogroup"` + `aria-labelledby` legend; arrow keys move + select; single tab stop. (Pay-method selector if MoMo branch surfaces; cash-only golden path may omit.) |
| **Checkbox** | base-ui `Checkbox` | `role="checkbox" aria-checked`; space toggles; label association. daysOfMask uses a **checkbox group** in `<fieldset><legend>Ngày trong tuần</legend>`. |
| **Toast** | base-ui `Toast` / Sonner-style | `role="status" aria-live="polite"`, not focus-stealing, dismissible, auto-dismiss pausable on hover/focus, stack readable. |
| **Skeleton** | `<div aria-hidden="true">` | Decorative only; the live region announces "Đang tải…" — skeleton itself is `aria-hidden`. |
| **Table** | `<table>` | Real `<table><thead><th scope="col">…`; row headers `scope="row"` where a cell identifies the row; `<caption>` or `aria-label` naming the table. Sortable headers: `aria-sort`. See `/data-table-design`. |
| **Badge** | `<span>` | Status badges are not color-only — include text. If purely decorative duplicate of adjacent text, `aria-hidden`. |
| **Tabs** | base-ui `Tabs` | `role="tablist"`/`tab`/`tabpanel`, arrow-key nav, `aria-selected`, `aria-controls`. (Reports revenue/payouts if tabbed.) |
| **Alert** | `<div role="alert">` | The form-level banner primitive; assertive; rendered on demand, not always-present. |

## Forms (global rules — every form file inherits)

- Visible `<Label htmlFor>` on every field; no placeholder-as-label.
- `aria-describedby="<id>-hint <id>-err"` (hint optional, err rendered only when present).
- `aria-invalid="true"` on a field with a current error.
- `aria-required="true"` on required fields + visible required indication.
- On submit-fail: focus moves to the first errored field (precedence = field
  order top-to-bottom); ≥2 errors also render a summary block linking to fields.
- Error copy is the verbatim Vietnamese in each `docs/design/forms/form-*.md` —
  do not paraphrase.

## Internationalization / SR copy

- Currency: announce "đồng" not "₫". When rendering "290.000 ₫", add
  `aria-label="290.000 đồng"` (or visually-hidden "đồng").
- Phone numbers: render grouped but the input value is raw digits; no
  text-in-images anywhere.
- Dates/times: VN locale; SR reads the human string, not ISO.

## Out of Scope

- Color-blind simulation, dyslexia font, AAA (post-launch / separate audit).
- Runtime axe-core/Lighthouse pass — that's the post-implementation audit, not
  this design contract.
- Dark-mode contrast table (no toggle in Phase A).

## Open Questions / flags to design-system

- **F1** ring contrast ≈ 2.6:1 — darken `ring` or add `ring-offset`.
- **F2** muted-foreground on muted/accent fill ≈ 4.45:1 — avoid muted-on-muted
  body text, or tweak token.
- **F3** border-input ≈ 1.26:1 — darken for form fields or rely on label + focus
  (both mandated here).
- Promote amber/green status to semantic tokens? (mirrors design-system open Q).

## Auto-chain

- F1/F2/F3 → `/design-system` token re-run (contrast fixes).
- Table surfaces → `/data-table-design`.
- Per-surface keyboard/focus detail → the four `a11y-<group>.md` files.
