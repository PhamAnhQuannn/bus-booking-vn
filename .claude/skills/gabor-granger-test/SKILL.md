---
name: gabor-granger-test
description: Gabor-Granger price-laddered purchase intent test — find revenue-maximizing price. Outputs to `docs/inception/gabor-granger-<project>.md`. Use when user says "Gabor-Granger", "price ladder", "willingness to pay ladder", "price optimization", "/gabor-granger-test", or after `/van-westendorp-survey` narrows range.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /gabor-granger-test — Pin The Number Inside The Range

## Why you'd care

Pricing left on gut feel typically leaves 20–40% revenue on the table or chokes adoption with a price the market won't bear. A laddered price test produces an actual demand curve before you commit to a pricing page.

VW tells you the window. GG tells you the price that maximizes expected revenue inside it.

## Pre-flight
Run after `/van-westendorp-survey`. Pairs with `/pricing-model`.

## Inputs
- VW output: PMC (floor) + PME (ceiling).
- Concrete product offer (same as VW).
- ICP panel n ≥ 60.

## Process
1. **Build price ladder** — 5-7 prices across VW range (e.g., $19, $29, $39, $49, $69, $89, $129). Randomize start price per respondent to remove anchoring.
2. **Single question, repeated**: "Would you buy <product> at <$X>? Yes / No / Maybe."
3. **Descend or ascend** per respondent until a No. Record top price they said Yes.
4. **Build demand curve** — % saying Yes at each price.
5. **Revenue curve** = price × % Yes at price. Peak = revenue-optimum price.
6. **Sanity-check vs LTV/CAC** — even if GG peak is $X, ensure CAC payback ≤ <12 mo. `/payback-period-model`.
7. **Validate qualitatively** — show top 3 ladder prices to 5 prospects. Ask "what would you expect at $X?" — features expectations rise with price.

## Output
Write `docs/inception/gabor-granger-<project>.md`:

```markdown
# Gabor-Granger Test — $<project>
**Date:** <YYYY-MM-DD>
**Sample size:** n = <X>
**VW range from prior step:** $<PMC> — $<PME>
**Price ladder:** $19 / $29 / $39 / $49 / $69 / $89 / $129
**Randomized start prices:** Y/N

## Demand curve
| Price | % Yes | % Maybe | % No |
|-------|-------|---------|------|
| $19 | 92% | 5% | 3% |
| $29 | 78% | 12% | 10% |
| $39 | 61% | 18% | 21% |
| $49 | 44% | 22% | 34% |
| $69 | 23% | 19% | 58% |
| $89 | 11% | 12% | 77% |
| $129 | 3% | 6% | 91% |

## Expected revenue curve (price × %Yes)
| Price | Expected $/respondent |
|-------|-----------------------|
| $19 | $17.48 |
| $29 | $22.62 |
| $39 | $23.79 |
| $49 | $21.56 |
| $69 | $15.87 |
| $89 | $9.79 |
| $129 | $3.87 |

**Revenue-optimum price:** $<X> (here: $39)
**Penetration-optimum price:** $<X> (here: $19 → highest adoption)

## Sensitivity sanity check
| Scenario | Price | % conversion | Revenue / 100 leads |
|----------|-------|--------------|---------------------|
| Aggressive growth | $19 | 92% | $1,748 |
| Balanced | $39 | 61% | $2,379 |
| Premium | $69 | 23% | $1,587 |

## CAC payback sanity (cross-ref `/ltv-cac-model`)
| Price | LTV (24mo) | CAC | Payback |
|-------|-----------|-----|---------|
| $19 | $456 | $200 | 11 mo |
| $39 | $936 | $250 | 6.4 mo |
| $69 | $1,656 | $400 | 5.8 mo |

## Qualitative expectations at top 3 prices
| Price | What 5 prospects expect at this price |
|-------|----------------------------------------|
| $29 | "basic version, no analytics" |
| $39 | "core + integrations" |
| $69 | "white-glove onboarding + SLA" |

## Pitfalls flagged
- [ ] Randomized start prices
- [ ] Ladder spans VW range, not exceeds
- [ ] Sample ≥ 60, single segment
- [ ] Revenue + penetration curves both reported

## Next
- Apply to pricing page → `/pricing-page-draft`
- Apply to packaging tiers → `/packaging-tiers`
- Re-test at 12 months when product matures
```

## Verification
- 5-7 ladder prices spanning VW range.
- Randomized start to control anchoring.
- Demand + revenue curves both built.
- Optimum + penetration price both stated.
- CAC-payback sanity vs `/ltv-cac-model`.
