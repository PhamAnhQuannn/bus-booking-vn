---
name: free-vs-trial-vs-freemium-pick
description: Pick free / freemium / free-trial / reverse-trial / paid-only — decision framework with conversion benchmarks. Outputs to `docs/inception/free-trial-decision-<project>.md`. Use when user says "freemium", "free trial", "reverse trial", "paid only", "/free-vs-trial-vs-freemium-pick", or before `/pricing-page-draft`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /free-vs-trial-vs-freemium-pick — The Door Strangers Walk Through

## Why you'd care

Pick freemium when reverse-trial would have converted 2x better and you've locked in a model that's hard to change without churning your existing base. The decision framework forces a comparison against benchmarks before the pricing page goes live.

Wrong choice here doubles CAC or kills conversion. Pick once, deliberately.

## Pre-flight
Run after `/packaging-tiers`. Pairs with `/onboarding-flow`, `/pricing-page-draft`.

## Inputs
- Time-to-value (mins to first useful outcome).
- Marginal cost per free user.
- Buyer self-serve vs sales-led (`/gtm-motion-pick`).
- Competitive default in category.

## Process
1. **Map 5 options** with archetype examples:
   - **Free forever (freemium)** — Slack, Notion, Figma. Best when: low marginal cost, viral, network effects.
   - **Free trial (14/30 day)** — Linear, Webflow. Best when: time-to-value < trial length, conversion event reachable.
   - **Reverse trial** — start as Pro free for 14d → drop to free tier. Maximizes activation, increases conversion vs flat freemium.
   - **Paid-only with money-back** — Superhuman early days, premium B2B. Best when: high willingness, premium positioning.
   - **Sales-led demo-first** — enterprise. Best when: contract size > $20k ARR.
2. **Score each option on 6 axes** (1-5):
   - Time-to-value fit
   - Marginal cost per free user
   - Conversion likelihood
   - Brand signal (freemium = mass; paid-only = premium)
   - Sales motion fit
   - Category competitor norm
3. **Run conversion math** — for each option, expected free-to-paid % × CAC × WTP → revenue per 100 visitors. Conversion benchmarks:
   - Freemium: 2-5% free→paid (best-in-class 10%)
   - Free trial: 15-25% (B2B with credit card upfront 40-60%)
   - Reverse trial: 25-35%
   - Paid with money-back: 60-80% retain after pay
4. **Cost model the free tier** — what's the per-user variable cost? If > $0.20/mo and no viral coefficient, freemium kills you.
5. **Decide credit-card-required**:
   - Required: ~3× conversion but ~3× lower trial starts
   - Not required: bigger funnel, more churn
6. **Decide reverse-trial fallback** — Pro features stay visible (locked) after trial, or disappear?

## Output
Write `docs/inception/free-trial-decision-<project>.md`:

```markdown
# Free / Trial / Freemium Decision — <project>
**Date:** <YYYY-MM-DD>
**Time-to-value:** <X min from signup to first outcome>
**Marginal cost per free user:** $<X>/mo (DB rows, SMS, AI tokens, etc.)
**GTM motion:** <self-serve / sales-led>
**Category competitor norm:** <freemium / trial / paid>

## Option scorecard (1-5 each)
| Option | T2V fit | Marginal cost | Conversion | Brand signal | Sales motion | Norm fit | Total |
|--------|---------|---------------|------------|--------------|--------------|----------|-------|
| Freemium | 4 | 2 (SMS cost hurts) | 3 | 3 | 4 | 4 | 20 |
| Free trial 14d | 5 | 5 | 5 | 4 | 5 | 5 | 29 |
| Reverse trial 14d | 5 | 4 | 5 | 4 | 5 | 3 | 26 |
| Paid + money-back | 3 | 5 | 4 | 5 | 3 | 2 | 22 |
| Demo-first | 2 | 5 | 4 | 5 | 2 | 3 | 21 |

**Pick:** Free trial 14d, no credit card required for trial start

## Conversion math (per 100 visitors)
| Option | Trial starts | Free→paid % | Paid customers | Revenue (@ $49) |
|--------|--------------|-------------|----------------|-----------------|
| Freemium | 100 | 3% | 3 | $147 |
| Free trial (no CC) | 30 | 20% | 6 | $294 |
| Free trial (CC required) | 10 | 55% | 5.5 | $269 |
| Reverse trial | 80 | 28% | 22 | $1,078 |
| Paid + money-back | 6 | 70% retain | 4.2 | $206 |

→ Reverse trial actually wins on math; revisit decision.

## Final decision
**Picked:** Reverse trial 14d (start on Pro, drop to Starter free tier after)
**Why:** highest expected revenue, lowest acquisition friction, doesn't kill brand
**Risk:** higher SMS cost during trial — cap at 500 SMS during trial

## Cost guardrails
- Hard cap SMS during trial: 500
- Hard cap AI calls during trial: 1000
- Auto-throttle if free user exceeds

## Free-tier "stickiness" rules (post-trial)
- Pro features show as locked, not hidden (visible upgrade path)
- One feature per week prompted in-app (not email spam)
- Annual deal offered at day 7 of free tier (5% who didn't convert at trial-end will at day 7)

## Pitfalls flagged
- [ ] Marginal cost calc includes SMS / AI / human support time
- [ ] Conversion math shown for all 5 options, not just picked
- [ ] CC requirement decided + justified
- [ ] Cost guardrails on free tier

## Next
- Trial-to-paid funnel → `/onboarding-flow`
- Pricing page → `/pricing-page-draft`
- Trial expiry email sequence → `/transactional-email`
```

## Verification
- 5 options scored on 6 axes.
- Conversion math per 100 visitors for all 5.
- CC-required decision made + reasoned.
- Free-tier cost guardrails set.
- Reverse-trial fallback policy explicit.
