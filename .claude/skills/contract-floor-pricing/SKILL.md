---
name: contract-floor-pricing
description: Set absolute price floors per contract — minimum ARR, minimum seats, refusal triggers. Outputs to `docs/inception/contract-floor-<project>.md`. Use when user says "contract floor", "minimum ARR", "minimum deal size", "won't go below", "/contract-floor-pricing", or after `/discount-policy`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /contract-floor-pricing — The Number You Walk Away At

## Why you'd care

The deal you sign 30% below floor "just this once" is the deal that quietly funds your competitor's growth — every hour of support eats the margin, and the customer churns anyway because they were already shopping on price. Setting a number you'll walk away at before the customer asks is what turns negotiation from improv into discipline.

Below the floor, the deal costs you. Decide the number before the customer asks.

## Pre-flight
Run after `/packaging-tiers` + `/discount-policy`. Pairs with `/ltv-cac-model`, `/payback-period-model`.

## Inputs
- CAC per channel (from `/cac-model` if exists, else estimate).
- COGS per customer (infra + support + integrations).
- Acceptable payback period (default ≤ 18 mo, ideally ≤ 12).
- Minimum support load per customer.

## Process
1. **Cost-stack a customer** — variable cost per month:
   - Infra (DB, compute, AI tokens, SMS, etc.)
   - Support (estimated tickets × time × rate)
   - Integrations / 3rd-party fees
   - Implementation / onboarding amortized
2. **Set absolute floor = 3× COGS** (rough heuristic for 60-70% margin).
3. **Set ARR floor by tier** — never sell Pro for $19 even after discount.
4. **Set walk-away triggers:**
   - Deal below floor
   - Custom terms that erode floor (excessive SLA, custom dev included free)
   - High-touch low-revenue (e.g., wants white-glove onboarding for Starter price)
5. **Special floors for enterprise** — minimum ARR (e.g., $20k) below which we don't quote.
6. **Pilot / POC floor** — never $0; minimum $1k POC if expected ACV > $20k.
7. **Currency floors** — set per major currency, don't auto-FX (rates move).

## Output
Write `docs/inception/contract-floor-<project>.md`:

```markdown
# Contract Floor Pricing — <project>
**Date:** <YYYY-MM-DD>
**Acceptable payback:** ≤ 12 mo (hard); ≤ 18 mo (soft)
**Target gross margin:** 70%

## Per-customer cost stack
| Cost item | $/mo | Notes |
|-----------|------|-------|
| Infra (hosting + DB) | $3 | rough at scale |
| SMS (200 messages avg) | $5 | $0.025 × 200 |
| AI tokens | $2 | per active customer |
| Stripe fees | $1.50 | on $49 |
| Support | $4 | 0.5 tickets × 15min × $30/hr |
| Onboarding amortized | $2 | $24 / 12 mo |
| **Total COGS** | **$17.50** | |
| **Floor at 70% margin** | **$58/mo** | rounded $59 |

## Per-tier floor
| Tier | List | Floor (never below) | Max discount allowed |
|------|------|---------------------|----------------------|
| Starter | $19 | $15 | 21% |
| Pro | $49 | $39 | 20% |
| Business | $99 | $79 | 20% |
| Enterprise | quote | $20k ARR ($1,667/mo) | n/a |

## Walk-away triggers
We do NOT sell when:
- [ ] Asking price < tier floor
- [ ] Asking for SLA we don't offer (99.99%, < 1hr response off-hours)
- [ ] Asking for free custom dev / integration
- [ ] White-glove onboarding requested on Starter / Pro pricing
- [ ] Free pilot longer than 30 days
- [ ] Custom MSA changes that void our DPA / SOC 2 scope
- [ ] Wants exclusivity in segment
- [ ] Procurement gauntlet > 3 months with no commitment

## Enterprise floor
- Minimum ARR: $20k ($1,667/mo)
- Below $20k → route to self-serve Business tier
- POC fee: $5k minimum (credited if conversion within 60d)

## Currency floors (set, don't auto-FX)
| Currency | Starter | Pro | Business |
|----------|---------|-----|----------|
| USD | $15 | $39 | $79 |
| EUR | €15 | €39 | €79 |
| GBP | £12 | £35 | £69 |

## Script for walk-aways
> "Our floor on this tier is $X — below that we can't deliver the support level you need. Here's what we can do: <option A: smaller tier> / <option B: smaller scope at floor> / <option C: wait until you're at scale>."

## Pitfalls flagged
- [ ] Floor = 3× COGS minimum
- [ ] No "just this once" deals below floor
- [ ] Enterprise minimum ARR enforced
- [ ] Currency floors set, not FX-derived
- [ ] Walk-away triggers written before first deal
- [ ] Procurement-stall threshold defined

## Next
- Apply to discount policy → `/discount-policy`
- Verify with unit economics → `/ltv-cac-model`, `/payback-period-model`
- Sales script → `/sales-playbook-skeleton`
```

## Verification
- Per-customer COGS itemized.
- Floor per tier set + max discount % derived.
- Walk-away triggers enumerated.
- Enterprise minimum ARR defined.
- Currency floors set (not auto-FX).
- Walk-away script written.
