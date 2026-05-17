---
name: anti-generic-design-check
description: Audit your own design against a 13-tell generic checklist (default fonts, slate-only palette, single accent, KPI-grid headline, uniform radius, no motion, gradient-blob hero, etc.) and benchmark it against the captured market-leader corpus. Emits a genericness score plus the specific divergent moves to make. Triggers on "is this design generic", "does this look like every AI app", "/anti-generic-design-check", or auto-chains from /design-review and /design-system.
output_size:
  XS: skip
  S: ~15min — checklist-only audit of a design spec, score + action list
  M: ~30min — checklist + corpus-delta against one product type
  L: ~1h — live browser_evaluate audit of the built app + full corpus delta
  XL: ~2h — multi-surface live audit + corpus delta + prioritized rework plan
---

# /anti-generic-design-check — Audit own design vs the genericness checklist

## Why you'd care

If your app looks like every other AI product on Product Hunt, no amount of feature depth saves the demo — users bounce before they parse. This checklist names the 13 specific tells and gives you concrete divergent moves instead of "make it pop."

Score the project's own design against the 13 tells of "looks like every AI product," and benchmark it against the captured market-leader corpus for its product type. The output is a genericness score plus a concrete, prioritized list of divergent moves — not a vague "make it pop." This skill exists because the UI/UX skills used to prescribe generic defaults (Inter, slate, 12-col grid, KPI headline) and had no mechanism to detect their own sameness.

## When This Skill Applies

- User says "is this design generic", "does this look like every AI app", "make it less generic", "/anti-generic-design-check".
- Auto-chained from `/design-review` (every design review runs the genericness audit) and after `/design-system` produces tokens.
- After `/ui-wireframe` or `/dashboard-layout` to catch generic layout composition early.
- NOT for: capturing reference products (`/web-design-capture`) or picking the modern direction (`/design-trend-compare`) — this skill audits what you already have.

## Prerequisites

- **Audit target** — one of:
  - `docs/design/*` specs (design-system.md, wireframes, dashboard layout) — checklist half works on specs alone.
  - A running app — `browser_evaluate` reads computed styles live (Playwright MCP). Best signal.
- **Corpus benchmark (optional but recommended)** — `docs/design/trend-<product-type>.md` from `/design-trend-compare`. Without it, the checklist half still runs standalone; the corpus-delta half is skipped.
- Know the project's **product type** so the corpus benchmark uses the right segment.

## Steps

### 1. Gather the project's current design tokens

- If auditing specs: read `docs/design/design-system.md` + any wireframe/layout specs; extract the token set.
- If auditing the running app: `browser_navigate` to it, `browser_evaluate` the same token-extraction payload `/web-design-capture` uses (color frequency, font families/weights, size scale, spacing, radius set, shadow set, motion, layout metrics, component computed styles).

### 2. Score the 13-tell generic checklist (T1–T13)

For each tell: **pass** (divergent / intentional) or **flag** (generic).

| # | Tell | Flag when |
|---|---|---|
| T1 | Default font | Inter / Geist / system-ui as the only family, no display face, no rationale |
| T2 | Slate-only neutrals | slate/zinc/gray the entire neutral ramp, no warmth, no tint |
| T3 | Single safe accent | one purple or blue accent, no secondary, no per-type rationale |
| T4 | KPI-grid headline | the page opens with a row of 3-5 stat cards by default |
| T5 | Rigid 12-col symmetric grid | everything on the same centered symmetric grid, no asymmetry |
| T6 | Uniform radius | `rounded-2xl` (or one radius) on every element regardless of role |
| T7 | Generic shadow stack | only `rgba(0,0,0,0.x)` soft shadows, no colored/inset/flat variation |
| T8 | No / generic motion | no motion at all, or the default 150/250/400ms with no personality |
| T9 | Gradient-blob hero | hero is a gradient mesh / blob behind centered text |
| T10 | Centered max-w everything | every section is `max-w-7xl mx-auto`, no full-bleed, no break-out |
| T11 | Emoji-as-icon | emoji standing in for an icon system |
| T12 | One-weight typography | a single font-weight carries the whole hierarchy |
| T13 | No layout personality | every screen is cards-in-a-grid, no editorial / dense / asymmetric move |

### 3. Compute the genericness score

`genericness = (flagged tells / 13)`. Bands:

- **0.00–0.15** distinctive — ship it.
- **0.16–0.38** mostly fine — address the flagged tells.
- **0.39–0.61** generic-leaning — meaningful rework needed.
- **0.62+** "same AI product" — the design needs a direction reset; route back to `/design-trend-compare`.

### 4. Corpus-delta benchmark

If `docs/design/trend-<product-type>.md` exists, compare the project's tokens to the auto-picked direction dimension by dimension. For each dimension: **aligned** / **drifted** / **behind** (project is more generic than the corpus direction). The corpus delta catches genericness the 13-tell checklist can't — e.g. tokens that are individually "fine" but collectively lag where market leaders are.

### 5. Emit the divergent-moves action list

For every flagged tell and every drifted/behind dimension, write a **concrete** move — not "add personality." E.g.:

- T1 flagged → "Pair a display grotesk (e.g. from the fintech corpus direction) with the body face; reserve it for h1/h2."
- T6 flagged → "Differentiate radius by role: pill buttons, 6px cards, sharp inputs — per the corpus pick."

Prioritize: corpus-`behind` dimensions first (you're losing to the market), then high-visibility tells (T1, T3, T9, T13), then the rest.

### 6. Write the audit file

Write `docs/design/anti-generic-audit.md`.

## Output Format

`docs/design/anti-generic-audit.md`:

```markdown
---
audited: 2026-05-13
target: docs/design/design-system.md
product-type: marketplace
corpus-benchmark: docs/design/trend-marketplace.md
genericness-score: 0.46
band: generic-leaning
---

# Anti-generic design audit

## 13-tell checklist
| # | Tell | Result | Note |
|---|---|---|---|
| T1 | Default font | flag | Inter only, no display face |
| T2 | Slate-only neutrals | flag | full slate ramp |
| T3 | Single safe accent | pass | rose accent + warm secondary, intentional |
| ... | | | |

Genericness score: 0.46 — generic-leaning. Meaningful rework needed.

## Corpus delta (vs trend-marketplace.md)
| Dimension | Project | Corpus direction | Verdict |
|---|---|---|---|
| Palette | slate + rose | tinted-warm neutral + dual accent | behind |
| Type | Inter 400-700 | grotesk display + Inter body | behind |
| Radius | uniform 16px | mixed pill/6px | drifted |
| ... | | | |

## Divergent moves (prioritized)
1. [behind] Replace slate ramp with the warm-tinted neutral from trend-marketplace.md.
2. [behind] Add a display grotesk for h1/h2 — see typography corpus pick.
3. [T6] Differentiate radius by role: pill buttons, 6px cards, sharp inputs.
4. ...
```

## Boundaries

- **Audits, does not rewrite.** This skill scores and lists moves. `/design-system` (and the design work itself) applies them.
- **Checklist half is standalone; corpus half needs the corpus.** No `trend-<type>.md` → run checklist only, note the corpus benchmark was skipped.
- **A "pass" requires intentionality.** A non-default choice that's still arbitrary is not a pass — the rationale must exist (in the spec, or from the corpus direction).
- **Score is a signal, not a gate.** It does not block; it routes. 0.62+ routes back to `/design-trend-compare` for a direction reset.

## Re-run Behavior

- **Audit file exists:** overwrite with the new audit; the `audited:` date and score track progress across iterations.
- Re-run after applying divergent moves — the score should drop. If it doesn't, the moves were cosmetic.
- Auto-chained re-runs from `/design-review` keep the score current as the design evolves.

## Auto-chain

- **Consumes:** `docs/design/trend-<product-type>.md` (from `/design-trend-compare`), `docs/design/design-system.md` + wireframe/layout specs, or a live app via Playwright `browser_evaluate`.
- **Chained from:** `/design-review` (mandatory — every review runs this), `/design-system` (after tokens are produced), `/ui-wireframe`, `/dashboard-layout`.
- **Routes to:** `/design-trend-compare` when the score is 0.62+ (direction reset needed).

## Example Trigger

> "We've got the marketplace design system drafted — does it just look like every other AI app?"

→ Read `docs/design/design-system.md`; score the 13-tell checklist; if `docs/design/trend-marketplace.md` exists, compute the corpus delta; emit a prioritized divergent-moves list; write `docs/design/anti-generic-audit.md`; if score ≥0.62, route back to `/design-trend-compare`.
