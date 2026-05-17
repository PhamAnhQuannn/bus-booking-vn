---
name: payback-period-model
description: Calculate CAC payback period — how many months until a customer earns back their acquisition cost. Outputs to `docs/inception/payback-period-<project>.md`. Use when user says "payback period", "CAC payback", "months to recoup", "/payback-period-model", or before scaling paid acquisition.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /payback-period-model — How Fast Does A Customer Repay Their CAC

If payback > 18 months, you are a bank. SaaS gold standard is ≤ 12 mo, ideal ≤ 6.

## Why you'd care

If CAC payback is longer than your runway, every paid acquisition dollar is killing you faster than it's growing you. This is the gate before scaling spend.

## Pre-flight
Run after `/ltv-cac-model`. Pairs with `/runway-model`, `/cost-model`.

## Inputs
- ARPU per tier.
- Gross margin.
- CAC per channel.
- Discount rate (cost of capital — typically 10-15% annual).

## Process
1. **Simple payback** = CAC / (ARPU × gross margin) — months to break even.
2. **Discounted payback** — discount future cash flows by cost of capital. Adds 5-15% to simple.
3. **By channel** — calculate per acquisition source.
4. **By tier** — calculate per pricing tier.
5. **Worst-case** — assume 2× CAC + 1.5× churn. Does it still pay back inside cash runway?
6. **Decision thresholds:**
   - ≤ 6 mo: scale aggressively
   - 6-12 mo: scale carefully, watch unit econ
   - 12-18 mo: only scale if very strong NRR
   - 18+ mo: not a business, or sales-led with multi-year contracts

## Output
Write `docs/inception/payback-period-<project>.md`:

```markdown
# CAC Payback Period — <project>
**Date:** <YYYY-MM-DD>
**Cost of capital:** 12% / yr (1% / mo)

## Simple payback (per channel × per tier)
| Channel | Tier | ARPU | GM | CAC | Payback (mo) | Verdict |
|---------|------|------|----|----|--------------|---------|
| Referral | Pro | $49 | 70% | $30 | 0.9 | scale |
| Content | Pro | $49 | 70% | $50 | 1.5 | scale |
| Paid ads | Pro | $49 | 70% | $400 | 11.7 | careful |
| Paid ads | Starter | $19 | 70% | $400 | 30 | halt |
| Outbound | Business | $99 | 70% | $600 | 8.7 | scale |
| Outbound | Pro | $49 | 70% | $600 | 17.5 | halt |

## Discounted payback (12% annual)
| Channel/Tier | Simple | Discounted | Delta |
|--------------|--------|------------|-------|
| Referral / Pro | 0.9 | 0.9 | +0.0 |
| Paid / Pro | 11.7 | 12.4 | +0.7 |
| Outbound / Business | 8.7 | 9.1 | +0.4 |

## Worst-case stress (2× CAC, 1.5× churn applied to net LTV recapture)
| Channel/Tier | Normal payback | Stressed payback | Survives? |
|--------------|----------------|-------------------|-----------|
| Referral / Pro | 0.9 | 1.8 | ✓ |
| Content / Pro | 1.5 | 3.0 | ✓ |
| Paid / Pro | 11.7 | 23.4 | ✗ |
| Paid / Starter | 30 | 60 | ✗ |
| Outbound / Business | 8.7 | 17.4 | ✗ marginal |

## Channel × tier scaling decisions
| Channel × Tier | Action |
|----------------|--------|
| Referral / any | Scale up incentives, more reward |
| Content / Pro | Invest, hire writer |
| Paid / Pro | Cap at current spend until payback < 9 mo |
| Paid / Starter | Halt immediately |
| Outbound / Business+ | Continue, requires multi-year deal |
| Outbound / Pro or Starter | Halt — wrong fit |

## Cash runway implication
- Need $X cash to fund Y new customers before they repay
- Cash needed for 100 new customers × $250 CAC = $25k upfront
- Cash recovered by month 8 (blended payback)
- If runway < 12mo, restrict CAC to channels with < 6mo payback

## Pitfalls flagged
- [ ] Gross margin (not revenue) used in formula
- [ ] Payback computed per channel × per tier (not just blended)
- [ ] Discounted payback shown for high-CAC channels
- [ ] Worst-case stress test included
- [ ] Channel halt criteria explicit

## Next
- Channel mix decision → `/channel-fit-matrix`
- Runway implication → `/runway-model`
- Discount design → `/discount-policy` (annual prepay shortens payback)
```

## Verification
- Simple + discounted payback both shown.
- Per channel × per tier grid (not blended).
- Worst-case stress test (2× CAC, 1.5× churn).
- Scale / careful / halt decisions per channel × tier.
- Cash runway implication tied in.
