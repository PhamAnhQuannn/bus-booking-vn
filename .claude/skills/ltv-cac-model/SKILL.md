---
name: ltv-cac-model
description: Build LTV:CAC unit-economics model — lifetime value, customer acquisition cost, payback band, ratio target. Outputs to `docs/inception/ltv-cac-<project>.md`. Use when user says "LTV", "CAC", "unit economics", "lifetime value", "/ltv-cac-model", or before fundraising or scaling spend.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /ltv-cac-model — The Three Numbers That Decide If You Have A Business

## Why you'd care

Scaling paid acquisition without a defended LTV:CAC ratio is the fastest way to burn the round on a unit-negative funnel. The model forces the math before the spend ramps.

LTV ≥ 3× CAC, payback ≤ 12 mo, gross margin ≥ 70%. Miss two of three and you're not a SaaS — you're a charity.

## Pre-flight
Run after `/packaging-tiers` + `/gabor-granger-test`. Pairs with `/payback-period-model`, `/runway-model`.

## Inputs
- ARPU per tier (from pricing).
- Monthly churn rate (estimated if pre-launch — back-of-envelope 5-7% B2B SMB / 1-2% B2B mid-market).
- Gross margin (after COGS).
- CAC per channel (paid ads / content / sales / referral).
- Expansion revenue multiplier (NRR from `/expansion-revenue-design`).

## Process
1. **Calculate LTV** — Gross LTV = ARPU × Gross Margin / Monthly Churn. Net LTV adds NRR if known.
2. **Calculate blended CAC** = (sales + marketing spend) / new paying customers in period.
3. **Compute ratio** — LTV : CAC. Target ≥ 3:1. Below 1:1 is bleeding. Above 5:1 means under-investing in growth.
4. **Compute payback** — CAC / (ARPU × gross margin). Target ≤ 12 mo, ideal ≤ 6.
5. **Sensitivity table** — vary churn (3 levels) × CAC (3 levels) → 9 LTV:CAC scenarios.
6. **Cohort math** — model 100 customers acquired Month 0, track revenue + retention out 24 mo.
7. **Channel-level CAC** — break out paid / organic / referral / sales separately. Blended hides bad channels.
8. **Honesty check** — pre-launch numbers are estimates. State explicitly + revisit at 100 paying customers.

## Output
Write `docs/inception/ltv-cac-<project>.md`:

```markdown
# LTV : CAC Model — <project>
**Date:** <YYYY-MM-DD>
**Stage:** <pre-launch estimate / 50+ customer real data>
**Period:** monthly

## Inputs
| Input | Value | Source |
|-------|-------|--------|
| ARPU (Pro tier) | $49 | pricing |
| Gross margin | 70% | cost stack |
| Monthly churn | 5% | estimate (B2B SMB) |
| NRR | 110% | expansion design |
| Blended CAC | $250 | (mktg + sales spend) / new logos |

## LTV calculation
- Gross LTV = $49 × 0.70 / 0.05 = **$686**
- Net LTV (with 110% NRR) = $686 × 1.10 = **$754**

## CAC by channel
| Channel | CAC | % of new logos |
|---------|-----|----------------|
| Paid ads (Meta, Google) | $400 | 30% |
| Content / organic | $50 | 25% |
| Referral | $30 | 25% |
| Outbound sales | $600 | 20% |
| **Blended** | **$250** | 100% |

## Headline ratios
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| LTV : CAC | 3.0 : 1 | ≥ 3:1 | ✓ |
| Payback period | 7.3 mo | ≤ 12 mo | ✓ |
| Gross margin | 70% | ≥ 70% | ✓ |

## Sensitivity table — LTV:CAC under varied churn × CAC
| | CAC $150 | CAC $250 | CAC $400 |
|---|---|---|---|
| Churn 3% | 7.6:1 | 4.6:1 | 2.9:1 |
| Churn 5% | 4.6:1 | 2.7:1 | 1.7:1 |
| Churn 8% | 2.9:1 | 1.7:1 | 1.1:1 |

→ At 5% churn, blended CAC must stay under $230 for healthy ratio.

## Cohort revenue (100 customers, $49 ARPU, 5% churn)
| Month | Surviving | MRR | Cumulative gross profit |
|-------|-----------|-----|-------------------------|
| 0 | 100 | $4,900 | $3,430 |
| 3 | 86 | $4,214 | $13,720 |
| 6 | 74 | $3,626 | $24,500 |
| 12 | 54 | $2,646 | $43,000 |
| 24 | 29 | $1,421 | $66,200 |

## Channel decisions
- ✅ Double down: Referral (CAC $30) + Content (CAC $50)
- 🟨 Cap: Paid ads at $400 CAC — only profitable if Pro tier sold
- 🟥 Halt: Outbound sales at $600 — payback > 17mo, kills cash

## Honesty flags (pre-launch)
- Churn 5% is an estimate from category benchmark; revalidate at 50 paying
- ARPU may be lower than $49 if early customers downgrade to Starter
- NRR 110% assumes expansion features ship by month 6

## Pitfalls flagged
- [ ] Gross margin (not revenue) used in LTV formula
- [ ] CAC broken out per channel, not just blended
- [ ] Sensitivity table at multiple churn levels
- [ ] Cohort revenue modeled out 24 mo
- [ ] Pre-launch numbers explicitly flagged

## Next
- Payback model → `/payback-period-model`
- Cash runway model → `/runway-model`
- Fundraise decision → `/bootstrap-vs-vc-decision`
```

## Verification
- LTV formula uses gross margin + monthly churn.
- CAC broken out per channel.
- LTV:CAC ratio + payback period both reported.
- Sensitivity table 3×3.
- Cohort table out 24 mo.
- Pre-launch assumptions explicitly flagged.
