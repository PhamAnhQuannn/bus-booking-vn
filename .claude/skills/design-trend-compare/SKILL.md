---
name: design-trend-compare
description: Compare N captured products of the same type and AUTONOMOUSLY pick the best modern design direction — product-type-segmented auto-best-pick benchmarked to market-leader metrics. Emits a concrete token recommendation, not a menu. Triggers on "compare these designs", "what's the modern <type> look", "/design-trend-compare", or auto-chains after ≥2 web-design-capture runs of the same product type.
output_size:
  XS: skip
  S: ~20min — 2 captures, one product type, metrics table + auto-pick
  M: ~45min — 3-4 captures, one product type, full metrics + outlier scan
  L: ~1.5h — multiple product types compared, direction per type
  XL: ~2.5h — full corpus sweep, direction per type + cross-type trend read
---

# /design-trend-compare — Compare captures, auto-pick the modern direction

## Why you'd care

A founder asked to pick between four design directions will pick whichever feels safest at 11pm — and the product ends up looking like a 2018 Bootstrap template while the category leaders ship 2026 visuals. Autonomously computing where market leaders converge across spacing, type ramp, motion, and density (and then committing to that direction in tokens, not in a menu) is what keeps the product visually current without asking the founder to be a design critic; the alternative is a months-long "should we redesign?" debate the team never resolves.

Take the `web-design-capture` corpus for a product type, compute modern-market metrics across every dimension, and **autonomously emit the best design direction** for that product type. "Best" = where market leaders converge, biased toward the leading edge — not the bland average. Output is a concrete token set the design-system can consume directly, **not** a menu of options for the user to pick from.

This skill encodes the enforcement decision: *skills choose design in auto — pick the best — match the metrics of modern marketplace product design based on type of product.*

## When This Skill Applies

- User says "compare these designs", "what's the modern <type> look", "which of these is best", "/design-trend-compare".
- Auto-chained after `/web-design-capture` produces ≥2 captures of the **same product type**.
- Before `/design-system` / `/visual-mood-board` / `/typography-hierarchy-spec` / `/motion-direction-spec` — those consume the picked direction.
- NOT for: capturing a new product (that's `/web-design-capture`), auditing your own built output (that's `/anti-generic-design-check`).

## Prerequisites

- **≥2 captures of the same product type** in `docs/design/corpus/<product-type>/`. One capture cannot establish a trend. If only one exists, run `/web-design-capture` on more same-type products first.
- Each capture must have the full token tables (Color / Typography / Spacing / Radius+Shadow / Motion / Layout / Components) — re-run capture if any are missing.
- Know the **target product type** for the project being designed — that selects which corpus segment to compare.

## Steps

### 1. Load the corpus segment

Read every `docs/design/corpus/<product-type>/*.md` for the target product type. If the user wants a cross-type read, load multiple segments and process each separately.

### 2. Compute per-dimension modern-market metrics

For each design dimension, reduce the corpus to a metric:

- **Palette** — saturation range, lightness range, light/dark default, neutral family (true-neutral vs warm vs cool vs tinted), accent count + strategy (single / dual / multi / gradient-led), contrast ratios on primary surfaces.
- **Typography** — display/body pairing pattern, modular-scale ratio, max display weight used, weight spread (how many weights in play), measure (line length), whether a non-default family is the norm.
- **Spacing** — base rhythm unit, scale length, density (tight / balanced / airy).
- **Radius** — dominant personality (sharp / soft / pill / mixed), whether radius varies by component or is uniform.
- **Shadow** — depth strategy (flat / single-soft / layered / colored / inset / none), elevation levels in use.
- **Motion** — presence (rich / moderate / minimal / absent), dominant easing family, duration band.
- **Layout** — composition norm (symmetric-grid / asymmetric / editorial / dense / spacious), container max-width band, section-rhythm pattern.

### 3. Derive central tendency + leading edge per dimension

For each dimension compute two values:

- **Central tendency** — what most of the corpus does. The safe consensus.
- **Leading edge** — what the most distinctive / newest captures do (use `captured:` date and the "design personality" read to weight recency and boldness).

The auto-pick is **biased toward the leading edge** — pull from central tendency for stability, push toward leading edge for modernity. Never emit the bland average; that reproduces the "same AI product" problem this pack exists to fix.

### 4. Emit the auto-picked direction

Produce **one concrete token set** per product type — specific values, not ranges, not options:

- Exact palette (neutral family + accent strategy + named roles with hex).
- Exact type pairing (display family, body family, scale ratio, weight ladder).
- Spacing base + scale.
- Radius personality + per-component values.
- Shadow strategy + elevation set.
- Motion personality + easing + duration band.
- Layout composition + container width.

This is a **decision**, stated as such. The design-system consumes it directly.

### 5. Flag outlier opportunities

Scan for the single distinctive move one product in the corpus makes that the others don't — a steal-worthy outlier (an unusual accent, an editorial layout break, a motion signature). List these separately as "moves worth stealing" — optional distinctiveness on top of the safe-modern base.

### 6. Write the trend file

Write `docs/design/trend-<product-type>.md`.

## Output Format

`docs/design/trend-<product-type>.md`:

```markdown
---
product-type: fintech
corpus-size: 3
captures: [stripe.com, mercury.com, ramp.com]
generated: 2026-05-13
---

# Modern design direction — fintech

## Corpus metrics
| Dimension | Central tendency | Leading edge | Auto-pick |
|---|---|---|---|
| Palette | dark-default, cool neutral, single accent | tinted-neutral, dual accent | tinted-cool neutral, dual accent (indigo + lime) |
| Type | Inter, 1.25 ratio, weights 400-600 | custom grotesk, 1.333 ratio, 700 display | custom grotesk display + Inter body, 1.333, 400/500/700 |
| Spacing | 8px base, balanced | 8px base, airy | 8px base, airy |
| Radius | soft uniform 8-12 | mixed: pill buttons, sharp cards | mixed — pill buttons, 6px cards |
| Shadow | single soft | layered + colored | layered, one colored elevation |
| Motion | minimal | moderate, spring easing | moderate, spring easing, 200-350ms |
| Layout | symmetric-grid, 1120 | asymmetric editorial | asymmetric, 1200 max |

## Auto-picked direction
<The concrete token set from step 4 — exact values. This is the decision.>

## What makes fintech modern in 2026
<One paragraph: the through-line across leading captures.>

## Moves worth stealing (outliers)
- <product>: <distinctive move> — optional distinctiveness layer.
```

## Boundaries

- **Needs ≥2 same-type captures.** One capture is not a trend — refuse and request more.
- **Picks a direction, does not write the final design system.** `/design-system` consumes this file; this skill stops at the token recommendation.
- **Auto-pick is a decision, not a survey.** Do not output "option A / option B / option C" for the user to choose — that defeats the enforcement intent. State the pick and the rationale.
- **Segmented by product type.** Never blend fintech + content + devtools metrics into one direction — each type gets its own trend file.

## Re-run Behavior

- **Trend file exists:** regenerate if the corpus grew (more captures = better signal) or captures were refreshed. Note the new `corpus-size` and `captures` list.
- **Corpus shrank / unchanged:** report the existing direction still holds; no rewrite needed.
- Adding captures over time sharpens the auto-pick — re-run after each corpus extension.

## Auto-chain

- **Consumes:** `web-design-capture` corpus (`docs/design/corpus/<product-type>/*.md`).
- **Feeds:** `/design-system` (consumes the auto-picked token set), `/visual-mood-board`, `/typography-hierarchy-spec`, `/motion-direction-spec`, `/anti-generic-design-check` (uses the direction as its corpus-benchmark half).
- Also fed by `/cta-hierarchy` and `/chart-type-pick` when those need the modern per-type personality.

## Example Trigger

> "We've captured Stripe, Mercury and Ramp — what's the modern fintech look we should build to?"

→ Load `docs/design/corpus/fintech/*.md`; compute metrics; derive central tendency + leading edge per dimension; emit one concrete auto-picked token set for fintech; flag outlier moves; write `docs/design/trend-fintech.md`; auto-chain `/design-system` to consume it.
