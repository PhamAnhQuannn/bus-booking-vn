---
name: discount-policy
description: Set discount rules — annual, nonprofit, startup, multi-year, volume, referral. Outputs to `docs/inception/discount-policy-<project>.md`. Use when user says "discount policy", "discount rules", "annual discount", "volume discount", "nonprofit pricing", "/discount-policy", or before any sales conversation.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /discount-policy — Discount Rules Before Anyone Asks For One

## Why you'd care

Without a written policy, the third customer asks for 25% off and the founder caves because the deal feels meaningful — and now there's a precedent the next sales rep will be told about by the customer's friend at a similar-sized company. A discount policy locked before the first sales conversation is what turns "let me check with my CEO" from a power move into a structural answer, and it removes 80% of the negotiating air-time so the founder can spend it on questions that actually shape the deal.

If you don't write the policy, every customer negotiates. Set the rules, then point at them.

## Pre-flight
Run after `/packaging-tiers` + `/pricing-page-draft`. Pairs with `/contract-floor-pricing`.

## Inputs
- List prices per tier.
- Target gross margin.
- Buyer-side budget approval threshold (when does it go to a committee?).

## Process
1. **Enumerate discount lever types:**
   - **Annual prepay** — 10-20% off (industry default 17% = 2 months)
   - **Multi-year** — additional 5-10% for 2-3 year commit
   - **Volume** — 5-15% above N seats/locations/users
   - **Nonprofit / education** — 20-50% off, requires verification
   - **Startup program** — 50% year 1, full price year 2+
   - **Pilot / first-customer** — case-by-case, capped
   - **Referral** — 1 month free / 10% off lifetime
   - **Loyalty / renewal incentive** — only for at-risk renewals
2. **Set max stacking** — usually 1 discount only (otherwise floor erodes).
3. **Set discount floor** — never below $X/mo or $Y/seat. `/contract-floor-pricing`.
4. **Approval ladder:**
   - 0-10% off: rep / self-serve
   - 10-25%: sales lead
   - 25-40%: VP / founder
   - 40%+: founder + finance
5. **Forbidden discounts:**
   - Unconditional "we'll match competitor X"
   - End-of-quarter sales (trains buyers to wait)
   - Lifetime deals after MVP (kills LTV math)
6. **Verification rules** for nonprofit / startup / education.
7. **Sunset rules** — what happens when the discount period ends.

## Output
Write `docs/inception/discount-policy-<project>.md`:

```markdown
# Discount Policy — <project>
**Date:** <YYYY-MM-DD>
**Target gross margin:** <X>%
**Floor per tier:** Starter $15 / Pro $39 / Business $79 (never below)

## Standard discount menu
| Discount | % off | Eligibility | Approval needed | Stackable? |
|----------|-------|-------------|-----------------|------------|
| Annual prepay | 17% (2 mo) | self-serve | none | yes |
| 2-year prepay | additional 5% | sales | sales lead | with annual |
| Volume — 6+ locations | 10% | sales | sales | yes |
| Volume — 11+ locations | 15% | sales | VP | yes |
| Nonprofit (verified 501c3) | 30% off Pro | sales | sales | annual only |
| Startup program (< 18mo, < 10 staff) | 50% off year 1 | self-serve | none | no |
| Education / .edu | 50% off Pro | sales | sales | annual only |
| Referral | 1 mo free | self-serve | none | no |

## Approval ladder (any non-standard discount)
| Discount % | Approver |
|-----------|----------|
| 0-10% | rep / self-serve |
| 10-25% | sales lead |
| 25-40% | VP / founder |
| 40%+ | founder + finance |

## Forbidden discounts
- ❌ "Match competitor X" — pricing is set, not negotiated
- ❌ End-of-quarter / end-of-year sales
- ❌ Lifetime deals (LTD)
- ❌ Free for influence / clout deals (case-by-case only)
- ❌ Stacking 3+ discounts

## Verification rules
| Discount | Proof required |
|----------|----------------|
| Nonprofit | 501c3 letter or country equivalent |
| Education | .edu email + institution verification |
| Startup program | incorporation < 18mo + < 10 employees on LinkedIn |

## Sunset rules
- Startup program: full price at month 13. Email 30 / 14 / 7 days before
- Nonprofit / education: re-verify annually
- Multi-year: list-price at renewal unless renegotiated

## Objection scripts
**"Can I get a better deal?"** — Annual prepay saves 17%. Multi-year saves another 5%.
**"Competitor X is cheaper."** — Our floor is $X. Here's what we include they don't: <list>.
**"Can we do a pilot at a discount?"** — Pilots run at list. If success criteria met, you get annual discount on roll-out.

## What discounting tells us
- > 30% of deals discounted → list price likely too high; rerun `/gabor-granger-test`
- 0% discount applied → list likely too low or no churn risk
- Healthy band: 10-25% of deals discounted

## Pitfalls flagged
- [ ] Discount floor never below margin requirement
- [ ] No stacking of 3+ discounts
- [ ] No quarterly / EOY sales
- [ ] Approval ladder enforced (no rogue reps)
- [ ] Verification required for nonprofit / startup / edu
- [ ] Sunset emails scheduled

## Next
- Floor enforcement → `/contract-floor-pricing`
- Expansion (upsells) → `/expansion-revenue-design`
- Sales playbook → `/sales-playbook-skeleton`
```

## Verification
- Discount menu with 6-8 lever types.
- Approval ladder by % range.
- Forbidden discount list explicit.
- Verification rules for nonprofit / startup / edu.
- Sunset rules for time-bound discounts.
- Floor never below margin requirement.
