---
name: typography-hierarchy-spec
description: Pick a display + body type pairing AUTONOMOUSLY per product type — explicitly NOT defaulting to Inter-only — then emit a modular scale, a weight ladder, line-height and measure rules, and responsive type behavior. Benchmarks against captured market-leader type tokens when a corpus exists. Triggers on "type scale", "font pairing", "typography spec", "/typography-hierarchy-spec", or auto-chains from /design-system and /visual-mood-board.
output_size:
  XS: skip
  S: ~15min — pairing pick + scale table, no corpus
  M: ~30min — pairing + weight ladder + measure rules + corpus benchmark
  L: ~1h — full responsive type system + corpus delta + role map
  XL: ~1.5h — multi-surface type system + corpus delta + handoff-ready tokens
---

# /typography-hierarchy-spec — Type pairing + scale spec

Decide what the product reads like. The single most common genericness tell (T1) is Inter / Geist / system-ui as the only family with no display face and no rationale — the typographic equivalent of "every AI product." This skill makes type an intentional, product-type-segmented decision: it picks a display + body pairing, derives the modular scale and weight ladder, sets line-height and measure rules, and defines responsive behavior. The output is a token set the design-system consumes directly.

## Why you'd care

Defaulting to Inter on every project is how every B2B SaaS looks identical and forgettable. A deliberate display + body pairing per product type is what makes the brand visible in the type itself.

## When This Skill Applies

- User says "type scale", "font pairing", "typography spec", "what fonts should we use", "/typography-hierarchy-spec".
- Auto-chained from `/design-system` (after tokens are produced) and `/visual-mood-board` (type is part of the mood).
- After `/design-trend-compare` picks a direction whose type pairing needs to be expanded into a full scale.
- NOT for: capturing a product's type tokens (`/web-design-capture`), picking the overall direction (`/design-trend-compare`), or auditing genericness (`/anti-generic-design-check`).

## Prerequisites

- **Product type** — selects the pairing segment. One of: `saas`, `marketplace`, `fintech`, `devtools`, `mobile-consumer`, `internal-admin`, `content`, `ecommerce`.
- **Corpus benchmark (optional but recommended)** — `docs/design/trend-<product-type>.md` from `/design-trend-compare`, or raw `docs/design/corpus/<product-type>/*.md` typography sections. Without it, the pairing pick still runs from the product-type heuristics below; the corpus-delta step is skipped.
- **Design system (optional)** — `docs/design/design-system.md` if it exists, so the type scale aligns with the spacing scale.

## Steps

### 1. Pick the display + body pairing

Choose a pairing — a display face for h1/h2 (and sometimes h3) and a body face for everything else. The pick is autonomous, biased by product type, sharpened by the corpus. **Inter-only is not a valid pick** unless the corpus for that product type genuinely converges on it AND a rationale exists — and even then, pair it with a distinct display face or a distinct weight/tracking treatment.

| Product type | Display character | Body character | Anti-pattern to avoid |
|---|---|---|---|
| saas | grotesk or geometric sans, tighter tracking | humanist or neo-grotesk sans | Inter for both, one weight |
| marketplace | warm sans or characterful grotesk | highly legible sans | slate + Inter, no display face |
| fintech | precise grotesk, can be a serif display | neo-grotesk sans, tabular numerals | generic "trustworthy blue + Inter" |
| devtools | sharp grotesk, mono accents | neo-grotesk sans + a real mono | mono everywhere, no hierarchy |
| mobile-consumer | rounded or expressive display | platform-native or near-native sans | tiny type, one weight |
| internal-admin | functional sans | functional sans, tabular numerals | acceptable to be restrained — but still set tracking + weight intentionally |
| content | a serif or distinctive display | a reading-optimized serif or humanist sans | sans-only, no editorial voice |
| ecommerce | characterful display | clean sans | generic "shop" sans, no personality |

State which source won (heuristic vs corpus leading edge).

### 2. Derive the modular scale

Pick a scale ratio and emit the size ladder — distinct named steps, not arbitrary px:

- Ratio: `1.2` (minor third, dense), `1.25` (major third, balanced), `1.333` (perfect fourth, editorial/airy), or a custom ratio justified by the corpus.
- Steps: from caption up through display — name each (`caption`, `body`, `body-lg`, `h3`, `h2`, `h1`, `display`).
- Note the base size (usually `body`) and how the scale is computed from it.

### 3. Derive the weight ladder

Tell T12 is one-weight typography carrying the whole hierarchy. Emit a deliberate weight ladder:

- Which weights are in play (e.g. `400 / 500 / 700`) and the role of each.
- Which weight the display face uses vs the body face.
- Tracking (letter-spacing) adjustments per size — display sizes usually tighten, caption sizes sometimes open up.

### 4. Set line-height and measure rules

- Line-height per size band — display tight (~1.05–1.15), body comfortable (~1.5–1.6), caption moderate.
- Measure (line length) — target characters-per-line for body and for long-form content; the `max-width` that enforces it.

### 5. Define responsive behavior

- How the scale shifts at mobile widths — usually display steps compress more than body steps.
- Whether `clamp()` fluid type is used and the clamp bounds, or discrete breakpoint steps.
- Minimum body size on mobile (never below ~16px for body to avoid mobile-zoom).

### 6. Corpus-delta benchmark

If `docs/design/trend-<product-type>.md` exists, compare the picked type tokens to the corpus direction: **aligned** / **drifted** / **behind**. If behind (project type is more generic — e.g. Inter-only where the corpus uses a display pairing), flag it as a divergent move.

### 7. Write the typography file

Write `docs/design/typography.md`.

## Output Format

`docs/design/typography.md`:

```markdown
---
generated: 2026-05-13
product-type: marketplace
display-family: Clash Grotesk
body-family: Söhne
corpus-benchmark: docs/design/trend-marketplace.md
---

# Typography — marketplace

## Pairing
**Display:** Clash Grotesk — characterful grotesk, used h1/h2.
**Body:** Söhne — highly legible neo-grotesk, everything else.
Picked: marketplace corpus leading edge (etsy + reverb both pair a display grotesk with a clean body). Inter-only rejected — T1 tell.

## Modular scale
Ratio: 1.25 (major third). Base: body = 16px.
| Step | Size | Family |
|---|---|---|
| caption | 12.8px | body |
| body | 16px | body |
| body-lg | 20px | body |
| h3 | 25px | body (600) |
| h2 | 31px | display |
| h1 | 39px | display |
| display | 49px | display |

## Weight ladder
| Weight | Role |
|---|---|
| 400 | body, captions |
| 600 | h3, emphasis, UI labels |
| 700 | display face — h1/h2/display only |
Tracking: display steps −0.02em; caption +0.01em; body 0.

## Line-height & measure
| Band | Line-height | Measure |
|---|---|---|
| display / h1 / h2 | 1.1 | — |
| h3 / body-lg | 1.35 | — |
| body | 1.55 | 66ch (max-width ~620px) |
| caption | 1.4 | — |

## Responsive behavior
Fluid type via clamp() for display steps: display clamp(32px, 4vw + 1rem, 49px).
Body steps discrete: 16px throughout, never below 16px on mobile.
At <640px: display ladder compresses to ratio 1.2; body ladder unchanged.

## Corpus delta (vs trend-marketplace.md)
| Dimension | Project | Corpus direction | Verdict |
|---|---|---|---|
| Pairing | display grotesk + clean body | display grotesk + clean body | aligned |
| Scale ratio | 1.25 | 1.333 | drifted (slightly denser) |
| Weight spread | 400/600/700 | 400/500/700 | aligned |
```

## Boundaries

- **Specs type, does not build it.** This skill emits the pairing, scale, and rules. The design-system and the implementation apply them.
- **One pairing, not a menu.** The pick is a decision — biased by product type, sharpened by corpus. Do not output "Inter or a grotesk, your call."
- **Inter-only is a flag, not a default.** Defaulting to a single system/neutral sans with no display face and no rationale reproduces tell T1 — only valid if the corpus genuinely converges there AND a rationale exists.
- **Corpus half is optional; pairing half is standalone.** No `trend-<type>.md` → pick from the product-type heuristics, note the corpus benchmark was skipped.

## Re-run Behavior

- **Typography file exists:** overwrite if the pairing or corpus changed; otherwise report the existing spec still holds.
- Re-run after `/design-trend-compare` extends the corpus — a sharper corpus can shift the pairing pick or scale ratio.
- Re-run after `/design-system` changes the spacing scale so the type scale stays coherent.

## Auto-chain

- **Consumes:** `docs/design/trend-<product-type>.md` (corpus type direction), `docs/design/corpus/<product-type>/*.md` typography sections, `docs/design/design-system.md` if present.
- **Chained from:** `/design-system` (after tokens), `/visual-mood-board` (type is part of the mood), `/design-trend-compare` (feeds the picked pairing).
- **Feeds:** `/design-system` (consumes the scale + weight ladder), `/anti-generic-design-check` (T1 / T12 tells check against this spec).

## Example Trigger

> "We need a real type system for the marketplace app — and not just Inter again."

→ Product type `marketplace`; pick a display + body pairing (rejecting Inter-only, sharpened by `trend-marketplace.md` if it exists); derive the modular scale and weight ladder; set line-height and measure rules; define responsive behavior; compute the corpus delta; write `docs/design/typography.md`.
