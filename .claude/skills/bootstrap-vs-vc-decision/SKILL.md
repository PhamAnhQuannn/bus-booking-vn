---
name: bootstrap-vs-vc-decision
description: Decide funding path — bootstrap, angel, VC seed, accelerator, revenue-based, crowdfund. Outputs to `docs/inception/bootstrap-vs-vc-<project>.md`. Use when user says "should I raise", "bootstrap vs VC", "fundraise", "/bootstrap-vs-vc-decision", or before any term sheet.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /bootstrap-vs-vc-decision — The Choice That Sets Your Whole Path

## Why you'd care

VC money carries a contractual obligation to a $100M+ exit; bootstrap carries the obligation to bootstrap. Pick wrong and you spend years building the wrong-shape company — too fast for a lifestyle business, too slow for venture-scale.

Bootstrap means slower + you keep it. VC means faster + you owe a $100M+ exit. Pick once, deliberately.

## Pre-flight
Run after `/ltv-cac-model`, `/runway-model`, `/tam-sam-som`. Pairs with `/safe-vs-priced-pick`, `/dilution-scenarios`.

## Inputs
- TAM / SAM (from `/tam-sam-som`).
- Time-to-revenue (months from start to first $).
- Personal runway (from `/personal-runway-check`).
- Founder risk tolerance.
- Category (winner-take-all vs fragmented).

## Process
1. **List 6 funding paths:**
   - **Pure bootstrap** — savings + revenue, no outside money
   - **Friends & family** — $25-100k, often as SAFE or convertible
   - **Angel(s) / pre-seed** — $250k-1.5M, SAFE or priced
   - **Accelerator (YC, Techstars)** — $125-500k for 5-10% equity + program
   - **Seed VC** — $1-4M priced round
   - **Revenue-based / non-dilutive** — Stripe Capital, Pipe, gov grants, debt
   - **Crowdfund (equity / regCF)** — $50k-5M from many small backers
2. **Score each path on 7 axes** (1-5):
   - Capital amount fit
   - Speed of close
   - Dilution
   - Strategic value (advice, network)
   - Founder control retained
   - Pressure / expectation match (10× return demand)
   - Reversibility (can you switch later)
3. **Apply category test:**
   - Winner-take-all (marketplace, social, infra) → VC justified
   - Niche SaaS / services / dev tools < $1B TAM → bootstrap or angel
   - Hardware / capital-intensive → VC or revenue-based
   - Lifestyle / cash-flow business → bootstrap, full stop
4. **Apply time-to-revenue test:**
   - < 6 mo to revenue + < 18 mo to profitability → bootstrap fine
   - > 12 mo to revenue → outside capital needed
5. **Apply personal-runway test** — if personal runway < 9 mo, must raise or take consulting.
6. **Stack the path** — bootstrap → angel → seed is a common ladder. Don't skip lightly.
7. **Decision + reversibility** — picking VC at seed largely commits you. Picking bootstrap retains optionality.

## Output
Write `docs/inception/bootstrap-vs-vc-<project>.md`:

```markdown
# Bootstrap vs VC Decision — <project>
**Date:** <YYYY-MM-DD>
**Category:** <e.g., devtool for indie SaaS teams — fragmented, ~$5B TAM>
**Personal runway:** <X months>
**Time-to-revenue estimate:** <X months>

## 6-option scorecard (1-5 each)
| Path | Capital fit | Speed | Dilution OK | Strategic | Control | Pressure fit | Reversible | Total |
|------|-------------|-------|-------------|-----------|---------|--------------|------------|-------|
| Pure bootstrap | 2 | 5 | 5 | 1 | 5 | 5 | 5 | 28 |
| Friends & family | 3 | 4 | 4 | 2 | 5 | 5 | 4 | 27 |
| Angel pre-seed | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 28 |
| Accelerator | 4 | 3 | 3 | 5 | 3 | 3 | 3 | 24 |
| Seed VC | 5 | 2 | 2 | 4 | 2 | 2 | 1 | 18 |
| Revenue-based | 3 | 4 | 5 | 1 | 5 | 5 | 4 | 27 |
| Equity crowdfund | 3 | 3 | 4 | 2 | 4 | 4 | 3 | 23 |

## Category test
- TAM ~$5B fragmented → not winner-take-all
- VC expectation (100×) is misaligned
- Bootstrap or angel-only path matches outcome shape

## Time-to-revenue test
- MVP in 4 months → first $ in month 5-6
- Bootstrap viable; no need for >$250k capital

## Personal-runway test
- 14 mo runway saved → no emergency raise
- Comfortable bootstrap window

## Decision
**Picked:** Pure bootstrap → optional angel round at $50k MRR
**Why:** category doesn't justify VC outcome shape; personal runway sufficient; control + reversibility highest with bootstrap

## Optional future raise triggers
- Hit $50k MRR + 10% MoM growth → angel round optional (clear traction)
- Need to hire 3+ FTEs to capture market window → angel round needed
- Competitor raises and starts spending → revisit raise

## What this path means concretely
- ✓ Optimize for cash flow, not growth-at-all-costs
- ✓ Profitability > $X MRR target by month <Y>
- ✓ No board, no quarterly reporting to investors
- ✗ No big paid ad budget — must lean on content / referral
- ✗ Hiring slower — first hire month 9+
- ✗ Exit pressure: zero. Run forever if you want.

## Funding ladder if path changes
- Step 1: Bootstrap to $50k MRR
- Step 2: Angel round $250-500k (SAFE, 10% dilution max) only if growth demands it
- Step 3: Seed only if hit $100k MRR + clear market expansion thesis
- Skip seed → Series A if revenue compounds organically

## Pitfalls flagged
- [ ] Category-fit test applied (winner-take-all or not)
- [ ] Time-to-revenue test applied
- [ ] Personal-runway test applied
- [ ] Reversibility considered (VC traps you, bootstrap doesn't)
- [ ] Funding ladder shows next steps if conditions change

## Next
- If raising: SAFE vs priced → `/safe-vs-priced-pick`
- If raising: dilution math → `/dilution-scenarios`
- If raising: investor list → `/investor-target-list`
- If bootstrapping: cash discipline → `/runway-model` quarterly
```

## Verification
- 6 funding paths scored on 7 axes.
- Category, time-to-revenue, personal-runway tests applied.
- Decision + funding ladder explicit.
- Concrete consequences of chosen path enumerated.
- Reversibility considered.
