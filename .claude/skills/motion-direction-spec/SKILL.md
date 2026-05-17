---
name: motion-direction-spec
description: Pick a motion personality for the project AUTONOMOUSLY (snappy / smooth / playful / restrained / mechanical) segmented by product type, then emit concrete easing curves, a duration scale, per-interaction choreography rules, and the reduced-motion fallback. Benchmarks against captured market-leader motion tokens when a corpus exists. Triggers on "motion spec", "how should things animate", "/motion-direction-spec", or auto-chains from /design-system and /visual-mood-board.
output_size:
  XS: skip
  S: ~15min — personality pick + easing/duration tables, no corpus
  M: ~30min — personality + choreography map + corpus benchmark
  L: ~1h — full choreography per interaction + corpus delta + reduced-motion audit
  XL: ~1.5h — multi-surface motion system + corpus delta + handoff-ready tokens
---

# /motion-direction-spec — Motion personality + choreography spec

## Why you'd care

Motion picked ad-hoc per screen produces a product that feels jittery and inconsistent — and reduced-motion users either get sick or have to disable everything. A defined motion personality + easing scale is the difference between polish and noise.

Decide how the product moves. Most AI-built UIs either have no motion at all or fall back to the generic `150ms / 250ms / 400ms ease` stack with no personality — tell T8 of the genericness checklist. This skill makes motion an intentional, product-type-segmented decision: it picks one motion personality, derives the easing and duration tokens from it, maps choreography to each interaction class, and specifies the reduced-motion fallback. The output is a token set the design-system and the build consume directly — not a vague "add some animation."

## When This Skill Applies

- User says "motion spec", "how should things animate", "what's our animation style", "/motion-direction-spec".
- Auto-chained from `/design-system` (after tokens are produced) and `/visual-mood-board` (motion is part of the mood).
- Before or alongside `/mobile-native-ui-patterns` when transition choreography needs a defined personality to reference.
- NOT for: capturing a product's motion tokens (`/web-design-capture`), picking the overall direction (`/design-trend-compare`), or auditing genericness (`/anti-generic-design-check`).

## Prerequisites

- **Product type** — selects the motion personality segment. One of: `saas`, `marketplace`, `fintech`, `devtools`, `mobile-consumer`, `internal-admin`, `content`, `ecommerce`.
- **Corpus benchmark (optional but recommended)** — `docs/design/trend-<product-type>.md` from `/design-trend-compare`, or raw `docs/design/corpus/<product-type>/*.md` motion sections. Without it, the personality pick still runs from the product-type heuristics below; the corpus-delta step is skipped.
- **Design system (optional)** — `docs/design/design-system.md` if it exists, so motion tokens slot into the same scale language.

## Steps

### 1. Pick the motion personality

Choose exactly one personality. The pick is autonomous — biased by product type, sharpened by the corpus if present.

| Personality | Feels like | Default-fits product types | Easing character |
|---|---|---|---|
| snappy | fast, decisive, no lag | devtools, internal-admin, fintech | short durations, ease-out dominant |
| smooth | calm, premium, continuous | saas, content, fintech | medium durations, ease-in-out, gentle |
| playful | bouncy, characterful, alive | mobile-consumer, marketplace, ecommerce | spring / overshoot easing |
| restrained | barely-there, utilitarian | internal-admin, devtools | minimal motion, opacity/position only |
| mechanical | precise, linear, instrument-like | devtools, fintech dashboards | linear or near-linear easing |

If a corpus exists, override the heuristic default when the corpus leading edge clearly diverges (e.g. a marketplace corpus that converges on `smooth` beats the `playful` heuristic). State which source won.

### 2. Derive the easing curves

From the personality, emit a small named easing set — not the browser defaults:

- `ease-standard` — the workhorse for most transitions.
- `ease-enter` — elements appearing (decelerate into place).
- `ease-exit` — elements leaving (accelerate out).
- `ease-emphasis` — the one signature curve (spring/overshoot for playful, sharp ease-out for snappy, etc.).

Give each a concrete `cubic-bezier()` (or spring config). No `ease`, `ease-in-out` keyword-only specs.

### 3. Derive the duration scale

Emit a duration ladder tied to the personality, not the generic 150/250/400:

- `instant` — micro-feedback (hover, press).
- `quick` — small element transitions.
- `moderate` — panel / card / route-level transitions.
- `deliberate` — large surface or onboarding moments.

Snappy compresses the ladder; smooth and playful stretch it; restrained collapses it toward `instant`/`quick` only.

### 4. Map choreography per interaction class

For each interaction class, specify what animates, with which token, and what explicitly does NOT animate:

- **Hover / focus / press** — micro-feedback.
- **Element enter / exit** — list/card/toast appearance and removal.
- **Panel / modal / drawer** — overlay surfaces.
- **Route / view transition** — page-level.
- **Stagger** — when a group enters, the stagger interval and cap (and when NOT to stagger).
- **State / value change** — number tickers, progress, skeleton→content.

State the rule, not just the token: e.g. "lists stagger at 30ms/item, cap 8 items, no stagger on re-render — only first mount."

### 5. Specify the reduced-motion fallback

`prefers-reduced-motion: reduce` is mandatory. Specify per interaction class: what degrades to an instant state change, what keeps a minimal opacity fade, what is removed entirely. Reduced-motion is not "turn it all off" — it's a parallel, calmer choreography.

### 6. Corpus-delta benchmark

If `docs/design/trend-<product-type>.md` exists, compare the picked motion tokens to the corpus direction: **aligned** / **drifted** / **behind**. If behind (project motion is more generic / absent than the market direction), flag it as a divergent move.

### 7. Write the motion file

Write `docs/design/motion.md`.

## Output Format

`docs/design/motion.md`:

```markdown
---
generated: 2026-05-13
product-type: marketplace
personality: playful
corpus-benchmark: docs/design/trend-marketplace.md
---

# Motion direction — marketplace

## Personality
**playful** — bouncy, characterful. Picked: marketplace heuristic + corpus leading edge (mercari, etsy captures both use spring easing on card interactions).

## Easing tokens
| Token | cubic-bezier / spring | Use |
|---|---|---|
| ease-standard | cubic-bezier(.2,.0,.0,1) | most transitions |
| ease-enter | cubic-bezier(.0,.0,.2,1) | elements appearing |
| ease-exit | cubic-bezier(.4,.0,1,1) | elements leaving |
| ease-emphasis | spring(1, 90, 12, 0) | signature — card press, add-to-cart |

## Duration scale
| Token | Value | Use |
|---|---|---|
| instant | 80ms | hover, press feedback |
| quick | 160ms | small element transitions |
| moderate | 280ms | panels, cards, modals |
| deliberate | 460ms | route transitions, onboarding |

## Choreography map
| Interaction | Animates | Token | Does NOT animate |
|---|---|---|---|
| Hover / press | scale + shadow | instant + ease-standard | color (instant swap) |
| Card enter | opacity + translateY 8px | quick + ease-enter | layout reflow |
| Modal | opacity + scale .98→1 | moderate + ease-emphasis | backdrop (instant 60% fade) |
| Route | crossfade | moderate + ease-standard | — |
| Stagger | list items | 30ms/item, cap 8, first mount only | re-renders |
| Value change | number ticker | quick + ease-standard | — |

## Reduced-motion fallback
| Interaction | prefers-reduced-motion: reduce |
|---|---|
| Hover / press | keep (non-vestibular) |
| Card enter | opacity only, no translate |
| Modal | opacity only, no scale |
| Route | instant swap |
| Stagger | removed — all appear together |
| Value change | instant set, no ticker |

## Corpus delta (vs trend-marketplace.md)
| Dimension | Project | Corpus direction | Verdict |
|---|---|---|---|
| Presence | moderate | moderate | aligned |
| Easing | spring emphasis | spring emphasis | aligned |
| Duration band | 80–460ms | 200–350ms | drifted (slightly slower) |
```

## Boundaries

- **Specs motion, does not build it.** This skill emits tokens and choreography rules. The design-system and the implementation apply them.
- **One personality, not a menu.** The pick is a decision — biased by product type, sharpened by corpus. Do not output "snappy or smooth, your call."
- **Reduced-motion is mandatory, not optional.** A motion spec without the `prefers-reduced-motion` fallback is incomplete — do not write the file without it.
- **Corpus half is optional; personality half is standalone.** No `trend-<type>.md` → pick from the product-type heuristics, note the corpus benchmark was skipped.

## Re-run Behavior

- **Motion file exists:** overwrite if the personality or corpus changed; otherwise report the existing spec still holds.
- Re-run after `/design-trend-compare` extends the corpus — a sharper corpus can shift the personality pick or the duration band.
- Re-run after `/design-system` changes the scale language so motion tokens stay coherent with spacing/radius scales.

## Auto-chain

- **Consumes:** `docs/design/trend-<product-type>.md` (corpus motion direction), `docs/design/corpus/<product-type>/*.md` motion sections, `docs/design/design-system.md` if present.
- **Chained from:** `/design-system` (after tokens), `/visual-mood-board` (motion is part of the mood), `/design-trend-compare` (feeds the picked direction).
- **Feeds:** `/mobile-native-ui-patterns` (transition choreography references this), `/anti-generic-design-check` (T8 motion tell checks against this spec).

## Example Trigger

> "We've got the marketplace design system — now how should the thing actually move?"

→ Product type `marketplace`; pick personality (`playful`, sharpened by `trend-marketplace.md` if it exists); derive easing + duration tokens; map choreography per interaction class; specify the reduced-motion fallback; compute the corpus delta; write `docs/design/motion.md`.
