---
name: willingness-to-pay-test
description: Van Westendorp + Gabor-Granger price elasticity probe — find ceiling, optimal, floor before pricing-model. Outputs to `docs/inception/wtp-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "willingness to pay", "WTP", "price test", "Van Westendorp", "/willingness-to-pay-test", or before `/pricing-model`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /willingness-to-pay-test — Price Elasticity Probe

Invoke as `/willingness-to-pay-test`. Before set price. Ask in survey or interview.

## Why you'd care

Setting price by competitive comparison or cost-plus ignores what the customer actually values. WTP testing returns a ceiling, an optimum, and a floor — the inputs pricing-model needs to be more than guessing.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/buyer-persona-<project>.md` — for sample.
3. Read `docs/inception/cost-model-<project>.md` if exists — floor reference.

## Inputs
- 30+ target buyers (interview or survey).
- Product description (1 paragraph).
- Distribution: Typeform / Google Form / 1-on-1 interview.

## Process
1. **Van Westendorp 4 questions** — per respondent:
   - At what price would this be too expensive? (CEILING)
   - At what price would it be expensive but you'd consider? (PREMIUM)
   - At what price would it be a bargain? (BARGAIN)
   - At what price would it be too cheap (suspect quality)? (FLOOR)
2. **Gabor-Granger ladder** — "would you pay $X?" Y/N at 5 price points.
3. **Plot intersections** — Van Westendorp 4 curves give:
   - Optimal Price Point (OPP) = bargain ∩ premium intersection
   - Indifference Price Point (IPP) = ceiling ∩ floor intersection
   - Range of Acceptable Prices (RAP) = OPP to IPP
4. **Cross-check vs cost** — if floor < unit cost, problem.
5. **Cohort split** — by segment, do prices diverge? (price tier signal).

## Output
Write `docs/inception/wtp-<project>.md`:

```markdown
# Willingness to Pay — <project>
**Date:** <YYYY-MM-DD> | **N respondents:** N | **Method:** <X>

## Van Westendorp results
| Question | Median | Mean | P25 | P75 |
|---|--:|--:|--:|--:|
| Too expensive (ceiling) | $X | $X | $X | $X |
| Expensive (premium) | $X | $X | $X | $X |
| Bargain | $X | $X | $X | $X |
| Too cheap (floor) | $X | $X | $X | $X |

## Intersections
- **OPP (optimal):** $X
- **IPP (indifference):** $X
- **Range of acceptable:** $X – $X

## Gabor-Granger ladder
| Price point | % said YES |
|--:|--:|
| $5 | 95% |
| $15 | 78% |
| $30 | 52% |
| $60 | 21% |
| $120 | 6% |

## Cohort split
- Segment A (N=12): OPP $X
- Segment B (N=18): OPP $X

## Vs cost-model
- Unit cost: $X (must be < floor)
- Margin at OPP: X%

## Verdict
**HEALTHY-MARGIN / TIGHT / UNECONOMIC**

## Pricing recommendation
- Anchor: $X (OPP)
- Tier 1: $X | Tier 2: $X | Tier 3: $X
- Try first: $X (justify)
```

## Verification
- ≥30 respondents (less = noise).
- 4 VW + 5 GG questions all asked (skipping any breaks intersections).
- Cohort split if persona varies (single-cohort can mask).
- Margin computed at OPP.
