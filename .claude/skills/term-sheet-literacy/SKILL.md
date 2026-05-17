---
name: term-sheet-literacy
description: Term sheet literacy — decode standard + non-standard clauses, flag founder-hostile terms, calc dilution + liquidation outcomes. Outputs to `docs/inception/term-sheet-literacy-<project>.md`. Use when user says "term sheet", "TS review", "liquidation pref", "1x participating", "/term-sheet-literacy", or pre-signing.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /term-sheet-literacy — Term Sheets Are Where Founders Lose The Company

Term sheet = 8 pages of legalese, 3 clauses decide everything. Don't sign until you read them in your own words.

## Why you'd care

Founders who sign term sheets without reading every clause discover, at exit, that they participated themselves out of a payout. Decoding the standard + non-standard terms before signing is non-optional.

## Pre-flight
Run before signing any term sheet. Pairs with `/dilution-scenarios`, `/cap-table-design`.

## Inputs
- Term sheet draft (from lead VC).
- Existing cap table.
- Lawyer (preferred Cooley / Gunderson / Wilson Sonsini / Orrick / Latham).
- 1-2 founder peers who've raised same stage.

## Process
1. **3-pass read:** (1) skim for shock clauses (2) decode each section (3) negotiate redlines.
2. **Build dilution model** under term sheet + future-round assumptions.
3. **Run liquidation scenarios:** 0.5x, 1x, 2x, 5x exit.
4. **Compare to NVCA model TS** — anything non-standard = explain it.
5. **Flag founder-hostile clauses** (full ratchet, participating pref, multiple drag).
6. **Get lawyer review** before any signature.

## Output
Write `docs/inception/term-sheet-literacy-<project>.md`:

```markdown
# Term Sheet Literacy — <project>
**Lead:** <firm>
**Round:** $X at $Y cap
**Date received:** <YYYY-MM-DD>
**Lawyer:** <firm>

## Standard clauses (default safe)
| Clause | Standard | Watch for |
|--------|----------|-----------|
| Valuation | Pre + post | Post-money = more dilution, becoming standard 2024+ |
| Option pool | 10-15% post-money | Pool in pre-money = founder pays |
| Liquidation preference | 1x non-participating | 1x participating / 2x / capped participating = bad |
| Dividends | 6-8% non-cumulative | Cumulative = stacks against future exit |
| Anti-dilution | Broad-based weighted avg | Full ratchet = nuclear |
| Voting | Vote together as common | Separate class veto on standard ops |
| Pro-rata | Major holders only | Full ratchet pro-rata across all |
| Board | 2-1-1 or 1-1-1 | 3-2 investor majority at seed = red flag |
| Vesting | 4y / 1y cliff | Acceleration single-trigger = bad |
| Drag-along | Majority preferred + majority common | Preferred-only drag = nuclear |
| Information rights | Quarterly + budget | Daily access = uncommon |
| ROFR | Yes, standard | Co-sale all common holders = drag |
| Closing conditions | Diligence, legal, signed docs | Open-ended out = bad |
| Confidentiality | Mutual | One-way = bad |

## Founder-hostile clauses (negotiate hard or walk)
| Clause | Why bad | Fight back |
|--------|---------|-----------|
| Participating preferred (uncapped) | Investor gets pref + share of common = double-dip | Push to 1x non-participating or cap at 2-3x |
| Full ratchet anti-dilution | Down-round reprices investor to lowest = founder wipe | Push to broad-based weighted avg |
| 2x+ liquidation pref | 2x payback before common | Push to 1x |
| Multiple liquidation pref (3x, 5x) | Common gets nothing in modest exit | Walk |
| Cumulative dividends | 8% stacks → eats exit | Non-cumulative or 0% |
| Single-trigger acceleration on change of control | Founders fully vest at acquisition | Double-trigger (CoC + termination) |
| Preferred-only drag | Investors force sale without common consent | Joint vote required |
| Founder reverse-vesting reset | Existing vested shares become unvested | Hard no |
| Founder removal w/o cause + 100% forfeiture | Fire founder, lose all equity | Hard no |
| No-shop with no breakup fee | Locks you w/o cost to walk | Add 30-45 day cap |
| Pay-to-play | Forces follow-on or convert to common | Negotiate threshold |
| Super-voting preferred (10x votes) | Investor controls board votes | Walk |

## This term sheet's actual numbers
| Term | Value | Standard? | Action |
|------|-------|----------|--------|
| Pre-money | $12M | — | Confirm post-money interpretation |
| Investment | $3M | — | — |
| Post-money | $15M | — | — |
| Option pool | 12% post | Standard | — |
| Liquidation pref | 1x non-participating | Standard | — |
| Anti-dilution | Broad-based weighted avg | Standard | — |
| Board | 2 common, 1 preferred, 1 indep | Standard | — |
| Dividends | 6% non-cumulative | Standard | — |
| Pro-rata | Major investors (>$500k) | Standard | — |
| Vesting reset | None | — | Confirm |
| Drag | Majority pref + majority common | Standard | — |
| No-shop | 45 days | — | Confirm breakup fee or cap |

## Dilution model
Assume $3M @ $12M pre = 20% dilution from new pref + 12% from pool top-up = ~30% founder dilution.

Run scenarios:
| Scenario | New pref | Pool top-up | Founder ownership after |
|----------|---------|------------|------------------------|
| This round | 20% | 4% | 56% (was 80%) |
| + Series A ($10M @ $40M) | 20% | 5% | 41% |
| + Series B ($25M @ $100M) | 20% | 5% | 30% |
| + Series C ($50M @ $250M) | 17% | 4% | 23% |

## Liquidation scenarios
| Exit value | Pref payout | Common payout (founders) |
|-----------|------------|--------------------------|
| $1M | $3M (capped at exit) | $0 |
| $5M | $3M | ~$2M shared |
| $15M | $3M | ~$12M shared |
| $50M | $3M (1x pref) | ~$47M shared (if non-participating) |
| $100M | $3M | ~$97M shared |
| $500M | $3M | ~$497M shared |

If 1x participating: pref takes $3M + 20% of remainder. Founders lose ~$2M at $50M exit, ~$20M at $100M.

## Negotiation priorities (rank)
1. **1x non-participating** (not 2x, not participating)
2. **Broad-based weighted avg** anti-dilution
3. **Double-trigger acceleration** (not single)
4. **Joint drag** (preferred + common majority)
5. **Pool in post-money** (not pre)
6. **No founder vesting reset**
7. **Board: common majority at seed**
8. **No-shop cap + breakup**

## When to walk
- 2x+ liquidation pref
- Participating preferred uncapped
- Full ratchet
- Vesting reset
- Founder firing forfeiture
- Preferred-only drag
- No-shop with no out

## Lawyer review (mandatory)
- [ ] Engagement letter signed
- [ ] Mark-up returned within 5 business days
- [ ] All non-standard terms flagged
- [ ] Comparison to NVCA model template
- [ ] Side letter review (extra investor asks often live here)

## Common founder mistakes
- ❌ Signing without lawyer
- ❌ Optimizing for highest valuation, ignoring terms
- ❌ Accepting "this is standard" without checking NVCA
- ❌ Letting lawyer-investor relationship dominate (founder-friendly lawyer ≠ same firm as investor)
- ❌ Skipping side letters (the real terms hide here)
- ❌ No-shop + no breakup fee
- ❌ Not modeling future-round dilution

## Resources
- NVCA model term sheet (nvca.org)
- YC SAFE primer
- Brad Feld / Jason Mendelson "Venture Deals" (book)
- Cooley GO term-sheet generator (free)

## Pitfalls flagged
- [ ] Liquidation pref ≤ 1x non-participating
- [ ] Anti-dilution = broad-based weighted avg
- [ ] Acceleration = double-trigger
- [ ] Pool in post-money
- [ ] Board ≤ 50% investor seats at seed
- [ ] Lawyer reviewed
- [ ] Dilution + liquidation modeled
- [ ] No-shop has cap

## Next
- Dilution model → `/dilution-scenarios`
- Cap table update → `/cap-table-design`
- Closing prep → `/diligence-checklist`
- Investor onboard → `/investor-update-cadence`
```

## Verification
- Standard vs hostile clauses tabled.
- Actual TS numbers extracted.
- Dilution scenarios modeled.
- Liquidation payouts calc'd.
- Negotiation priorities ranked.
- Lawyer review gated.
