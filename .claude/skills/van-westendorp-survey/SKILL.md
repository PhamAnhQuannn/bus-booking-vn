---
name: van-westendorp-survey
description: Run Van Westendorp Price Sensitivity Meter — too cheap / cheap / expensive / too expensive curves. Outputs to `docs/inception/van-westendorp-<project>.md`. Use when user says "Van Westendorp", "PSM", "price sensitivity", "price survey", "/van-westendorp-survey", or before setting list price.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /van-westendorp-survey — Find The Price Window Buyers Accept

VW gives a range, not a number. Pairs with `/gabor-granger-test` to convert range → optimum.

## Why you'd care

Setting list price by founder gut feel is how you discover, after launch, that you priced 30% too low or 50% too high. PSM gives you four curves of buyer perception to anchor against before the price ships.

## Pre-flight
None. Pairs with `/gabor-granger-test`, `/pricing-model`, `/willingness-to-pay-test`.

## Inputs
- Concrete product or fully-spec'd offer (no vapor).
- ICP-qualified survey panel (n ≥ 60, ideal 200+).
- Currency + market context for respondents.

## Process
1. **Write the 4 PSM questions** verbatim:
   - At what price would you consider <product> so expensive that you would not consider buying it? (**Too expensive**)
   - At what price would you consider <product> so inexpensive that you'd question its quality? (**Too cheap**)
   - At what price would <product> start to feel expensive but you'd still consider it? (**Expensive but acceptable**)
   - At what price would <product> feel like a bargain? (**Cheap / good value**)
2. **Show concrete offer** before asking — feature list, screenshots, time-saving claim. PSM on vapor is junk.
3. **Sample size** — 60 minimum, 200+ for confidence. Single ICP segment per run (don't pool SMB + enterprise).
4. **Plot cumulative curves** (% of respondents at or above each price):
   - Too cheap (descending)
   - Cheap (descending)
   - Expensive (ascending)
   - Too expensive (ascending)
5. **Read 4 intersection points:**
   - **PMC (Point of Marginal Cheapness)** = too cheap × cheap → floor
   - **PME (Point of Marginal Expensiveness)** = expensive × too expensive → ceiling
   - **IPP (Indifference Price Point)** = cheap × expensive → "fair" price
   - **OPP (Optimal Price Point)** = too cheap × too expensive → least resistance
6. **Validate with qualitative N=5** — show range to 5 prospects: "Why this number?"
7. **Hand off to `/gabor-granger-test`** to pin specific price within the IPP-OPP band.

## Output
Write `docs/inception/van-westendorp-<project>.md`:

```markdown
# Van Westendorp PSM — <project>
**Date:** <YYYY-MM-DD>
**Sample size:** n = <X>
**Segment:** <single ICP segment, e.g., "seed-stage SaaS eng teams, 10-30 devs">
**Currency:** <USD / EUR>
**Stimulus shown to respondents:**
<concrete offer description + screenshot or 5 bullet feature list>

## The 4 questions (verbatim)
1. Too expensive: "At what price would <product> be so expensive you'd not consider it?"
2. Too cheap: "At what price would <product> be so cheap you'd doubt the quality?"
3. Expensive but acceptable: "At what price would <product> feel expensive but still worth it?"
4. Cheap / bargain: "At what price would <product> be a great deal?"

## Raw stats
| Question | Median | Mean | p25 | p75 |
|----------|--------|------|-----|-----|
| Too expensive | $X | $X | $X | $X |
| Expensive | $X | $X | $X | $X |
| Cheap | $X | $X | $X | $X |
| Too cheap | $X | $X | $X | $X |

## Intersection points
| Point | Value | Meaning |
|-------|-------|---------|
| PMC (floor) | $X | below this, perceived as cheap junk |
| PME (ceiling) | $X | above this, killed deals |
| IPP (fair) | $X | indifference / "fair" price |
| OPP (optimal) | $X | least price resistance |

**Acceptable range:** $<PMC> → $<PME>
**Recommended starting list:** $<near OPP>

## Curve chart
<embed PNG path or ASCII summary of the 4 cumulative curves>

## Qualitative N=5 follow-up
| Tester | Their fair price | Why |
|--------|------------------|-----|
| A | $X | "anchored on Datadog price" |
| B | $X | "save 10 hrs/mo @ $50/hr" |
| C | $X | "already on Sentry $200, can't add more" |
| D | $X | "would pay double if stuck-job alerts work" |
| E | $X | "free tier or nothing" |

## Pitfalls flagged
- [ ] No vapor stimulus
- [ ] Single segment per run
- [ ] n ≥ 60
- [ ] Currency + market specified
- [ ] No suggested price shown (anchoring)

## Next
- Pin optimum → `/gabor-granger-test`
- Apply to pricing page → `/pricing-page-draft`
- Apply to packaging → `/packaging-tiers`
```

## Verification
- 4 questions asked verbatim PSM-style.
- n ≥ 60, single segment.
- 4 intersection points calculated.
- Acceptable range + recommended start price stated.
- Qualitative N=5 follow-up logged.
