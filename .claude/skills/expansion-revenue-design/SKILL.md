---
name: expansion-revenue-design
description: Design expansion revenue — upsell paths, cross-sell, add-ons, seat growth, usage growth. Outputs to `docs/inception/expansion-revenue-<project>.md`. Use when user says "expansion revenue", "upsell", "NRR", "net retention", "land and expand", "cross-sell", "/expansion-revenue-design", or before `/sales-playbook-skeleton`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /expansion-revenue-design — Make Existing Customers Pay More Without Pushing

## Why you'd care

A SaaS with 80% gross retention but no expansion path needs to acquire 25% net-new logos a year just to stand still — and the CAC math breaks long before that pace is sustainable. Companies hitting 120%+ NRR (Snowflake, Datadog, Twilio) win because the install base compounds: seat growth, usage growth, and tier upgrades pay back the original CAC three times over. Designing those expansion paths into packaging at inception is what makes the cohort math work; bolting them on after the pricing page is set means a multi-quarter repricing exercise that risks churning the install base it's trying to monetize.

Best SaaS hits 120%+ NRR. That means existing customers grow faster than churn. Design the paths.

## Pre-flight
Run after `/packaging-tiers`, `/usage-metric-pick`, `/pricing-page-draft`. Pairs with `/sales-playbook-skeleton`.

## Inputs
- Tier structure + usage metric.
- Top features customers ask for after week 4 (the "now I want more" features).
- Account growth pattern (seats? locations? usage?).
- Renewal cadence.

## Process
1. **List expansion vectors** — every direction customer can grow spend:
   - **Vertical upsell** — Starter → Pro → Business (tier upgrade)
   - **Horizontal seat / location add** — more units at current tier
   - **Usage overage** — consumed beyond included
   - **Add-on modules** — SMS pack, analytics, white-label, API
   - **Cross-sell** — separate product
   - **Annual conversion** — monthly → annual (cash flow win, not NRR)
   - **Multi-year** — 1y → 3y commit
2. **Design 3-5 expansion trigger events:**
   - Usage hits 80% of limit → soft prompt
   - Adds Nth seat / location → upgrade modal
   - Requests feature locked behind upgrade → in-app prompt
   - Hits week 4 of activation → in-app annual offer
   - Renewal date approaches → CSM check-in
3. **Build add-on catalog** — 3-7 add-ons priced $X/mo each. Should each be at least 10% of base tier price.
4. **Set expansion ownership:**
   - Self-serve expansion (in-app, no human) — < $200 ACV uplift
   - CSM-driven — $200-2k uplift
   - AE re-engagement — $2k+ uplift
5. **NRR target** — 110% Year 1, 120% Year 2 (B2B SaaS healthy band).
6. **Pricing review trigger** — re-test annually with `/gabor-granger-test`.

## Output
Write `docs/inception/expansion-revenue-<project>.md`:

```markdown
# Expansion Revenue Design — <project>
**Date:** <YYYY-MM-DD>
**NRR target:** 115% Year 1
**Primary expansion vector:** per-location growth

## Expansion vectors (ranked by expected $)
| Vector | Avg uplift | Frequency | Channel | Owner |
|--------|-----------|-----------|---------|-------|
| Add location | +$49/mo | 1× per 6mo | self-serve in-app | none |
| Tier upgrade Starter→Pro | +$30/mo | 1× lifetime | in-app trigger | none |
| Tier upgrade Pro→Business | +$50/mo | 1× lifetime | CSM | CSM |
| SMS pack overage | +$15/mo | recurring | self-serve | none |
| Analytics add-on | +$29/mo | sticky | in-app prompt | none |
| Multi-loc onboarding add-on | $500 one-off | once | sales | AE |
| Annual conversion | (cash flow only) | 1× | email + in-app | none |

## Expansion trigger events
| Trigger | Threshold | Surface | Copy |
|---------|-----------|---------|------|
| Booking limit | 80% of tier | in-app banner | "You're 80% to your monthly limit — Pro removes the cap" |
| 2nd location added | event | upgrade modal | "Multi-location dashboard ready in Pro" |
| API token request | event | inline modal | "API access available on Business — upgrade?" |
| Day 30 of activation | event | email + in-app | "Save 2 months on annual" |
| Day 45 cohort | event | CSM call | health-check + expansion fit |
| 60 days before renewal | event | email | "Lock in next year at current price" |

## Add-on catalog
| Add-on | Price | Eligibility | Self-serve? |
|--------|-------|-------------|-------------|
| SMS pack 500 (overage cap) | +$15/mo | any | ✓ |
| SMS pack 2,000 | +$45/mo | Pro+ | ✓ |
| Analytics export | +$29/mo | Pro+ | ✓ |
| White-label SMS sender | +$49/mo | Business+ | ✗ (sales) |
| Custom integration build | $2,500 one-off | Business+ | ✗ (sales) |
| Onboarding white-glove | $500 one-off | any | ✗ (sales) |

## Ownership matrix
| Uplift band | Owner | Touch |
|-------------|-------|-------|
| < $200 ACV uplift | self-serve | in-app prompts only |
| $200 — $2,000 | CSM | quarterly check-in |
| > $2,000 | AE | named opportunity |

## NRR math (target Year 1: 115%)
- Gross churn: 10%
- Tier upgrades: 8% lift
- Add-ons: 7% lift
- Seat / location expansion: 10% lift
- Net = 100 - 10 + 8 + 7 + 10 = 115%

## Forbidden patterns
- ❌ Pop-up upsells on dashboard load (annoying)
- ❌ Hiding features just to upsell
- ❌ Punitive overage rates (> 5× included unit cost)
- ❌ Expansion at renewal only — too late, do it during success moments

## Pricing-review triggers
- NRR < 105% → tier prices / overage rates too soft, re-run `/gabor-granger-test`
- Add-on attach rate < 15% → packaging wrong, re-run `/packaging-tiers`
- Customer hits limit and doesn't upgrade → upgrade prompt failing, redesign

## Pitfalls flagged
- [ ] 3-5 expansion vectors named with $ uplift
- [ ] Trigger events explicit (not just "we'll ask later")
- [ ] Add-on catalog priced at ≥ 10% of base tier
- [ ] Ownership matrix by uplift band
- [ ] NRR math shows 110%+ achievable
- [ ] No pop-up upsell on every dashboard load

## Next
- Sales playbook → `/sales-playbook-skeleton`
- Renewal motion → `/renewal-playbook` (if exists)
- Re-test pricing in 12mo → `/gabor-granger-test`
```

## Verification
- 5+ expansion vectors with $ uplift estimates.
- 5+ trigger events tied to in-product moments.
- Add-on catalog priced ≥ 10% of base tier.
- Ownership matrix by uplift band.
- NRR math shows path to 110%+.
- Anti-patterns flagged.
