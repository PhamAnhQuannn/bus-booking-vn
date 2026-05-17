---
name: 409a-precheck
description: Founder / CFO / finance lead responsibility — pre-check 409A valuation requirements — when needed, vendor pick, strike-price impact, refresh cadence. Outputs to `docs/inception/409a-precheck-<project>.md`. Use when user says "409A", "strike price", "fair market value", "FMV", "option strike", "CFO valuation prep", "finance lead 409A", "/409a-precheck", or before granting first option.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /409a-precheck — Set The Option Strike Before You Grant The Option

Granting options without a 409A is an IRS landmine. Get the valuation, set the strike, then grant.

## Why you'd care

Granting options without a 409A is an IRS landmine — strike prices set by gut feel become deferred-comp violations that follow you to exit. The valuation costs hundreds; the cleanup costs six figures.

## Pre-flight
Run after `/option-pool-sizing`. Pairs with `/equity-comp-philosophy`, `/first-hire-plan`.

## Inputs
- Funding stage (pre-revenue / post-seed / post-A).
- Most recent priced round valuation (if any).
- Hiring plan (first option grant date).
- Jurisdiction (US Delaware C-Corp standard for 409A).

## Process
1. **Why 409A exists** — IRS Section 409A requires options granted at or above fair market value to avoid being taxed as deferred comp. Strike below FMV = ordinary income tax on the spread + 20% federal penalty for the option holder.
2. **When required:**
   - Before first option grant
   - Annual refresh (12-month safe harbor)
   - After material event: new priced round, acquisition offer, large hire, major contract win/loss
3. **Vendor candidates:**
   - **Carta** — integrated with cap table, $2-5k
   - **Pulley** — cheaper, $1-3k, often included with cap table service
   - **Cake Equity** — Asia-Pac friendly
   - **Boutique appraisers** (e.g., Scalar) — for unusual situations
4. **Method choice** (the appraiser picks, but know the names):
   - **Market approach** — comps from peer companies
   - **Income approach** — DCF (rare at seed)
   - **Asset approach** — for very early / pre-product
   - **Backsolve** — derives common share value from preferred share price (most common after priced round)
5. **Typical strike multiples** vs preferred:
   - Pre-revenue, no priced round: $0.01-0.10/share, FMV ≈ 10-20% of last SAFE cap
   - Post-seed: common ≈ 25-35% of preferred
   - Post-A: common ≈ 30-50% of preferred
   - Post-B+: common ≈ 50-80% of preferred
6. **Refresh triggers:**
   - 12 months elapsed
   - Priced round closed
   - Acquisition offer received
   - Major contract / customer loss / win
   - First product launch (material event)
7. **Safe harbor** — 409A from a qualified independent appraiser provides a "presumption of reasonableness." IRS must show valuation was "grossly unreasonable" to challenge.
8. **Don't grant before valuation lands.** Backdating is fraud.

## Output
Write `docs/inception/409a-precheck-<project>.md`:

```markdown
# 409A Precheck — <project>
**Date:** <YYYY-MM-DD>
**Entity type:** Delaware C-Corp
**Stage:** <pre-revenue / seed-stage / etc>
**First option grant target date:** <YYYY-MM-DD>

## Why now
- Hiring eng #1 month 4
- Granting 1.0% in options as part of offer
- Strike must be at FMV → 409A required before grant date

## Vendor pick
| Vendor | Cost | Turnaround | Notes |
|--------|------|------------|-------|
| Carta | $4,500 | 3 weeks | Integrated cap table |
| **Pulley** ⭐ | **$2,000** | **2 weeks** | **Picked — cheaper, fast** |
| Cake Equity | $1,800 | 3 weeks | AsiaPac-leaning |

**Picked:** Pulley — fastest + cheapest at our stage

## Expected method + result
**Method:** Backsolve (we have $500k SAFE @ $8M cap)
**Expected common FMV:** $0.02-0.05/share (≈ 15-25% of preferred-equivalent at cap)
**Strike price for first grant:** $0.03/share (subject to actual 409A)

## Refresh schedule
| Trigger | Action |
|---------|--------|
| 12 months from grant | Re-run 409A |
| Priced seed closes | Re-run within 30 days |
| Acquisition LOI received | Re-run within 14 days |
| First $100k MRR | Re-run (material event) |
| Major hire / exec change | Re-run |

## Risk if skipped or backdated
- Option holder pays ordinary income tax on spread at vest
- Additional 20% federal penalty
- Possible state-level 20% additional (CA, MA, others)
- Founder / company personally liable for under-withheld taxes
- Catastrophic morale + retention impact if discovered

## Cap table impact
- 409A doesn't dilute anyone; it just sets the price
- But: a low 409A makes options cheaper to exercise = better for employees
- A 409A pushed too low risks IRS challenge — don't lowball

## Documentation to retain
- [ ] Final 409A appraisal PDF
- [ ] Engagement letter with vendor
- [ ] Board resolution adopting the FMV
- [ ] Communications log if appraiser made adjustments
- [ ] Stored in data room (per `/data-room-bootstrap`)

## Process timeline (target)
| Week | Action |
|------|--------|
| W1 | Engage vendor, sign engagement letter |
| W1-2 | Provide cap table, SAFE docs, financials, headcount |
| W2-3 | Appraisal in progress, Q&A with vendor |
| W3 | Final report delivered |
| W3 | Board resolution adopting FMV |
| W4 | First option grant signed at adopted strike |

## Pitfalls flagged
- [ ] 409A obtained BEFORE first grant (never backdate)
- [ ] Qualified independent appraiser (safe harbor)
- [ ] Annual refresh on calendar
- [ ] Refresh triggered by material events too
- [ ] Board resolution adopting FMV filed
- [ ] FMV adopted at full value, not artificially lowered

## Next
- First hire & grant → `/first-hire-plan`
- Vesting standards → `/equity-comp-philosophy`
- Cap table → `/cap-table-design`
```

## Verification
- Vendor picked with cost + turnaround.
- Expected method + FMV band stated.
- Refresh triggers enumerated.
- Risk of skipping / backdating documented.
- Documentation list for data room.
- Timeline from engagement to first grant.
