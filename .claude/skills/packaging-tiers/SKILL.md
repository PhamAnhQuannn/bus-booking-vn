---
name: packaging-tiers
description: Design 3-tier pricing packaging — Good / Better / Best, features per tier, upgrade triggers. Outputs to `docs/inception/packaging-tiers-<project>.md`. Use when user says "pricing tiers", "good better best", "packaging", "feature gating", "/packaging-tiers", or before `/pricing-page-draft`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /packaging-tiers — Three Tiers, Not Five

3 is the magic. 5 confuses, 1 leaves money on the table.

## Why you'd care

Three tiers is the wedge between confused buyers and money left on the table. Five paralyzes; one signals "take it or leave it" and leaves enterprise revenue uncaptured.

## Pre-flight
Run after `/gabor-granger-test`. Pairs with `/price-anchor-design`, `/usage-metric-pick`, `/pricing-page-draft`.

## Inputs
- Target price + range (from `/gabor-granger-test`).
- Top features ranked by value-to-customer.
- Buyer segment profile (`/ideal-customer-profile`).

## Process
1. **Pick tier count** — default 3 (Good/Better/Best). Add Enterprise quote-tier as 4th if you ever do annual contracts.
2. **Tier roles:**
   - **Tier 1 (Starter)** — low friction, high adoption, sets habit
   - **Tier 2 (Pro)** — the target — most buyers land here
   - **Tier 3 (Business)** — premium signals; some buyers but mostly anchor
   - **Tier 4 (Enterprise)** — quote-only, gates regulated buyers
3. **Feature allocation:**
   - **Acquisition features** in T1 (the hook — must be valuable alone)
   - **Activation / habit features** in T2 (the "real" product)
   - **Scale features** in T3 (multi-user, multi-loc, advanced analytics)
   - **Compliance / security** in T4 (SAML, SOC 2, DPA, audit log)
4. **Upgrade triggers** — design specific "now you need to upgrade" moments. Soft limits (warn at 80%) > hard cliffs.
5. **Trial / freemium choice** — `/free-vs-trial-vs-freemium-pick`.
6. **Naming** — concrete > abstract. "Starter / Pro / Business" beats "Bronze / Silver / Gold" or "Pro / Premium / Enterprise" (too vague).
7. **Anti-patterns to avoid:**
   - "Contact sales" before Enterprise (loses self-serve buyers)
   - Removing features at higher tier
   - Hiding critical-path features in Enterprise
   - Per-seat below 10 seats (friction > revenue)

## Output
Write `docs/inception/packaging-tiers-<project>.md`:

```markdown
# Packaging Tiers — <project>
**Date:** <YYYY-MM-DD>
**Tier count:** 3 + Enterprise

## Tier overview
| Tier | Price | Target buyer | Role |
|------|-------|--------------|------|
| Starter | $19/mo | solo / 1 location | acquisition |
| Pro | $49/mo | 2-5 locations | target — most land here |
| Business | $99/mo | 6-20 locations | anchor + multi-loc real users |
| Enterprise | quote | 20+ locations + SLA needs | regulated / chains |

## Feature matrix
| Feature | Starter | Pro | Business | Enterprise |
|---------|---------|-----|----------|------------|
| Bookings / mo | 100 | unlimited | unlimited | unlimited |
| No-show SMS | ✓ | ✓ | ✓ | ✓ |
| POS integration | — | ✓ | ✓ | ✓ |
| Custom branding | — | ✓ | ✓ | ✓ |
| Multi-location | — | up to 3 | up to 20 | unlimited |
| Analytics export | — | ✓ | ✓ | ✓ |
| API access | — | — | ✓ | ✓ |
| SSO / SAML | — | — | — | ✓ |
| SOC 2 / DPA | — | — | — | ✓ |
| Dedicated AM | — | — | — | ✓ |
| Uptime SLA | — | — | 99.5% | 99.9% |

## Upgrade triggers (Starter → Pro)
- Booking #100 of the month → soft modal: "Pro removes the limit"
- Connect POS clicked → upgrade prompt
- Add user invite (>1 user) → upgrade prompt

## Upgrade triggers (Pro → Business)
- Adding 4th location
- API token requested
- Volume > 5,000 bookings/mo

## Anti-patterns avoided
- [ ] No "contact us" before Enterprise
- [ ] No features removed from higher tier
- [ ] No critical-path feature behind Enterprise (e.g., we won't paywall basic reporting)
- [ ] No per-seat charge below 5 seats

## Naming check
- Picked: Starter / Pro / Business / Enterprise
- Rejected: Bronze/Silver/Gold (vague), Hobby/Indie/Studio (wrong audience)

## Next
- Anchor design → `/price-anchor-design`
- Pricing page → `/pricing-page-draft`
- Free-vs-trial → `/free-vs-trial-vs-freemium-pick`
- Usage metric → `/usage-metric-pick`
```

## Verification
- 3 paid tiers + optional Enterprise.
- Each tier has named role.
- Feature matrix shows no removal at higher tiers.
- Upgrade triggers concrete + named.
- Naming concrete, not abstract.
