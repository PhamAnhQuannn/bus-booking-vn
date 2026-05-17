---
name: pre-sale-test
description: Charge real money pre-launch — Stripe pre-order, Kickstarter, deposit. CC at risk = real demand. Outputs to `docs/inception/pre-sale-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "pre-sale", "pre-order", "Kickstarter", "deposit test", "/pre-sale-test", or after `/landing-page-test` strong.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /pre-sale-test — Real Money Pre-Launch

Invoke as `/pre-sale-test`. Email signup = $0. CC = $$$.

## Why you'd care

Surveys lie; credit cards don't. Charging real money before you build is the cheapest, most honest demand signal available — and the receipts double as proof for the next investor conversation.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/landing-test-<project>.md` — landing must convert ≥5% first.
3. Read `docs/inception/pricing-model-<project>.md` if exists.

## Inputs
- Pre-sale price (recommend lifetime / founders / 50%-off).
- Launch ETA (must commit + honor).
- Refund policy (full refund within 30 days = de-risks buyer).
- Payment processor (Stripe Checkout / Lemon Squeezy / Gumroad).

## Process
1. **Set up payment** — Stripe Checkout link or Gumroad page. Charge full or deposit.
2. **Update landing** — replace "Join waitlist" with "Pre-order $X (refundable)".
3. **Risk reversal** — display: refund anytime, ETA stated, founder commitment.
4. **Drive same traffic** as landing-test.
5. **Track**:
   - Visits → checkout init → completed pay → refund.
6. **Real conversion benchmark**:
   - ≥1% visit→pay = strong demand
   - ≥0.3% = OK if niche / high price
   - <0.1% = no demand
7. **Honor commitment** — build by ETA or refund proactively.

## Output
Write `docs/inception/pre-sale-<project>.md`:

```markdown
# Pre-Sale Test — <project>
**Date:** <YYYY-MM-DD> to <YYYY-MM-DD> | **Price:** $X | **ETA:** <date>

## Offer
- Product: <X>
- Pre-sale price: $X (full / deposit $Y)
- Refund: 30-day no-questions
- ETA: <date>

## Funnel
| Stage | N | % |
|---|--:|--:|
| Visitors | 500 | 100% |
| Checkout init | 25 | 5% |
| Paid | 8 | 1.6% |
| Refunded | 1 | 0.2% |

## Revenue
- Gross: $X
- Net (after refund): $X
- Buyers (named, with email): N

## Per-buyer follow-up
- Sent thank-you + roadmap: N
- Replied with feature requests: N
- Top requests: <list>

## Verdict
**PAID-DEMAND-PROVEN / MARGINAL / NO-DEMAND**

## Commitment
- [ ] Build by ETA (or refund all)
- [ ] Weekly update to buyers
- [ ] Public roadmap
```

## Verification
- Real money charged (test mode = no signal).
- ETA committed AND honored (broken promise = brand damage).
- Refund policy displayed prominently (else conv suppressed).
- ≥500 visits (small sample = noise).
