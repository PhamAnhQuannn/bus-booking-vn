---
name: take-rate-experiment
description: Take-rate (commission %, flat fee, tiered, two-sided fee split) design + A/B test plan for marketplaces. Measures elasticity on both supply and demand sides simultaneously. Outputs to `docs/design/take-rate-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "marketplace", "two-sided", "platform", "take rate", "commission", "fee", "monetize platform", "/take-rate-experiment", or before changing or setting the platform fee.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 3h
  XL: 4h
---

# /take-rate-experiment — Take-Rate Setting & Elasticity Test

Invoke as `/take-rate-experiment`. Defines the platform fee level + structure, then designs a controlled experiment to measure two-sided elasticity. Anchored on Bill Gurley's "A Rake Too Far" (Above the Crowd, 2013) — required reading; Andrew Chen on supply-side disintermediation risk; Sangeet Choudary on monetization timing in *Platform Scale*.

## Why you'd care

Marketplace take rates set wrong by a single percentage point shift the supply-side or demand-side elasticity enough to kill the flywheel. A real two-sided A/B is the only honest way to find the right number.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Read `docs/inception/cold-start-<project>.md` (already past cold-start?).
3. Read `docs/design/supply-balance-<project>.md` if exists.
4. Read `docs/design/cost.md`.

## Inputs
- Current take rate (or "free" — pre-monetization).
- Liquidity state: pre-PMF / PMF / scaling / mature?
- Substitute pricing: what do suppliers earn off-platform?
- Demand-side benchmark: what do buyers pay for substitutes?
- Fee structure today: % of GMV, flat per-transaction, listing fee, subscription, mixed?

## Process
1. **Gurley's three-question audit** (from "A Rake Too Far"):
   - **Q1**: Does platform deliver enough value vs supplier's next-best alternative?
   - **Q2**: Is the rake low enough that supplier still makes more than alternative paths?
   - **Q3**: Is the rake low enough not to invite disintermediation?
2. **Comparator take-rates** (industry benchmarks — varies year to year, refresh annually):
   | Marketplace | Take rate | Structure | Notes |
   |---|--:|---|---|
   | Airbnb | ~14–16% blended | guest service fee + host fee | host 3%, guest 11–14% |
   | Uber | 25–30% | % of fare | varies by region |
   | DoorDash | 15–30% (restaurant), $0–10 (consumer) | % + delivery fee | tiered |
   | Etsy | 6.5% + 0.20 listing + processing | mixed | high friction long-tail |
   | eBay | 10–15% + final-value | % + insertion | category-tiered |
   | Fiverr | 20% from seller + 5.5% from buyer | two-sided % | high |
   | Substack | 10% | % of subscription | simple |
   | Patreon | 5–12% tiered | % + processing | tiered by plan |
   | OfferUp | 5–13% on shipped | % | local free |
   | App Store | 15–30% | % of revenue | tiered by dev size + sub year-2 |
   | Stripe Marketplaces | 0.4% + payment fee | passthrough | infra layer |
3. **Structure choice**:
   - **% of GMV**: scales naturally with order size; demand-elastic; default for most marketplaces
   - **Flat per-transaction**: simpler; favors high-AOV; doesn't scale with order
   - **Tiered** (e.g., 15% under $X, 10% above): rewards larger transactions
   - **Listing fee** (Etsy, eBay insertion): screens out junk; revenue regardless of conversion
   - **Subscription on top** (eBay Stores, Etsy Plus): predictable revenue from heavy users
   - **Two-sided fee** (Airbnb): split incidence to soften per-side perception
   - **Free + ads** (Craigslist, OfferUp): zero rake, monetize attention
4. **Elasticity hypotheses** to test:
   - Supply-side: at fee X, % of suppliers attempting disintermediation = ?
   - Supply-side: at fee X, supplier churn 30-day = ?
   - Demand-side: at fee X (visible to buyer), conversion = ?
   - Demand-side: at fee X, AOV = ?
5. **Experiment design**:
   - **Unit of randomization**: usually new-user cohorts; randomizing existing-supplier rates is dangerous + can be illegal as price discrimination.
   - **Geographic split**: open new market with variant rate; risky because confounds.
   - **Time-based holdout**: phase rollout city by city; observe pre/post.
   - **Sample size**: power calculation for 10% relative lift on key metric — usually requires several weeks at scale.
   - **Guardrail metrics**: supplier 90-day retention, fail rate, NPS, support tickets, disintermediation signals (off-platform contact requests).
6. **Disintermediation defenses** (the higher the rake, the more these matter):
   - Reviews + ratings lock-in (Airbnb)
   - Escrow / payment-hold (only platform pays out)
   - Insurance / trust guarantees
   - Communication monitoring (ToS-allowed only on platform until booking complete)
   - Disintermediation detection ML (block "let's just exchange numbers")
   - Cancellation penalty
7. **Pricing-power signals**: when to RAISE take rate
   - Supplier supply >> demand sustained
   - Suppliers cite "I have to be on X to get business"
   - Switching cost to competitor is high
   - New trust / payments / insurance feature shipped (more value delivered)
8. **Pricing-pressure signals**: when to LOWER take rate
   - Disintermediation rate >10% measured via off-platform request signals
   - Supplier churn rises after fee change
   - Demand conversion drops after fee change
   - Competitor undercuts and steals supply
9. **Anti-patterns**:
   - Setting rake based on what competitor charges, not value delivered (Gurley's #1 mistake)
   - Hiking rake before improving value
   - Raking suppliers and buyers both heavily (double-dipping perceived)
   - Hiding fees until checkout (regulatory + UX risk; FTC drip-pricing rules)
   - Changing rate on existing suppliers without notice
   - A/B testing fee per-user (price discrimination legal landmine)

## Output
Write `docs/design/take-rate-<project>.md`:

```markdown
# Take-Rate Design & Experiment — <project>
**Date:** 2026-05-13

## Current state
- Take rate: 12% from supplier (% of booking)
- Structure: flat % of GMV
- Side: supplier-side only
- Annual GMV: $4.2M; revenue: $504k

## Gurley's three questions
| Q | Answer | Risk |
|---|---|---|
| Does platform deliver value vs supplier alternative? | Yes — payments, trust, discovery, scheduling | LOW |
| Is rake low enough that supplier wins vs alternatives? | Suppliers earn ~$32/hr vs $24/hr off-platform | LOW |
| Is rake low enough not to invite disintermediation? | Off-platform contact attempts measured at 4% | MEDIUM |

## Comparator benchmark
| Co. | Take rate | Structure | Their value adds |
|---|--:|---|---|
| Airbnb | ~14–16% | two-sided | trust, payments, photos, insurance |
| Uber | 25–30% | one-sided | dispatch, payments |
| Etsy | 6.5% + listing | one-sided | discovery, payments |
| TaskRabbit | 15% + 7.5% trust fee | two-sided | screening, insurance |
| Thumbtack | leads-based (~$5–60/lead) | one-sided | discovery only |
| Fiverr | 20% + 5.5% | two-sided | escrow, dispute, discovery |
| Substack | 10% | one-sided | hosting, payments, distribution |

## Recommended structure
- **Primary**: 14% from supplier on GMV
- **Secondary**: $2 buyer trust fee (covers insurance + dispute)
- **Effective blended take**: 14% + 2/AOV ≈ 16%
- **Why**: matches Airbnb pattern; transparent; covers value; not maximal

## Disintermediation defenses to ship before raise
- [ ] Communication on-platform only until booking confirmed
- [ ] Ratings + reviews require completed transaction
- [ ] Insurance offered only via platform booking
- [ ] ML detection of "let's go direct" messages
- [ ] Cancellation penalty 24h pre-service: 50%
- [ ] Off-platform contact rate dashboard

## Experiment design
**Hypothesis:** Raising take rate from 12% to 14% on new-supplier cohorts will yield revenue lift ≥12% with supplier 90-day retention drop ≤5pp.

| Element | Value |
|---|---|
| Randomization unit | new-supplier cohort (signup-week) |
| Control | 12% (current) |
| Variants | 13%, 14%, 15% |
| Allocation | 40/20/20/20 (skew control to detect lift) |
| Primary metric | revenue per supplier first 90d |
| Guardrails | retention 90d, NPS, support tickets, disintermediation rate |
| Sample size needed | ~1,200 new suppliers per arm (per power calc on 10% rel lift, α=0.05, β=0.2) |
| Duration | 12 weeks signups + 12 weeks observation = ~6 mo |
| Stopping rules | guardrail breach: retention drop >5pp or disintermediation >8% → halt |

## Power calculation inputs
- Baseline 90d retention: 55%
- MDE: 5pp absolute drop
- Per-arm sample for α=0.05, β=0.2: ~1,200

## Communication plan
- Existing suppliers: NOT affected (grandfathered)
- New suppliers: see new rate at signup; full transparency
- Public: blog post + comparator table; "We invest the spread in trust and tools"

## Two-sided fee-split rationale
- Buyer fee splits perceived cost; reduces supplier resistance to total rake
- Buyer fee labeled "trust + insurance" — ties to value
- Risk: drip-pricing scrutiny; show all-in price upfront (FTC + state laws)

## KPI dashboard
| KPI | Baseline | Target post-raise |
|---|--:|--:|
| Take rate (blended) | 12% | 14–16% |
| Revenue / supplier 90d | $850 | $980+ |
| Supplier 90d retention | 55% | ≥50% |
| Demand conversion (search→book) | 12% | ≥11% |
| Disintermediation signal | 4% | ≤6% |
| Supplier NPS | 42 | ≥35 |

## Sunset / iterate triggers
- If disintermediation >8% at week 12 → roll back to 12% + invest in defenses
- If supplier retention drops >5pp → roll back; investigate cohort
- If revenue lift <8% (below cost of running test) → roll back
- If lift confirmed → roll out to existing suppliers with 90-day notice + value-add bundle

## Anti-patterns we will NOT do
- Set rake to "match competitor" without value math
- Hike rake before shipping trust/payments improvements
- Hide fees until checkout
- Change rate on existing suppliers without notice
- Per-user price discrimination

## References
- Bill Gurley — "A Rake Too Far: Optimal Platform Pricing Strategy" (2013, Above the Crowd) — required reading
- Andrew Chen — *The Cold Start Problem*, monetization-timing chapter
- Sangeet Choudary — *Platform Scale*, value-capture chapter
- a16z marketplace 100 — annual take-rate benchmarks
- FTC drip-pricing guidance (2024) — disclosure rules
```

## Verification
- Gurley's three questions answered.
- Comparator benchmark ≥5 marketplaces.
- Structure chosen + rationale.
- Disintermediation defenses listed before fee raise.
- Experiment design includes randomization unit, MDE, power calc, guardrails, stopping rules.
- KPI dashboard with baseline + target.
- Anti-pattern section present.
