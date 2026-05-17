---
name: design-system
description: Design system tokens + component inventory. Capture color, spacing, typography, radius, shadow tokens; component variants; usage rules. Use when user says "design tokens", "design system", "component library", "shadcn inventory", "/design-system", before scaling UI work, or when inconsistencies appear across screens. Writes docs/design/design-system.md.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# Design System

## Why you'd care

By month nine the product has 14 shades of "primary blue," 6 button heights, and 3 variants of the same modal — and nobody can ship a feature without re-deciding spacing because the canonical answer was never written down. A token set + component inventory locked at inception is what stops the slow visual decay where every PR introduces one more variant and the design starts looking like four products taped together; retrofitting that consistency later is a multi-quarter "design system rewrite" project.

Single source of truth for tokens + components. Output is a contract that every wireframe + UI PR references. Stops drift before it starts.

## When This Skill Applies

Activate when:
- User says "design tokens", "design system", "component library", "shadcn inventory", "/design-system"
- Pre-implementation: 3+ screens upcoming.
- Inconsistencies appear: same button two different paddings, two near-identical card components.
- Adopting / extending shadcn-ui catalog.
- Theme / dark-mode / brand refresh.

## Prerequisites

- Tailwind config exists or is about to (`tailwind.config.ts`).
- shadcn primitives available (default: `app/components/ui/`).
- At least one wireframe so concrete needs are visible.

## Steps

1. **Inventory current state.** `ls app/components/ui/` + grep `tailwind.config.ts` for tokens. Read existing.
2. **Define semantic tokens** (color, spacing, type, radius, shadow, motion). Semantic name (`primary`, `danger`) — never raw hex in components.
3. **Map each token to a value.** Tailwind class or CSS var. Light + dark mode if applicable.
4. **Component inventory.** For each shadcn primitive in use: name + variants + when to use + when NOT.
5. **Variant matrix.** Button: variant × size × state. Catch missing combos.
6. **Custom components.** Anything beyond shadcn — list, justify, link to source file.
7. **Usage rules.** Anti-patterns, forbidden combos, accessibility minimums.
8. **Token-Diversity Gate.** Before finalizing tokens, every default choice — `Inter` font, slate/zinc neutral ramp, 12-column symmetric grid, uniform radius, 3-5 KPI headline — must be either (a) justified against the captured corpus (`/web-design-capture`) / the `/design-trend-compare` auto-picked direction, or (b) flagged for `/anti-generic-design-check`. An unjustified default is not allowed to ship — replace it with the corpus-derived value.
9. **Write** `docs/design/design-system.md`.
10. **Auto-chain.** Token contrast issues → `/a11y-design`. New components surfaced from wireframes → propose for inventory.

## Output Format — `docs/design/design-system.md`

```markdown
---
last-updated: YYYY-MM-DD
tailwind-config: tailwind.config.ts
shadcn-components: app/components/ui/
---

# Design System

## Color Tokens

> Values below are SLOTS, not answers. Fill the neutral ramp from `<neutral ramp from trend-<type>.md>` (the `/design-trend-compare` auto-picked direction) — do NOT default to a slate-only ramp (tell T2). The accent is `<accent strategy from corpus>` — a single safe accent (tell T3) must be justified or replaced.

| Token | Light | Dark | Tailwind class | Use |
|-------|-------|------|----------------|-----|
| bg-default | `<from corpus>` | `<from corpus>` | `bg-background` | page background |
| bg-muted | `<from corpus>` | `<from corpus>` | `bg-muted` | secondary surface |
| text-default | `<from corpus>` | `<from corpus>` | `text-foreground` | body text |
| text-muted | `<from corpus>` | `<from corpus>` | `text-muted-foreground` | metadata |
| primary | `<accent from trend-<type>.md>` | `<accent from trend-<type>.md>` | `bg-primary text-primary-foreground` | CTAs |
| danger | `<from corpus>` | `<from corpus>` | `bg-destructive` | errors, destructive actions |
| warn | `<from corpus>` | `<from corpus>` | `text-amber-700 dark:text-amber-400` | non-blocking warnings |
| success | `<from corpus>` | `<from corpus>` | `text-green-600 dark:text-green-400` | success states |
| border | `<from corpus>` | `<from corpus>` | `border` | dividers |

**Rule:** never use raw hex in components. Reference token via Tailwind class or CSS var.
**Rule:** every slot above must be filled from the corpus / auto-picked trend direction — an unjustified generic default is a `/anti-generic-design-check` finding.

## Spacing Scale

Tailwind default (4px base): `1` (4px), `2` (8px), `3` (12px), `4` (16px), `6` (24px), `8` (32px), `12` (48px), `16` (64px).

Layout grid: 4px base. No half-steps.

## Typography

| Token | Class | Size / line | Use |
|-------|-------|-------------|-----|
| display | `text-4xl font-bold` | 36/40 | hero |
| h1 | `text-3xl font-bold` | 30/36 | page title |
| h2 | `text-2xl font-semibold` | 24/32 | section |
| h3 | `text-xl font-semibold` | 20/28 | subsection |
| body | `text-base` | 16/24 | default |
| small | `text-sm` | 14/20 | metadata |
| micro | `text-xs` | 12/16 | timestamps, footnotes |

Display family: `<display family from typography.md>`. Body family: `<body family from typography.md>`. Weights used: `<weight set from typography.md>`.

**Rule:** do NOT default to `Inter`/`Geist`-only (tell T1) or one-weight typography (tell T12). The pairing comes from `/typography-hierarchy-spec`; if no `typography.md` exists, chain to it before finalizing.

## Radius

Radius scale: `<radius scale from corpus>`. Do NOT default to a single uniform radius across every component (tell T6) — the corpus delta dictates whether inputs / buttons / cards / modals share or differ.

| Token | Value | Use |
|-------|-------|-----|
| sm | `<radius from corpus>` | inputs, badges |
| md | `<radius from corpus>` | buttons |
| lg | `<radius from corpus>` | cards |
| xl | `<radius from corpus>` | modals |
| full | 9999px | avatars, pills |

## Shadow

Shadow strategy: `<shadow strategy from corpus>`. Do NOT default to a generic `rgba(0,0,0,0.x)` shadow stack (tell T7) — match the corpus (some product types use borders / layered surfaces / colored shadows instead).

| Token | Value | Use |
|-------|-------|-----|
| sm | `<shadow from corpus>` | resting cards |
| md | `<shadow from corpus>` | dropdowns |
| lg | `<shadow from corpus>` | modals |

## Motion

Motion tokens come from `/motion-direction-spec` (`motion.md`) — the picked motion personality per product type. Do NOT hardcode generic `150/250/400ms` timings (tell T8); fill from `motion.md`.

| Token | Duration | Easing | Use |
|-------|----------|--------|-----|
| fast | `<fast token from motion.md>` | `<easing from motion.md>` | hovers, focus |
| base | `<base token from motion.md>` | `<easing from motion.md>` | modals, drawers |
| slow | `<slow token from motion.md>` | `<easing from motion.md>` | page transitions |

All animations honor `prefers-reduced-motion`.

## Component Inventory

### Stock shadcn (in use)

| Component | Source | Variants | Notes |
|-----------|--------|----------|-------|
| Button | shadcn | default, destructive, outline, ghost, link × sm/md/lg | Default for all CTAs |
| Input | shadcn | default | always paired with Label |
| Label | shadcn | — | required for a11y |
| RadioGroup | shadcn | — | a11y-correct via Radix |
| Dialog | shadcn | — | modal w/ focus trap |
| Toast (Sonner) | shadcn | success, error, info | role=status |
| Card | shadcn | default | use for grouped content |
| Skeleton | shadcn | — | use during loading state |

### Custom components

| Component | Source | Justification |
|-----------|--------|---------------|
| BookingSummaryCard | app/components/booking/summary-card.tsx | composition of Card + price formatting; reused 4 places |
| CountdownBadge | app/components/ui/countdown-badge.tsx | timer w/ aria-live; no shadcn equivalent |
| SeatGrid | app/components/booking/seat-grid.tsx | bus seat-map layout; domain-specific |

### Forbidden / removed

| Component | Why removed |
|-----------|-------------|
| custom Modal in app/old/* | replaced by shadcn Dialog (focus trap correctness) |

## Variant Matrix — Button

| Variant | sm (h-8) | md (h-10) | lg (h-12) |
|---------|----------|-----------|-----------|
| default | ✅ | ✅ | ✅ |
| destructive | ✅ | ✅ | ✅ |
| outline | ✅ | ✅ | ✅ |
| ghost | ✅ | ✅ | ❌ (not designed) |
| link | ✅ | ✅ | ❌ |

## Usage Rules

### Do

- Reference tokens via Tailwind classes (`bg-primary`, not `bg-[#0F172A]`).
- Use shadcn primitives before writing custom components.
- All clickable elements ≥ 44×44 px hit area (a11y).
- Button text always labels the action ("Pay", "Book", not "OK").

### Don't

- No raw hex in JSX/TSX.
- No inline `style={{...}}` for colors/spacing.
- No two CTAs of equal weight on one screen — pick one primary.
- No `text-gray-500` or arbitrary tailwind grays — use semantic token.
- No custom modal — always shadcn Dialog.
- No `placeholder` as label.

## A11y Minimums

- Contrast ≥ 4.5:1 normal text, ≥ 3:1 large/bold ≥18px.
- Focus ring visible on every interactive (Tailwind `focus-visible:ring-2`).
- Touch target ≥ 44×44 px.
- All form inputs have visible Label.
- Modal traps focus, Esc closes (unless explicitly blocked).

## Open Questions

- Brand color palette finalized? Pending stakeholder sign-off.
- Dark mode in MVP? Defer to post-launch.

## Out of Scope

- Marketing site (separate Tailwind config).
- Print stylesheet (post-launch).
```

## Boundaries

- **Tokens are semantic, not raw.** `primary` not `slate-900`.
- **shadcn-first.** Custom only when stock can't.
- **Inventory must list both included and forbidden** (so removals don't get re-introduced).
- **No design specs for individual screens.** That's wireframes' job.
- **No CSS file edits.** Output is markdown design doc; Tailwind config edits are downstream.

## Re-run Behavior

- If file exists, read first. Add new tokens/components, mark deprecated ones rather than deleting.
- Bump `last-updated`.

## Auto-chain

- Consumes `/web-design-capture` corpus + `/design-trend-compare` auto-picked direction (fills the neutral ramp, accent, radius, shadow slots).
- Chained from `/typography-hierarchy-spec` (consumes `typography.md` for display + body families) and `/motion-direction-spec` (consumes `motion.md` for motion tokens).
- Routes to `/anti-generic-design-check` after tokens are produced — every default that survived the Token-Diversity Gate gets audited against the 13-tell checklist.
- Token contrast issues surfaced → `/a11y-design` cross-ref.
- New custom components proposed → consider promoting to a wider library (separate concern).
- Token changes → audit existing screens for drift (`/consistency-audit`).

## Example Trigger

User: "let's formalize our design tokens before more screens get built"
→ Read tailwind.config + app/components/ui/, propose semantic tokens, list shadcn + custom components, write usage rules, write `docs/design/design-system.md`.
