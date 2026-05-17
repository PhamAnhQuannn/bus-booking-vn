---
name: cap-table-design
description: Founder / CFO / general counsel responsibility — design initial cap table — founder splits, ESOP, vesting, anti-dilution. Outputs to `docs/inception/cap-table-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "cap table", "equity split", "founder shares", "CFO cap table", "general counsel equity structure", "/cap-table-design", or before incorporation.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /cap-table-design — Cap Table

Invoke as `/cap-table-design`. Get this right at incorporation. Hardest to fix later.

## Why you'd care

A cap table designed at incorporation without ESOP, vesting, and anti-dilution thought-through is the artifact every future round will inherit. Get the splits and structures right once — fixing them later requires every shareholder's signature.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (solo, no cap table needed)
2. Read `docs/inception/funding-<project>.md` if exists.

## Inputs
- Founder count + name + role.
- Time-to-product (months pre-incorporation).
- ESOP plan (yes/no, target %).
- Funding path (per `/funding-strategy`).

## Process
1. **Founder split heuristic** — see `/equity-split` for full framework. Default: equal unless asymmetry justified (idea, capital, time, network, risk).
2. **ESOP carve-out** — pre-money:
   - Pre-seed: 10% ESOP
   - Seed: 12–15% ESOP
   - Series A: 15–20% ESOP top-up
3. **Vesting schedule**:
   - Standard: 4 yr vest, 1 yr cliff
   - Founder vesting from incorporation (NOT founding date — common mistake)
   - Acceleration: single-trigger (acquisition) or double-trigger (acq + termination)
4. **Anti-dilution** — for early money (founders bear; not founders' choice usually):
   - Weighted average broad-based (standard, fair)
   - Full ratchet (founder-hostile, avoid)
5. **Common vs preferred** — preferred for investors (liquidation preference), common for founders + employees.
6. **Liquidation preferences** — 1x non-participating standard; >1x or participating = founder-hostile.
7. **Cap table tooling** — Carta / Pulley / spreadsheet at start.

## Output
Write `docs/inception/cap-table-<project>.md`:

```markdown
# Cap Table — <project>
**Date:** <YYYY-MM-DD> | **Incorporation date:** <YYYY-MM-DD>

## Founders
| Name | Role | Shares | % | Vesting start | Acceleration |
|---|---|--:|--:|---|---|
| Alice | CEO | 4,500,000 | 45% | <date> | double-trigger |
| Bob | CTO | 4,500,000 | 45% | <date> | double-trigger |
| Carol | (advisor → founder?) | TBD | TBD | — | — |

## ESOP
- Pool: 1,000,000 (10% post-money)
- Vesting: 4 yr / 1 yr cliff per grant
- Pool refresh trigger: at next priced round

## Total authorized shares
- Common: 9,000,000 (founders) + 1,000,000 (ESOP pool) = 10,000,000
- Preferred: TBD at first priced round

## Founder vesting detail
- Schedule: 4 yr monthly vest after 1 yr cliff
- Cliff date per founder: <Y1+1>
- Full vest date: <Y1+4>
- Acceleration:
  - Single-trigger (acq alone): no
  - Double-trigger (acq + involuntary termination): yes
- Repurchase right (board): yes for unvested

## Funding scenarios (post-money cap table)
| Round | Raise | Pre-money | Post-money | Founders % | ESOP % | Investors % |
|---|--:|--:|--:|--:|--:|--:|
| Today | — | — | — | 90% | 10% | 0% |
| Pre-seed | $500k | $4M | $4.5M | 80% | 9% | 11% |
| Seed | $2M | $12M | $14M | 69% | 8% (top up to 12%) | + 14% |
| Series A | $8M | $40M | $48M | 58% | 10% (top up to 15%) | + 17% |

## Standard term sheet defaults to negotiate
- Liquidation preference: 1x non-participating (NOT participating)
- Anti-dilution: weighted average broad-based (NOT full ratchet)
- Voting: pari-passu with common except for protective provisions
- Board: 2 founder + 1 investor + 1 indep (3+1+1 typical Series A)
- Pro-rata rights: yes for major investors
- Drag-along: yes
- Founder vesting: yes from incorporation

## Tooling
- Cap table software: Carta / Pulley / spreadsheet (for now)
- Equity grants: software-tracked
- 409A valuation (US): required when issuing options

## Anti-patterns
- ✗ Vesting from "founding date" instead of incorporation (unenforceable)
- ✗ No founder vesting at all (one founder leaves keeps all shares)
- ✗ Issuing >5% to advisors at start (dilutive long-term)
- ✗ ESOP pool too small at first round (refresh dilutes founders)
- ✗ Full ratchet anti-dilution (avoid in any term sheet)
```

## Verification
- Founder shares + % named.
- ESOP pool sized per stage.
- Vesting schedule + acceleration explicit.
- Cap table evolved through 3 rounds.
- Anti-patterns called out.
