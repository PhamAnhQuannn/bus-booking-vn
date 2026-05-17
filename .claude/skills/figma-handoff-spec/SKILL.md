---
name: figma-handoff-spec
description: Figma → code handoff contract. Dev Mode setup, token export pipeline, redline annotations, asset export naming, component-to-code mapping, version pinning. Outputs `docs/design/figma-handoff.md` so engineering reads one file instead of scrubbing the file tree. Use when user says "figma handoff", "dev mode", "design handoff", "token export", "redlines", "design specs", "/figma-handoff-spec", or before engineering starts on a new screen sourced from Figma.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# Figma Handoff Spec

## Why you'd care

Without a written handoff contract, engineering spends hours scrubbing the Figma file tree, guesses at tokens, and ships pixels that don't match — designers then re-review the same screen three times. One file with the redlines + token export + version pin saves that whole loop.

Engineering should never guess from a Figma screenshot. This skill writes the explicit handoff contract: which page, which frame, which tokens, which assets, which version. Stops the "file moved, link broken" rot and the "designer changed the spacing yesterday" surprise.

## When This Skill Applies

Activate when:
- User says "figma handoff", "dev mode", "design handoff", "token export", "redlines", "/figma-handoff-spec"
- New screen ready for build
- Design system tokens updated; need re-export
- Engineer asks "where's the latest version of X"
- Pre-sprint planning — surfaces being scoped need handoff doc

## Prerequisites

- Figma file URL with Dev Mode enabled.
- Design system tokens published (Figma variables → exportable).
- Decision: token export pipeline (manual JSON / Tokens Studio / Figma REST API).
- Wireframe + design-system docs already exist locally (`docs/design/wireframes/<screen>.md`, `docs/design/design-system.md`).

## Steps

1. **Pin version.** Capture current Figma file version URL (Version History → copy link). Handoff is against that pinned version, not "latest".
2. **Map frames to surfaces.** Each shippable screen = one frame; record frame node-id.
3. **Token export.** Define source (Figma variables), format (W3C DTCG JSON), destination (`design-tokens/tokens.json`), pipeline (manual / Tokens Studio / Style Dictionary).
4. **Component map.** For each component used in design, name the code component it maps to (shadcn Button, custom Card, etc.).
5. **Redline annotations.** Spacing / sizing notes the engineer needs that Dev Mode inspector doesn't surface (e.g., "this gap is 16px on mobile, 24px on desktop — uses spacing.md").
6. **Asset export.** Icons / illustrations: format (SVG inline / PNG @1x@2x@3x / WebP), naming (`icon-<name>-<size>.svg`), destination folder.
7. **Interaction notes.** Animations, micro-interactions, hover/focus/active that Figma's prototype layer hints at but doesn't fully spec.
8. **Edge cases not in design.** Flag long strings, empty states, error states the comp doesn't show.
9. **Open questions for designer.** Any ambiguity must be a question, not an assumption.
10. **Write** `docs/design/figma-handoff.md`.
11. **Auto-chain.** Missing tokens → `/design-system`. Missing states → `/state-pattern-catalog`. New a11y patterns → `/a11y-design`.

## Output Format — `docs/design/figma-handoff.md`

```markdown
---
last-updated: YYYY-MM-DD
status: draft | reviewed | implemented
figma-file: https://www.figma.com/design/abc123/MyApp
pinned-version: https://www.figma.com/design/abc123/MyApp?version-id=12345
designer: @alice
---

# Figma Handoff

## Pinned Version

- File: `MyApp` (id `abc123`)
- Version: `12345` (2026-05-12 14:32 UTC, "Final pricing page")
- All node-ids below resolve against this version. Re-pin on every handoff doc bump.

## Frame Map

| Surface | Page | Frame | Node-id | Wireframe |
|---------|------|-------|---------|-----------|
| signup | Auth | Sign up — desktop | `123:456` | docs/design/wireframes/signup.md |
| signup | Auth | Sign up — mobile | `123:457` | same |
| pricing | Marketing | Pricing — desktop | `200:10` | docs/design/wireframes/pricing.md |
| pricing | Marketing | Pricing — mobile | `200:11` | same |

Dev Mode link template: `https://www.figma.com/design/abc123/MyApp?node-id=123-456&mode=dev&version-id=12345`

## Token Export

- Source: Figma variables (Collections: `Color`, `Spacing`, `Radius`, `Typography`).
- Format: W3C Design Tokens DTCG JSON.
- Pipeline: Tokens Studio plugin → push to `design-tokens/` repo folder.
- Destination: `design-tokens/tokens.json`.
- Build step: Style Dictionary → `tokens.css` (CSS vars) + `tokens.ts` (TS const).
- Cadence: re-export on every design-system bump; commit token diff alongside design-system.md update.

## Component Map

| Figma component | Code component | Notes |
|-----------------|----------------|-------|
| Button / Primary | `<Button variant="primary">` (shadcn) | size lg = h-12, default = h-10 |
| Button / Secondary | `<Button variant="secondary">` | |
| Card / Plan | custom `<PricingCard>` | not in shadcn; build per spec |
| Input / Text | shadcn Input | |
| Modal / Confirm | shadcn AlertDialog | |
| Icon (any) | lucide-react | name in icon spec table below |

## Redline Annotations

Items Dev Mode inspector misses or misleads on:

| Surface | Note |
|---------|------|
| pricing | Card-to-card gap: 24px desktop / 16px mobile (uses `spacing.6` / `spacing.4`). Inspector shows raw px; the design system token reference is the source of truth. |
| pricing | Featured card has `2px` border in `border-primary`; non-featured has `1px` `border-default`. |
| signup | Form max-width clamps at 480px on >tablet; centers in viewport. |

## Asset Export

| Asset | Format | Sizes | Filename | Folder |
|-------|--------|-------|----------|--------|
| Logo | SVG (inline) | n/a | `logo.svg` | `apps/web/src/assets/` |
| Hero illustration | SVG | n/a | `hero-pricing.svg` | `apps/web/src/assets/illustrations/` |
| Empty-state | SVG | n/a | `empty-bookings.svg` | same |
| Avatar fallback | PNG | @1x @2x @3x | `avatar-default-{1,2,3}x.png` | `apps/web/src/assets/avatars/` |
| Plan badge "Most popular" | SVG (inline) | n/a | `badge-popular.svg` | with PricingCard component |

Icons: do NOT export from Figma. Use `lucide-react` and reference by name. Designer marks each icon with `lucide:check`, `lucide:x` etc. in the design.

## Interaction Notes

- Pricing card hover (desktop only): card lifts (`translateY(-4px)` + shadow `lg`), 150ms ease-out.
- Plan toggle (Monthly / Yearly): switch widget animates `200ms` ease-in-out; price text crossfades, no number tween.
- Sign up form submit: button shows spinner inline (no full-page overlay).
- Reduced-motion: disable lift, disable crossfade, disable switch animation; instant state change.

## Edge Cases Not in Design

| Case | Designer's instruction needed? |
|------|-------------------------------|
| Plan name longer than 1 line | Yes — wrap or truncate? |
| Currency in non-USD region | Format per locale; verify symbol fits |
| Yearly toggle defaults | Decide based on region or A/B; spec missing |
| Comparison table on mobile | No mobile design yet — flag as gap |

## Open Questions

- Featured card behavior on mobile (stack on top vs middle)? — @alice
- Should plan switch animate price digits (count up) or hard swap? Currently spec'd hard swap; confirm. — @alice
- Empty state for "no plans available" (server fail) — needs design. — @alice

## Out of Scope

- Marketing site nav (separate handoff).
- Email templates (separate flow).
- Component library Storybook setup (engineering decides).

## Verification

Engineer signs off after:
1. Tokens imported, build green.
2. Each frame in map renders 1:1 with code at the pinned version.
3. Redlines applied; spacing matches token references.
4. Assets at correct paths with correct names.
5. Open questions resolved or filed as follow-up tickets.
```

## Boundaries

- **One handoff doc per surface batch.** A new sprint's surfaces = a new handoff doc; don't append into one mega-file forever.
- **Pin a version, always.** "Latest" handoffs rot the moment designer iterates.
- **Tokens are the contract.** Pixel values in Figma must reference tokens; if not, designer fixes Figma first, not engineer in code.
- **No code.** Component impl downstream; this spec defines what to build, not how.
- **No nagging at the designer.** Open questions are a list, not commentary.

## Re-run Behavior

- Read existing first; surface diff (which frames new/changed/dropped).
- Bump `last-updated` and re-pin version.
- Status: draft → reviewed → implemented.

## Auto-chain

- Missing token reference → `/design-system` to add token.
- Missing component in code library → `/design-system` to spec component.
- Edge cases not in design → `/state-pattern-catalog` for the missing states.
- New a11y patterns surfaced → `/a11y-design` for the affected screen.

## Example Trigger

User: "write the handoff for the pricing page Figma"
→ Pin version, map frames, list tokens + components + assets + redlines + open questions, write `docs/design/figma-handoff.md`.
