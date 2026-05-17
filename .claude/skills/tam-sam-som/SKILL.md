---
name: tam-sam-som
description: TAM/SAM/SOM market sizing — top-down + bottom-up triangulation. Outputs to `docs/inception/tam-sam-som-<project>.md`. Use when user says "TAM SAM SOM", "TAM", "SAM", "SOM", "market size", "market sizing", "how big is the market", "/tam-sam-som", "/market-sizing", or before `/pitch-deck-narrative` or `/sequoia-deck-skeleton`. Subsumes deprecated `/market-sizing`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /tam-sam-som — Market Sizing With Two Methods

One number is a guess. Two methods that converge is a sizing.

## Why you'd care

Top-down-only sizing inflates numbers that investors immediately discount; bottom-up-only sizing looks naïve. Triangulating both is what survives the slide-three skepticism.

## Pre-flight
None. Feeds `/beachhead-segment-pick`, `/ltv-cac-model`, pitch deck market slide.

## Inputs
- Problem definition (`problem-statement-doc`).
- Persona / ICP rough cut.
- Pricing rough number (or assumption).

## Process
1. **Define units** — what's one "customer"? (seat, account, household, transaction). State explicitly.
2. **TAM (top-down)** — total population × average revenue per unit. Cite source (analyst report, gov stat, industry filing). $/year.
3. **TAM (bottom-up)** — count addressable accounts × price × attach rate. Build from primitives.
4. **Triangulate** — if top-down and bottom-up are off by > 3×, one is wrong. Find the error.
5. **SAM** — subset of TAM you could realistically sell to: geography, language, regulation, channel access. State filters.
6. **SOM** — what you can capture in 3 years given your channel, team, capital. Be honest — usually < 1% of SAM year-1.
7. **Sanity check** — is SOM achievable at planned CAC? Cross-ref `/ltv-cac-model`.
8. **Source log** — every number has a citation or a stated assumption.

## Output
Write `docs/inception/tam-sam-som-<project>.md`:

```markdown
# TAM / SAM / SOM — <project>
**Date:** <YYYY-MM-DD>

## Unit
- One customer = <seat / account / household>
- Price assumption: $<X>/unit/year

## TAM — top-down
- Population: <N> (source: <citation>)
- ARPU: $<X> (source: <citation>)
- **TAM: $<X>B/year**

## TAM — bottom-up
- Addressable accounts: <N> (method: <how counted>)
- Price: $<X>
- Attach rate assumption: <X>%
- **TAM: $<X>B/year**

## Triangulation
- Top-down vs bottom-up ratio: <X>×
- Reconciled TAM: $<X>B
- Discrepancy explained: <reason>

## SAM
**Filters applied:**
- Geography: <regions>
- Language: <list>
- Regulation: <which segments excluded>
- Channel reach: <which segments reachable>

**SAM: $<X>M/year**

## SOM (3-year capture)
- Year 1: <X>% of SAM = $<Y>M
- Year 2: <X>% of SAM = $<Y>M
- Year 3: <X>% of SAM = $<Y>M

**Implied logo count year-3: <N> customers**

## CAC check
- Implied customers year-3: <N>
- CAC budget needed: $<X> total
- Cross-ref: `/ltv-cac-model`

## Sources
| Number | Source | Year |
|--------|--------|------|
| Population | <citation> | <yr> |
| ARPU | <citation> | <yr> |
| Attach rate | <assumption based on...> | — |

## Next
- Pick first segment → `/beachhead-segment-pick`
- Pricing detail → `/pricing-page-draft`
- Deck slide → `/sequoia-deck-skeleton`
```

## Verification
- Two methods (top-down + bottom-up) both present.
- Triangulation discrepancy explained.
- SAM filters stated.
- SOM ≤ 5% of SAM in year-1 (sanity).
- Every number has source or stated assumption.
