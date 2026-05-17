---
name: dilution-scenarios
description: Model founder dilution through 3-4 funding rounds — SAFE → seed → A → B + option pool top-ups. Outputs to `docs/inception/dilution-scenarios-<project>.md`. Use when user says "dilution", "cap table model", "founder %", "ownership", "/dilution-scenarios", or before signing any term sheet.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /dilution-scenarios — How Much Of Your Company Will You Actually Own

## Why you'd care

The option pool top-up before the priced round comes out of founder equity, not the new investor's — and most founders don't realize this until the closing wire has cleared and their stake is 8 points smaller than the term-sheet napkin math suggested. Modeling 3-4 rounds of dilution before signing the first one is what stops a founder from waking up at Series B owning 22% instead of the 45% they thought they were on track for, and it changes which term sheets get signed at the seed.

Most founders walk into Series A thinking they own 60% and walk out at 35%. Model it before each round, not after.

## Pre-flight
Run after `/safe-vs-priced-pick`, `/option-pool-sizing`. Pairs with `/cap-table-design`, `/bootstrap-vs-vc-decision`.

## Inputs
- Founder count + initial split.
- SAFE caps + amounts raised.
- Expected seed / A / B valuations + raise amounts.
- Target option pools per round.

## Process
1. **Start with founders 100%** + advisor allocations.
2. **Layer 1 — SAFE round** — caps convert at next priced round; model conversion at seed.
3. **Layer 2 — Seed** — pre-money pool top-up + new investor takes %.
4. **Layer 3 — Series A** — pool refresh + lead investor + pro-rata follows.
5. **Layer 4 — Series B** — same pattern.
6. **Three scenarios:**
   - **Conservative** — high caps, smaller raises, modest pool top-ups
   - **Base** — market-typical
   - **Aggressive growth** — biggest rounds, biggest pool top-ups
7. **Founder ownership floor** — many investors expect founders to hold ≥ 50% post-A, ≥ 30% post-B. Below those is a warning sign.
8. **Liquidation preferences** — note 1× non-participating preferred is standard; multiple liquidation preferences or participating preferred change the exit math more than dilution does.
9. **Exit math at each stage** — at $X exit, what does each founder take home.

## Output
Write `docs/inception/dilution-scenarios-<project>.md`:

```markdown
# Dilution Scenarios — <project>
**Date:** <YYYY-MM-DD>
**Founders:** 2 (50/50)
**Initial advisor allocations:** 1.5%

## Starting position
| Stakeholder | Shares % |
|-------------|----------|
| Founder A | 49.25% |
| Founder B | 49.25% |
| Advisors (vesting) | 1.5% |
| **Total** | 100% |

## Layer 1 — SAFE round close
**Raised:** $500k on $8M post-money cap SAFE
**Converts at seed.**

## Base scenario walkthrough

### Seed: $3M raise on $12M pre / $15M post + 10% pool top-up
| Stakeholder | Pre-pool | After 10% pool | After $3M seed |
|-------------|----------|----------------|----------------|
| Founder A | 49.25% | 43.55% | 34.84% |
| Founder B | 49.25% | 43.55% | 34.84% |
| Advisors | 1.5% | 1.33% | 1.06% |
| Pool | 0% | 10% | 8.0% |
| SAFE holders ($500k @ $8M cap) | — | — | 4.16% |
| Seed lead | — | — | 17.10% |
| **Total** | 100% | 100% | 100% |

### Series A: $10M raise on $30M pre / $40M post + top up to 12% pool
| Stakeholder | After seed | Post pool top-up | Post Series A |
|-------------|------------|------------------|---------------|
| Founder A | 34.84% | 32.45% | 24.34% |
| Founder B | 34.84% | 32.45% | 24.34% |
| Advisors | 1.06% | 0.99% | 0.74% |
| Pool | 8.0% | 12.0% | 9.0% |
| SAFE | 4.16% | 3.87% | 2.91% |
| Seed lead | 17.10% | 15.92% | 11.94% |
| Series A lead | — | — | 25.0% |
| Pro-rata participants | — | — | (folded into above) |
| **Total** | 100% | 100% | 100% |

### Series B: $25M on $80M pre / $105M post + top up pool to 12%
| Stakeholder | After A | Post pool | Post B |
|-------------|---------|-----------|--------|
| Founder A | 24.34% | 22.61% | 17.23% |
| Founder B | 24.34% | 22.61% | 17.23% |
| Advisors | 0.74% | 0.69% | 0.52% |
| Pool | 9.0% | 12.0% | 9.14% |
| SAFE | 2.91% | 2.70% | 2.06% |
| Seed lead | 11.94% | 11.09% | 8.45% |
| Series A lead | 25.0% | 23.22% | 17.69% |
| Series B lead | — | — | 23.81% |
| **Total** | 100% | 100% | 100% |

## Side-by-side founder % across scenarios
| Round | Conservative | Base | Aggressive |
|-------|--------------|------|------------|
| Founding | 98.5% (combined) | 98.5% | 98.5% |
| Post-SAFE | 98.5% | 98.5% | 98.5% |
| Post-Seed | 75% | 69.68% | 64% |
| Post-A | 60% | 48.68% | 36% |
| Post-B | 48% | 34.46% | 22% |

## Exit math (combined founder take-home at $X exit)
**Assumes 1× non-participating preferred, no multiples**

| Exit | Conservative | Base | Aggressive |
|------|--------------|------|------------|
| $100M | $48M | $34.46M | $22M |
| $500M | $240M | $172M | $110M |
| $1B | $480M | $345M | $220M |

## Sanity checks
- [ ] Founder % above 50% post-Seed ✓
- [ ] Founder % above 30% post-A ✓ (just barely)
- [ ] Pool refilled at each round (not skipped)
- [ ] Pro-rata factored in (existing investors keep their %)
- [ ] No multiple-preference / participating-preferred (would shift exit math materially)

## When to push back on a round
- Pool top-up > 15% pre-money (unjustified)
- New investor demands > 30% in one round (loss of control)
- Liquidation preference > 1× (uncommon in 2024, push back hard)
- Participating preferred (uncommon, push back hard)
- Anti-dilution full-ratchet (vs broad-based weighted avg)

## Pitfalls flagged
- [ ] Pre-money pool top-up modeled (founders absorb it)
- [ ] SAFE conversion at seed modeled correctly
- [ ] Pro-rata factored in
- [ ] 3 scenarios shown (conservative / base / aggressive)
- [ ] Exit math at multiple valuations
- [ ] Founder floor (50% post-Seed / 30% post-A) tracked

## Next
- Cap table tooling → `/cap-table-design`
- If raising next: `/safe-vs-priced-pick` updated
- Founder protection mechanics → `/founders-agreement` (vesting, IP, transferability)
```

## Verification
- 3 scenarios (conservative / base / aggressive).
- Each round: pool top-up + SAFE conversion + new lead modeled.
- Founder % tracked through all rounds.
- Exit math at multiple exit sizes.
- Sanity checks vs founder ownership floors.
