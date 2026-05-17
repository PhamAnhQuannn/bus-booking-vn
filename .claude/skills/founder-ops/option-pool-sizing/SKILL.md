---
name: option-pool-sizing
description: Founder / CFO / general counsel responsibility — size pre-money option pool — typical 10-15% at seed, refilled at A. Founder dilution math. Outputs to `docs/inception/option-pool-<project>.md`. Use when user says "option pool", "ESOP", "stock options", "employee equity", "CFO option pool", "general counsel option grant", "/option-pool-sizing", or before priced round.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /option-pool-sizing — The Hidden Dilution Most Founders Don't See Coming

Pre-money pool top-up = founders dilute, not investors. Bigger pool = bigger founder hit. Right-size deliberately.

## Why you'd care

Pool sized too small means re-upping with the next round in the middle of a hiring run; sized too big means dilution you didn't need to take. Sizing right pre-money is one of the highest-leverage cap-table decisions you'll make.

## Pre-flight
Run after `/safe-vs-priced-pick`. Pairs with `/dilution-scenarios`, `/equity-comp-philosophy`.

## Inputs
- Hiring plan 18-24 months out.
- Existing equity grants (advisors, early team).
- Target % per role (typical bands below).

## Process
1. **Build 18-month hiring plan** — every role, target equity %.
2. **Reference bands** (post-Series A norms):
   - C-level exec hire: 1-3%
   - VP-level: 0.5-1.5%
   - Director / senior IC: 0.2-0.5%
   - Mid-level IC: 0.05-0.2%
   - Junior IC: 0.02-0.1%
   - Advisor: 0.1-0.5% (with vesting + cliff)
3. **Sum needed pool** — sum of all grants + 30% buffer for re-grants / refresh.
4. **Apply seed pool rule** — top-up to 10-15% pre-money at seed close. Investors expect this.
5. **Apply A pool rule** — top-up to 10-12% pre-money at Series A.
6. **Calculate founder dilution from pool top-up** — pre-money pool means founders absorb 100% of the dilution.
7. **Negotiate** — if your hiring plan justifies only 8% pool, push back on investor's 12% ask.
8. **Vesting standard** — 4-year vest, 1-year cliff, monthly thereafter. Acceleration on change-of-control optional (single-trigger rare, double-trigger standard for execs).

## Output
Write `docs/inception/option-pool-<project>.md`:

```markdown
# Option Pool Sizing — <project>
**Date:** <YYYY-MM-DD>
**Stage:** Pre-seed / Seed / Pre-A

## 18-month hiring plan
| Role | Target equity | When | Justification |
|------|---------------|------|---------------|
| First eng hire | 1.0% | month 4 | senior IC, key feature |
| Eng #2 | 0.5% | month 8 | mid |
| Eng #3 | 0.5% | month 12 | mid |
| Designer | 0.7% | month 6 | sole designer |
| GTM lead | 1.5% | month 10 | founding GTM |
| Advisor (×2) | 0.4% (×2) | month 1 | committed |
| Refresh buffer (30%) | 1.5% | rolling | retention |
| **Total** | **6.5%** | | |

## Pool size recommendation
- Math-justified: **7%**
- Investor-typical ask at seed: **10-12%**
- Negotiation target: **8-10%**

## Dilution math — pre-money pool top-up
**Scenario: $4M raise at $10M pre-money + top up to 10% pool**

| | Pre-raise | After pool top-up | Post-raise |
|---|-----------|-------------------|------------|
| Founders | 80% | 70.7% | 50.5% |
| Advisors | 1% | 0.88% | 0.63% |
| Existing pool | 0% | 10% | 7.14% |
| Old SAFE holders | 19% | 16.8% | 12.0% |
| Series A lead | — | — | 28.57% |
| Investor share absorbed | 0% | 0% | — |

→ Founders give up **9.3%** to the pool top-up (80% → 70.7%) — pool comes out of pre-money

## Negotiation script
> "Investor proposes 12% pool. Our 18-mo hiring plan justifies 7%, plus 30% buffer = 9%. We propose 10% pre-money pool. Any unused at Series A reverts to common (which protects them too)."

## Vesting standard for all grants
- 4-year vest
- 1-year cliff
- Monthly vesting thereafter
- Double-trigger acceleration on change-of-control (exec hires only)
- No single-trigger acceleration (kills acquirer interest)
- Repurchase right on unvested at departure

## Per-grant template
```
Grantee: <name>
Grant date: <date>
# of options: <X>
Strike price: <409A FMV>
Vest start: <date>
Cliff: 12 months
Vest schedule: 1/48 monthly after cliff
Exercise window post-departure: 90 days (or 10y if you want to be founder-friendly)
```

## 409A valuation
- Required at first option grant
- Refresh annually or after material event (round, acquisition offer, etc)
- Vendor: Carta / Pulley / Cake Equity (typically $1-3k)

## Pitfalls flagged
- [ ] Pool size justified by actual hiring plan, not just "investor said 12%"
- [ ] Pre-money pool dilution math shown (founders absorb it)
- [ ] 4-year vest + 1-year cliff applied to all grants
- [ ] No single-trigger acceleration outside execs
- [ ] 409A valuation procured before first grant
- [ ] Refresh / retention buffer included in pool size

## Next
- Apply to cap table → `/cap-table-design`
- Dilution at Series A → `/dilution-scenarios`
- Comp philosophy → `/equity-comp-philosophy`
- First hire plan → `/first-hire-plan`
```

## Verification
- Hiring plan with per-role equity %.
- Sum + buffer → math-justified pool size.
- Pre-money dilution math made explicit (founders absorb it).
- Vesting standard (4y / 1y cliff / monthly) applied.
- 409A valuation called out.
- Negotiation target vs investor ask explicit.
