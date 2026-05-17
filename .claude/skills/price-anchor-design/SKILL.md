---
name: price-anchor-design
description: Design price anchors — decoy, contrast, premium-tier, reference price. Outputs to `docs/inception/price-anchor-<project>.md`. Use when user says "price anchor", "decoy effect", "pricing psychology", "anchoring", "/price-anchor-design", or before `/pricing-page-draft`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /price-anchor-design — Make Your Real Price Look Like A Deal

The first number a buyer sees colors every other number. Anchors are intentional.

## Why you'd care

Buyers don't know what something is worth — they price it against whatever else is on the page. Without deliberate anchors, you're letting the buyer's last-seen-price set yours.

## Pre-flight
Run after `/gabor-granger-test` (have target price). Pairs with `/packaging-tiers`, `/pricing-page-draft`.

## Inputs
- Target list price (from `/gabor-granger-test`).
- Competitor reference prices.
- Tier structure (from `/packaging-tiers`).

## Process
1. **Pick anchor strategy**:
   - **Decoy** — middle tier that's clearly worse than the next-up tier (Economist subscription example)
   - **Premium ceiling** — high-priced tier no one buys, makes mid-tier look reasonable
   - **External anchor** — "Replaces $X spreadsheet + $Y staff time"
   - **Reference price** — strike-through old price (use sparingly, regulators watch)
   - **Annual contrast** — show monthly bill annualized vs annual price (2 mo free)
2. **Order tiers** — left to right, cheap to expensive (Western reading). Highlight target tier.
3. **Cognitive load test** — feature comparison table — can prospect pick in 30 sec?
4. **Number presentation**:
   - Drop currency symbol or shrink it (research: smaller perceived cost)
   - End in .99 (consumer) vs whole numbers (B2B / premium)
   - Per-user vs per-seat vs flat — match buying mental model
5. **Loss frame test** — "Save $X/mo" beats "Costs $X/mo" for switching pitches.
6. **Avoid** — too many anchors stack to dishonesty perception. One clear anchor max.

## Output
Write `docs/inception/price-anchor-<project>.md`:

```markdown
# Price Anchor Design — <project>
**Date:** <YYYY-MM-DD>
**Target price (revenue-optimum):** $<X>/mo
**Anchor strategy:** <Decoy / Premium ceiling / External / Reference / Annual contrast>

## Tier table
| Tier | Price | Role | Features delta vs next |
|------|-------|------|------------------------|
| Starter | $19/mo | Acquisition | core booking |
| **Pro (target)** | **$49/mo** | **Highlighted** | + integrations, alerts |
| Business | $99/mo | Anchor / decoy | + multi-location, SLA |
| Enterprise | "Call us" | Premium ceiling | + SAML, dedicated AM |

## Why this anchor works
- Pro vs Business: Pro gets 80% features at 50% price → easy pick
- Business vs Enterprise: makes Business look reasonable
- "Call us" tier: removes price for largest deals + signals premium

## External anchor copy
- "Replaces $200/mo POS add-on + 8 hrs/wk admin time"
- "Resy Pro: $69/seat. Us: $49 flat."

## Annual contrast
- Monthly: $49
- Annual: $470 (save 2 months — $98)
- Display monthly first, annual toggled on

## Number presentation
- Currency: small "$" prefix
- Round: B2B → whole numbers ($49 not $49.99)
- Unit: per-location (matches buyer mental model)

## Loss-frame copy A/B
- A: "Costs $49/mo"
- B: "Save $200/mo in lost no-shows for $49"
- Hypothesis: B converts 1.5×

## Pitfalls flagged
- [ ] One clear anchor, not stacked
- [ ] Decoy is plausibly real (not obviously fake)
- [ ] Reference price (strike-through) only if genuine prior price
- [ ] Annual contrast doesn't hide monthly comparison
- [ ] Tier features support price gap, not just count

## Next
- Build tier copy → `/packaging-tiers`
- Build the page → `/pricing-page-draft`
- A/B test in market → after launch
```

## Verification
- Anchor strategy named + justified.
- Tier table includes role + features delta.
- External anchor copy drafted.
- Number presentation rules picked.
- Loss-frame variant drafted for A/B.
