---
name: safe-vs-priced-pick
description: Pick fundraising instrument — SAFE, convertible note, priced round. Cap, discount, MFN, post-money math. Outputs to `docs/inception/safe-vs-priced-<project>.md`. Use when user says "SAFE", "convertible note", "priced round", "post-money", "valuation cap", "/safe-vs-priced-pick", or before signing any investor doc.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /safe-vs-priced-pick — The Instrument That Sets Your First Real Dilution

Picking SAFE vs note vs priced is mostly mechanical, but the cap is the whole game. Get it right.

## Why you'd care

SAFEs look founder-friendly until the post-money math compounds across three notes and you wake up with 40% dilution from a stack you thought was 15%. Picking the right instrument before signing is how the cap table stays survivable.

## Pre-flight
Run after `/bootstrap-vs-vc-decision` (if raising). Pairs with `/dilution-scenarios`, `/option-pool-sizing`.

## Inputs
- Target raise amount.
- Investor profile (angels / micro-VCs / accelerator / institutional VC).
- Stage (pre-revenue / pre-product / post-launch).
- Comparable cap / valuation data.

## Process
1. **List 3 instruments:**
   - **Y Combinator SAFE (post-money)** — most common 2024+; cap + optional discount; no interest; no maturity; converts at next priced round
   - **Convertible note** — debt, interest accrues, maturity date triggers conversion or repayment; cap + discount
   - **Priced equity round** — actual price per share set today; common at $2-5M+ rounds with lead VC
2. **Decision rules:**
   - < $1M total raise + multiple angels → **post-money SAFE** with cap
   - $1-3M total + accelerator or scattered investors → **SAFE stack**
   - $3M+ with lead investor → **priced seed round**
   - Investor explicitly demands debt → **convertible note** (rare in 2024)
3. **Set cap:**
   - Pre-revenue + pre-product: $4-8M post-money cap typical
   - MVP + waitlist traction: $8-15M
   - Live + paying customers: $10-25M
   - Don't set cap higher than expected next-round valuation
4. **Discount decision** — 20% standard; skip if cap is well-set
5. **MFN (Most Favored Nation) clause** — give to early investors so they ratchet to later better terms. Standard.
6. **Pro-rata rights** — give to lead angels (1-2%+ check); deny to small checks
7. **Side letters** — keep minimal; every special right is future-pain
8. **Lawyer pass** — never sign without one. Cost: $3-8k for SAFE round, $25-50k for priced

## Output
Write `docs/inception/safe-vs-priced-<project>.md`:

```markdown
# SAFE vs Priced — <project>
**Date:** <YYYY-MM-DD>
**Target raise:** $<X>
**Stage:** <pre-revenue / MVP / live>
**Investor profile:** <angels / accelerator / lead VC>

## Decision
**Picked:** Post-money SAFE (YC standard)
**Why:** $500k raise from 4-6 angels; no lead; priced round overkill

## Instrument terms
| Term | Value | Reasoning |
|------|-------|-----------|
| Valuation cap | $8M post-money | comp: similar stage in space |
| Discount | none | cap is set well; no need to stack |
| MFN | yes | standard, protects early investors |
| Pro-rata | only for $50k+ checks | concentrate dilution |
| Side letters | none | keep clean |

## Cap rationale
- 3 comp deals in space at $6-10M post-money
- We have working MVP + 200 waitlist — more than pre-product, less than paying
- $8M splits the band

## Dilution math at conversion
**Assume next priced seed = $12M post-money on $3M raise:**
| Investor | Check | Cap | Shares % at conversion |
|----------|-------|-----|------------------------|
| Angel A | $100k | $8M | 1.25% |
| Angel B | $50k | $8M | 0.625% |
| Angel C | $250k | $8M | 3.125% |
| Angel D | $100k | $8M | 1.25% |
| **Total SAFE dilution** | **$500k** | | **6.25%** |
| Seed lead | $3M | $12M | 25% |
| Option pool top-up | — | — | 8% |
| **Founders post-Series A** | | | **60.75%** |

## When to switch to priced
- Round size > $2M
- Lead investor demands board seat
- Multiple SAFEs stacking up will create cap-table chaos
- IPO-track later — clean equity from start

## When NOT to use a convertible note
- Almost always (debt + maturity + interest add complexity)
- Exception: investor requires it (rare in 2024 US tech)

## What goes in the doc set
- [ ] Y Combinator post-money SAFE (latest version)
- [ ] Side letter only if granting pro-rata or info rights
- [ ] No board seats from SAFE
- [ ] No vetoes / consent rights from SAFE
- [ ] No advisor SAFE without separate advisor agreement
- [ ] All signed via DocuSign through lawyer

## Lawyer engagement
- Firm: <e.g., Gunderson / Cooley / Orrick / boutique>
- Scope: review investor docs, redline side letters
- Cost: $3-8k for SAFE round
- Avoid: founder buddies who "do contracts" but not VC docs

## Pitfalls flagged
- [ ] Used post-money SAFE (not pre-money — 2024 standard)
- [ ] Cap not higher than expected next round
- [ ] No multiple stacked discounts/caps from same investor
- [ ] Pro-rata only granted above $50k check
- [ ] No board seats from SAFE
- [ ] Lawyer engaged before any signature

## Next
- Dilution at A → `/dilution-scenarios`
- Option pool design → `/option-pool-sizing`
- Investor target list → `/investor-target-list`
- Data room → `/data-room-bootstrap`
```

## Verification
- Instrument picked + reason.
- Cap + discount + MFN + pro-rata terms set.
- Dilution math at hypothetical conversion shown.
- Lawyer engagement scope explicit.
- Anti-patterns (pre-money SAFE, board from SAFE, friend-lawyer) avoided.
