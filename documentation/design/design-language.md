---
title: Bus-Booking Design Language (canonical)
version: 1.0
date: 2026-05-27
status: SOURCE OF TRUTH — supersedes the token/identity sections of design-system.md
source-of-record: app/globals.css, app/layout.tsx, components/ui/*
cites: baseline-built-ui-20260527.md, benchmarks/ota-capture.md, benchmarks/ota-gap-analysis.md
---

# Bus-Booking Design Language v1.0

The single source of truth for the visual + interaction language. Every pattern
(`docs/design/patterns/*`) and page spec (`docs/design/pages/*`) cites this doc by
version. `design-system.md`, `typography-hierarchy-spec.md`, `motion-direction-spec.md`,
`nav-pattern-pick.md`, `cta-hierarchy.md` remain as deep references but their
token/identity decisions are **canonicalized here**; where they disagree, this wins.

## 0. Personality
**Warm · Trustworthy · Brisk · Local-Vietnamese OTA.** A friendly Vietnamese
coach-station counter rendered with fintech precision. Reads like Vexere with
Expedia/ANA polish — dense and scannable, never clinical or generic-SaaS.

## 1. Color tokens (oklch, from `app/globals.css`)
Reference tokens by Tailwind class (`bg-primary`, `text-muted-foreground`) — **never raw oklch/hex in JSX**.

| Token | Light | Role |
|---|---|---|
| `background` | `oklch(0.99 0.004 80)` | warm page bg |
| `foreground` | `oklch(0.205 0.012 55)` | body text |
| `card` / `popover` | `oklch(1 0 0)` | pure-white surfaces (contrast vs warm page) |
| `primary` | `oklch(0.646 0.222 41.116)` ≈ `#EA580C` | brand orange — CTAs, links, active, price, focus ring |
| `primary-foreground` | `oklch(0.985 0 0)` | label on orange |
| `secondary`/`muted`/`accent` | `oklch(0.965 0.006 75)` | warm-gray fills |
| `muted-foreground` | `oklch(0.52 0.012 70)` | metadata |
| `destructive` | `oklch(0.577 0.245 27.325)` | errors, destructive |
| `success` (+fg/border) | green-50/900/200 equiv | paid/active/confirmed |
| `warning` (+fg/border) | amber-50/900/200 equiv | pending/non-blocking |
| `border`/`input` | `oklch(0.91 0.008 75)` | dividers/field outlines |
| `ring` | = primary | focus ring |
| `sidebar*` | warm-neutral set | operator console chrome |

**Decisions (resolving design-system.md open questions):**
- **Status tokens — RESOLVED:** use `success`/`warning`/`destructive` semantic tokens; never raw `green-*`/`amber-*`/`red-*` utilities in JSX.
- **Dark mode — OUT OF SCOPE (this phase):** `.dark` tokens exist but no toggle ships; do not design dark variants in page specs yet.
- **Secondary accent — DECISION (new):** introduce a **teal info accent** (`info`/`info-foreground`/`info-border`, ~`oklch(0.45 0.07 195)`) for informational chips, links-as-info, and **chart series** (current `chart-1..5` are grayscale — a genericness flag T2/T_charts). Orange stays the single *action* accent (one-primary rule); teal is *informational only*. Add to `globals.css` when Phase-implementation begins.

## 2. Typography
- **Display/heading/body:** Be Vietnam Pro (`--font-sans`/`--font-display`/`--font-heading`, weights 400/500/600/700). **Mono:** Geist Mono — times, prices, booking refs, license plates.
- **Scale:** display `text-3xl/4xl font-bold` (hero) · h1 `text-2xl font-bold` · h2 `text-lg/xl font-semibold` · h3 `text-base font-semibold` · body `text-base` · meta `text-sm` · micro `text-xs`.
- **Rules:** `text-muted-foreground` only on `background`/`card` fills (contrast floor). **No uppercase** on Vietnamese (diacritic legibility). Prices/times always mono + `text-primary` for price emphasis (OTA price-forward convention).

## 3. Spacing & layout
- 4px base; steps 1,2,3,4,6,8,12,16. No half-steps.
- **Containers:** content `max-w-2xl`; results/detail `max-w-3xl`; operator/dense `max-w-5xl/6xl`. Page rhythm `px-4 py-8 gap-6` (mobile-first).
- **Layout personality (anti-generic):** not everything is a centered single column. Results pages use a **2-column desktop grid** (filter rail + list); checkout uses **content + sticky summary rail**; home uses a **full-bleed hero band**.

## 4. Radius (base `--radius: 0.75rem`)
`sm` (badges) · `md` (inputs/small) · `lg` (buttons, inputs, cards) · `xl` (panels/modals) · `2xl–4xl` (hero/large containers). Buttons default variant = `rounded-full` pill.

## 5. Elevation (`shadow-e1..e4`, warm-tinted)
`e1` resting card · `e2` hover/interactive · `e3` search card / sticky bar · `e4` modal. **Never `shadow-sm`/flat.** Hover lifts use `e1→e2` + `motion-safe:-translate-y-0.5`.

## 6. Motion
Snappy + restrained (OTA, Linear-like). Durations 150ms (state/hover/focus) · 200–240ms (overlays: dialog/drawer/toast/tabs). `ease-out`. All gated by `prefers-reduced-motion`. Choreographed: card hover-lift, step-indicator advance, filter chip add/remove, summary-rail total update, skeleton→content.

## 7. Iconography
`lucide-react`, `size-4`/`size-5`, `aria-hidden` when decorative. Canonical set: route/arrow-right, clock, timer, users, armchair (seats), wallet/credit-card, map-pin, phone, bus, shield-check, sliders-horizontal (filters), check. Amenity icons (wifi, snowflake/AC, plug, toilet) reserved for fare-tier/detail (ANA-style).

## 8. Components (primitives = the build API)
`components/ui/`: Button, Input, Label, Card(+Header/Title`as`/Description/Content/Footer), Badge(neutral/success/danger/pending/count), Alert, Select, Dialog, Tabs, RadioGroup, Checkbox, Skeleton, Toast, Combobox, Table. **Pages compose primitives + patterns; never raw `<button>`/`<input>`/inline color/spacing styles.** (Data-driven inline `style={{width}}` for bars is the only allowed exception.)

## 9. CTA hierarchy
One **primary** (orange filled pill) per view. Secondary = `outline`; tertiary = `ghost`/`link`. Destructive = soft (`destructive/10`) and demoted (never the primary). Button labels = action verbs (Đặt vé, Thanh toán, Tiếp tục) — never "OK". Sticky CTA bars (trip detail, checkout summary) keep the single primary visible.

## 10. A11y floor (WCAG 2.2 AA)
Contrast ≥4.5:1 (text) / ≥3:1 (large/UI); visible `focus-visible:ring-3`; touch targets ≥44×44; every input has a visible Label; status never color-only (icon/text too); modals trap focus + Esc; landmark + heading outline per page; `aria-live` for countdowns/async status.

## 11. Responsive baseline
Mobile-first. Breakpoint `md` (768px) is the primary shift: filter rail → bottom-sheet/`<details>`; summary rail → collapsible bottom bar; operator sidebar → top drawer; data tables → stacked cards (same data source, CSS swap). See per-page specs + PTN docs for collapse behavior.

## 12. Versioning
This is **v1.0**. Patterns/pages pin `design-language: v1.0`. Token changes bump the version and trigger a scorecard + anti-generic re-run (Phase E).
