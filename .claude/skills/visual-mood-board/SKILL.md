---
name: visual-mood-board
description: Build visual mood board — reference imagery, color, typography, texture, photography style. Outputs to `docs/inception/mood-board-<project>.md`. Use when user says "mood board", "visual direction", "design inspiration", "art direction", "/visual-mood-board", or before `/logo-brief` and `/design-system`.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /visual-mood-board — Pick The Vibe Before Building It

A mood board prevents "make it pop" feedback loops. Get art direction agreed on paper before pixels move.

## Why you'd care

Jumping to a logo or design system without a visual direction is how brands end up looking like a Bootstrap demo. The mood board is the cheap, fast convergence step that makes downstream design coherent.

## Pre-flight
None. Pairs with `/brand-archetype`, `/brand-voice-charter`, `/logo-brief`.

## Inputs
- Brand archetype (`/brand-archetype`).
- ICP profile.
- 5+ visual references the founder loves + 3 they hate.

## Process
1. **Define 3 mood adjectives** (e.g., "warm + crafted + modern", not "cool + clean + premium" — too generic).
2. **Reference grid** — collect 9-12 visuals across 4 categories:
   - **Competitor & adjacent products** (websites, app screens)
   - **Off-category** (magazines, packaging, architecture — keeps it fresh)
   - **Photography style** (lifestyle vs studio vs editorial)
   - **Typography & lettering specimens**
3. **Color palette extraction** — pull 5-7 hex codes from the references. Anchor + 2 accents + 2 neutrals + 1 alert.
4. **Typography pairing** — pick 1 display font + 1 text font. Specify weights + fallback stack. Free options first (Google Fonts).
4.5. **Motion references** — capture how the reference products *move*: easing character (snappy / smooth / springy / minimal), motion presence (motion-forward vs near-static), what animates vs what stays put. Feeds `/motion-direction-spec`.
4.6. **Layout-personality pick** — explicitly choose a layout personality: asymmetric / editorial / dense / spacious. Do NOT default to "cards in a grid" (tell T13 — no layout personality).
5. **Anti-mood board** — what we're NOT. Three concrete "do not do this" references. Cross-check against the 13-tell genericness checklist (T1-T13) and route to `/anti-generic-design-check`: if the chosen direction trips a tell (default font, slate-only neutrals, single safe accent, gradient-blob hero, emoji-as-icon, no layout personality, etc.), reject and re-pick.
6. **Vibe in one sentence** — "Feels like <X> if it were a <Y>." E.g., "Feels like a Muji store if it ran reservation software."
7. **Pressure test** — show 3 prospects + 1 designer. Does adjective triangle hold?

## Output
Write `docs/inception/mood-board-<project>.md`:

```markdown
# Visual Mood Board — <project>
**Date:** <YYYY-MM-DD>
**Mood:** <3 adjectives>

## Vibe sentence
"Feels like <reference X> if it were a <category Y>."

## Reference grid
| # | Source URL / image path | Why it works | Pull this |
|---|--------------------------|--------------|-----------|
| 1 | <linear.app screenshot> | crisp hierarchy, generous spacing | grid system |
| 2 | <muji.com> | restraint, no decoration | color palette |
| 3 | <magazine Apartamento> | warm photography, editorial | photo style |
| 4 | <font: Söhne specimen> | modern grotesk, no fussiness | font choice |
| ... | ... | ... | ... |

## Color palette
| Role | Hex | Notes |
|------|------|-------|
| Anchor | #1a1a1a | near-black for type + UI |
| Accent 1 | #c9472b | brand accent, sparing use |
| Accent 2 | #f4e3c1 | warm secondary |
| Neutral 1 | #f7f5f0 | page background |
| Neutral 2 | #e8e2d6 | borders, dividers |
| Alert | #b00020 | errors only |

## Typography
- **Display:** Söhne (or fallback: Inter, system-ui)
- **Text:** Söhne (same family, lighter weight)
- **Mono (for prices, codes):** JetBrains Mono
- Weights to load: 400, 500, 700

## Motion references
| # | Reference | How it moves | Pull this |
|---|-----------|--------------|-----------|
| 1 | <linear.app> | snappy, short ease-out, motion used sparingly | easing character |
| 2 | <stripe.com> | smooth, layered, motion-forward hero | motion presence |
- Easing character: <snappy / smooth / springy / minimal>
- Motion presence: <motion-forward / balanced / near-static>
- Feeds `/motion-direction-spec`.

## Layout personality
- Picked: <asymmetric / editorial / dense / spacious>
- Why: <reason tied to mood adjectives + product type>
- NOT "cards in a grid" by default.

## Photography direction
- Natural light, no flash
- Hands in frame, not faces
- Real settings (kitchen, dining room) not staged studios
- 4:5 portrait orientation for hero shots

## Anti-mood board (NOT this)
| # | Reference | Why we reject |
|---|-----------|----------------|
| 1 | <typical SaaS gradient hero> | overused, distrustful |
| 2 | <stock photo with diverse smiling team> | inauthentic |
| 3 | <neon cyber bro aesthetic> | wrong audience |

## Vibe check (3 outsiders)
| Tester | Reaction | 3-word summary they used |
|--------|----------|---------------------------|
| <name> | matches | "warm, modern, calm" |
| <name> | partial | "good but a bit cold" |
| <name> | matches | "crafted, not corporate" |

## Next
- Logo brief → `/logo-brief`
- Design system tokens → `/design-system`
- Apply to wireframes → `/ui-wireframe`
```

## Verification
- 3 mood adjectives picked (not generic).
- 9+ references with "why" annotations.
- Color palette = 5-7 hex codes with roles.
- Typography includes display + text + weights.
- Motion references captured: easing character + motion presence noted.
- Layout personality explicitly picked (not defaulted to cards-in-a-grid).
- Anti-mood board has 3 explicit rejections.
- Anti-mood board cross-checked against the 13-tell checklist; tripped tells rejected.
- Vibe sentence in form "Feels like X if it were a Y".

## Auto-chain
- Consumes `/web-design-capture` corpus + `/design-trend-compare` auto-picked direction (informs the reference grid + color + motion + layout pick).
- Feeds `/motion-direction-spec` (motion references) and `/typography-hierarchy-spec` (display + text pairing).
- Routes to `/anti-generic-design-check` when the anti-mood-board step flags a genericness tell.
- Pairs downstream with `/logo-brief`, `/design-system`, `/ui-wireframe`.
