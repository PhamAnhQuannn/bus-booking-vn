---
last-updated: 2026-05-20
tailwind: v4 (CSS-first, no tailwind.config.ts)
token-source: app/globals.css
ui-primitives: components/ui/
shadcn-flavor: base-ui (@base-ui/react)
---

# Design System — Bus-Booking VN

> **⚠️ Superseded for tokens/identity (2026-05-27).** The canonical source of truth is now
> [`design-language.md`](./design-language.md) (v1.0), which reconciles this doc with the
> as-built UI ([`baseline-built-ui-20260527.md`](./baseline-built-ui-20260527.md)) and the OTA
> benchmark. Where this doc and the design language disagree, the design language wins.
> This file remains a detailed primitive/variant reference.

## Standard (the resolved decision)

**Tailwind utility classes + semantic tokens. NO inline `style={{}}`.**

Normalization complete (2026-05-26): every page under `app/**` is now tailwind +
token clean — `grep "style={{" app/` returns zero matches. The last inline-style
surfaces (`app/auth/**`, `app/account/**`, and the `app/op/.../buses` server page)
were migrated onto the tokens + primitives below. Inline `style={{}}` is the
divergence to keep out, not a second supported path.

## Token Model

Tailwind v4 CSS-first. Tokens are CSS custom properties (oklch) defined in
`app/globals.css` — `:root` (light) + `.dark` (dark). The `@theme inline { ... }`
block maps each `--<token>` to a Tailwind color/radius utility
(`--color-primary: var(--primary)` → `bg-primary` / `text-primary`). Full shadcn
neutral set is already present. **There is no `tailwind.config.ts` — token edits
happen in `globals.css` only.**

### Color Tokens

Grayscale-neutral palette (chroma ≈ 0 except `destructive`). Reference via the
Tailwind class — never raw oklch/hex in JSX.

| Token | Light | Dark | Tailwind class | Use |
|-------|-------|------|----------------|-----|
| background | `oklch(1 0 0)` | `oklch(0.145 0 0)` | `bg-background` | page background |
| foreground | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | `text-foreground` | body text |
| card | `oklch(1 0 0)` | `oklch(0.205 0 0)` | `bg-card text-card-foreground` | grouped surfaces |
| popover | `oklch(1 0 0)` | `oklch(0.205 0 0)` | `bg-popover` | overlays, menus |
| primary | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | `bg-primary text-primary-foreground` | primary CTA |
| secondary | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-secondary` | secondary button/surface |
| muted | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-muted` | subtle fill |
| muted-foreground | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | `text-muted-foreground` | metadata, labels |
| accent | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | `bg-accent` | hover/active fill |
| destructive | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | `bg-destructive` / `text-destructive` | errors, destructive |
| border | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | `border` | dividers, outlines |
| input | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | `border-input` | form field borders |
| ring | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | `ring-ring` | focus ring |
| chart-1..5 | grayscale ramp | grayscale ramp | `fill-chart-N` | report charts (payouts/revenue) |
| sidebar* | see globals.css | see globals.css | `bg-sidebar*` | operator nav shell (if adopted) |

**Status colors (RESOLVED 2026-05-20):** semantic `success` / `warning` tokens now
exist in `globals.css`, each a triplet — `--success`/`--success-foreground`/`--success-border`
and `--warning`/`--warning-foreground`/`--warning-border`. oklch values were chosen to
match Tailwind `green-50/900/200` and `amber-50/900/200` so the existing raw-palette
banners migrate pixel-equivalent. Reference via classes: `bg-success text-success-foreground
border-success-border` (success/info banner), `bg-warning text-warning-foreground
border-warning-border` (pending/warning), and the existing `bg-destructive/10 text-destructive`
for failure. **This supersedes the prior "use the result-page raw palette verbatim" rule** —
new code uses the tokens; `app/booking/result/[token]` + `confirmation` + `review` +
`CustomerForm` migrate off raw `bg-amber-*`/`bg-green-*` in Phase 6.

### Spacing

Tailwind default 4px base. No half-steps. Common: `1`(4) `2`(8) `3`(12) `4`(16)
`6`(24) `8`(32) `12`(48).

### Typography

Font: `--font-sans` (applied to `html` in `@layer base`); `--font-mono`
(`--font-geist-mono`) for refs/codes (`font-mono` on `bookingRef`). `--font-heading`
aliases sans. No formal type scale doc — defer to `/typography-hierarchy-spec`.
Current usage: `text-2xl font-bold` page title, `text-lg font-semibold` section,
`text-base` body, `text-sm` meta, `text-xs` micro.

### Radius

`--radius: 0.625rem` (10px). Derived scale in `@theme`:

| Class | Formula | ≈ | Use |
|-------|---------|---|-----|
| `rounded-sm` | radius × 0.6 | 6px | badges |
| `rounded-md` | radius × 0.8 | 8px | inputs (note: Input uses `rounded-lg`) |
| `rounded-lg` | radius | 10px | buttons, inputs, cards |
| `rounded-xl` | radius × 1.4 | 14px | panels |
| `rounded-2xl`–`4xl` | radius × 1.8–2.6 | 18–26px | large containers |

### Shadow / Motion

No custom shadow or motion tokens defined. Use Tailwind defaults
(`shadow-sm` resting cards). `tw-animate-css` is imported for animation utilities.
All motion must honor `prefers-reduced-motion`. Formalize later if needed.

## Component Inventory

### UI primitives (`components/ui/`)

14 primitives exist (as of 2026-05-26) — base-ui (`@base-ui/react`) + cva. `cn`
from `@/lib/utils`: `button`, `input`, `label`, `card`, `badge`, `table`, `alert`,
`select`, `dialog`, `tabs`, `radio-group`, `skeleton`, `toast`, `checkbox`.

| Component | Source | Variants / sizes | Notes |
|-----------|--------|------------------|-------|
| Button | `components/ui/button.tsx` | variant: default, outline, secondary, ghost, destructive, link · size: default(h-8), xs(h-6), sm(h-7), lg(h-9), icon, icon-xs/sm/lg | `focus-visible:ring-3`. **destructive is SOFT** (`bg-destructive/10 text-destructive`), not solid fill. No `asChild` — style a `<Link>` with `buttonVariants({…})` instead |
| Input | `components/ui/input.tsx` | default | h-8, `rounded-lg`, `border-input`, `aria-invalid` styling, `focus-visible:ring-3` |
| Card | `components/ui/card.tsx` | Card/Header/Title/Description/Action/Content/Footer | `CardTitle` accepts `as="h2"\|"h3"\|"h4"` — use a raw `<h1>` for page titles |
| Badge | `components/ui/badge.tsx` | neutral, success, danger, pending, count | status pills (see `account/bookings/bookingStatus.ts` `STATUS_VARIANT`) |
| Label | `components/ui/label.tsx` | default | pair with `<Input id>` via `htmlFor` |

Other primitives (`table`, `alert`, `select`, `dialog`, `tabs`, `radio-group`,
`skeleton`, `toast`, `checkbox`) follow the same shadcn-on-base-ui shape.

### Custom components

| Component | Source | Justification |
|-----------|--------|---------------|
| HoldTimer | `components/HoldTimer.tsx` | countdown w/ aria-live; no primitive equivalent |
| HoldExpiryModal | `components/HoldExpiryModal.tsx` | hold-expiry interrupt dialog |
| CustomerForm | `components/search/...`/booking | buyer-info form (tailwind-clean reference impl) |
| SearchForm / SearchFormWrapper | `components/search/` | trip search; base-ui Input quirks (drive via `onValueChange`, not `fill()` — see Mistake Log) |
| BookButton | `components/search/BookButton.tsx` | tripId+ticketCount CTA → hold flow |

### Variant Matrix — Button

| variant | xs(h-6) | sm(h-7) | default(h-8) | lg(h-9) | icon* |
|---------|---------|---------|--------------|---------|-------|
| default | ✅ | ✅ | ✅ | ✅ | ✅ |
| outline | ✅ | ✅ | ✅ | ✅ | ✅ |
| secondary | ✅ | ✅ | ✅ | ✅ | ✅ |
| ghost | ✅ | ✅ | ✅ | ✅ | ✅ |
| destructive | ✅ | ✅ | ✅ | ✅ | ✅ |
| link | n/a (inline text) | | | | |

## Usage Rules

### Do
- Reference tokens via Tailwind classes (`bg-primary`, `text-muted-foreground`).
- Use `<Button>` / `<Input>` primitives, not raw `<button>` / `<input>` + inline style.
- All interactive elements ≥ 44×44px hit area.
- Every form input has a visible associated label.
- Button text labels the action ("Đặt vé", "Lưu", not "OK").
- Status banners: reuse the `booking/result` amber/green/red palette verbatim.

### Don't
- No inline `style={{}}` for color/spacing/layout (the thing being removed).
- No raw oklch/hex in JSX.
- No `tailwind.config.ts` — edit tokens in `globals.css`.
- No two equal-weight primary CTAs on one screen.
- No `placeholder` used as a label.
- No solid-fill assumption for `destructive` Button — it renders soft.

## A11y Minimums
- Contrast ≥ 4.5:1 normal text, ≥ 3:1 large/bold.
- Visible focus ring on every interactive (`focus-visible:ring-3` baked into primitives).
- Touch target ≥ 44×44px.
- Modal (HoldExpiryModal + future Dialog) traps focus, Esc closes.
- Honor `prefers-reduced-motion`.

Defer detailed pass to `/a11y-design`.

## Open Questions
- Promote amber/green status colors to semantic `warning`/`success` tokens?
- Dark mode in scope for Phase A, or post-launch? (`.dark` tokens exist but no toggle.)
- Operator shell: adopt `sidebar*` tokens (dashboard nav) or keep flat layout?

## Out of Scope
- Marketing/print styles.
- Net-new token invention — the neutral set is complete; this doc documents it.

## Auto-chain
- Status-token decision + contrast → `/a11y-design`.
- Form label/field patterns → `/form-design`.
- Operator table surfaces → `/data-table-design`; dashboards → `/dashboard-layout`.
- Type scale → `/typography-hierarchy-spec`.
- Drift across normalized surfaces → `/consistency-audit`.
