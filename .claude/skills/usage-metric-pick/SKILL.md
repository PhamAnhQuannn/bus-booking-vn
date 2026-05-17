---
name: usage-metric-pick
description: Pick the right usage/value metric for pricing — seats, API calls, bookings, GB, MAU. Outputs to `docs/inception/usage-metric-<project>.md`. Use when user says "value metric", "usage-based pricing", "what to charge per", "pricing unit", "/usage-metric-pick", or before `/packaging-tiers`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /usage-metric-pick — The Unit That Scales With Customer Value

Charge for the thing that grows when the customer wins. Wrong metric kills expansion or punishes adoption.

## Why you'd care

Charging per seat for a product whose value scales with API calls leaves money on the table; charging per API call for a product whose value is seats kills sales. Picking the right value metric is the highest-leverage pricing decision.

## Pre-flight
Run before `/packaging-tiers` and `/pricing-page-draft`. Pairs with `/expansion-revenue-design`.

## Inputs
- The customer outcome the product produces (not features).
- Candidate unit list (seats, API calls, bookings, GB, MAU, transactions, rows, sites, locations).
- Buyer-side budget owner (who signs).

## Process
1. **List 5-8 candidate metrics** the product naturally generates.
2. **Score each on 7 axes** (1-5):
   - **Aligns with customer value** — when this goes up, did customer win?
   - **Predictable for buyer** — can buyer estimate next month's bill?
   - **Measurable by us** — can we count it cleanly?
   - **Resistant to gaming** — buyer can't bypass cheaply
   - **Grows with account** — does it expand naturally?
   - **Floor friendly** — small customers can start cheap
   - **Procurement-legible** — finance can write a PO against it
3. **Eliminate seats below 5** — friction > revenue for small teams.
4. **Avoid "infrastructure tax" metrics** (storage, bandwidth) unless infra is the product. Customers feel punished for using.
5. **Test against expansion paths** — if metric stays flat as customer matures, no expansion. Bad.
6. **Two-tier metric rule** — base metric (small, included) + overage (per unit) often beats pure usage.
7. **Final pick + fallback** — name one primary metric and one tested alternative.

## Output
Write `docs/inception/usage-metric-<project>.md`:

```markdown
# Usage Metric — <project>
**Date:** <YYYY-MM-DD>
**Customer outcome:** <e.g., "filled tables / reduced no-shows">
**Buyer-side budget owner:** <e.g., GM / owner / RevOps>

## Candidate metrics
| Metric | Value-align | Predictable | Measurable | Anti-game | Expands | Floor-OK | Procurable | Total |
|--------|-------------|-------------|------------|-----------|---------|----------|------------|-------|
| Per seat | 3 | 5 | 5 | 4 | 3 | 2 | 5 | 27 |
| Per location | 5 | 5 | 5 | 5 | 4 | 4 | 5 | 33 |
| Per booking | 5 | 2 | 5 | 3 | 5 | 4 | 3 | 27 |
| Per SMS sent | 3 | 2 | 5 | 4 | 4 | 4 | 3 | 25 |
| Per GB stored | 2 | 3 | 5 | 5 | 2 | 4 | 4 | 25 |
| Flat / unlimited | 2 | 5 | 5 | 2 | 1 | 3 | 5 | 23 |

**Picked:** Per location (primary) + booking overage above 500/mo (secondary)
**Fallback:** Flat per-location tiers if overage causes complaints

## Why this metric
- Locations correlate 1:1 with revenue customer makes
- Owner already thinks in "per location" — matches mental model
- Predictable bill — same each month unless they grow
- Resists gaming — can't fake locations

## Why not the rest
- Per seat: hosts + managers all use it, charging per seat punishes adoption
- Per booking pure: buyer can't predict slow months
- Per SMS: feels like a tax on the most valuable feature
- Per GB: irrelevant — we store almost nothing

## Two-tier structure
- Base: 500 bookings/mo per location included
- Overage: $0.10/booking above 500
- Soft cap: warn at 80% (400 bookings), prompt upgrade

## Expansion path
- Customer adds 2nd location → 2× revenue automatically
- Customer hits 500/mo booking ceiling → upgrade tier, not overage
- Customer adds SMS marketing → new line item

## Pitfalls flagged
- [ ] Not per-seat for buyers with < 5 seats
- [ ] Not punishing for high-value usage (SMS, AI calls)
- [ ] Metric grows when customer wins, not when they suffer
- [ ] Buyer can predict next month's bill within ±20%

## Next
- Apply to tiers → `/packaging-tiers`
- Apply to page → `/pricing-page-draft`
- Expansion design → `/expansion-revenue-design`
```

## Verification
- 5-8 candidate metrics scored on 7 axes.
- Primary + fallback picked.
- Expansion path explicit.
- Two-tier structure (base + overage) decided.
- Anti-patterns (seats < 5, infra tax, value-punishing) avoided.
