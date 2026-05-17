---
name: funding-strategy
description: Pick funding path — bootstrap / angel / VC / grant / debt / revenue-based. Outputs to `docs/inception/funding-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "funding", "raise", "VC", "bootstrap", "/funding-strategy", or before commit.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 8h
---

# /funding-strategy — Funding Path

## Why you'd care

Defaulting to VC when bootstrap or revenue-based financing would have preserved control and avoided the growth-at-all-costs treadmill is the most common founder regret. The strategy doc forces the comparison before the first investor meeting.

Invoke as `/funding-strategy`. Funding shapes incentives. Wrong path = wrong company.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (default bootstrap)
2. Read `docs/inception/runway-<project>.md` + `pro-forma-<project>.md` if exist.

## Inputs
- TAM (per `/market-sizing`).
- Capital required to PMF.
- Founder appetite for dilution / governance / exit timeline.
- Stage of evidence (pre-seed / seed / Series A criteria).

## Process
1. **Path × fit matrix**:
   - **Bootstrap** — small market, lifestyle OK, no need for speed
   - **Customer-funded (revenue from D1)** — services/consulting transition
   - **Angel** — $25k–$500k, light governance
   - **Pre-seed VC** — $500k–$2M, board seat
   - **Seed VC** — $2M–$5M, board + structure
   - **Series A VC** — $5M–$20M, hire, scale
   - **Strategic CVC** — corporate VC, partnership lever, governance complications
   - **Grants** — non-dilutive (SBIR, EU Horizon, climate funds), slow
   - **Venture debt** — post-Series A, extends runway
   - **Revenue-based financing** (RBF) — repaid as % of revenue
   - **Crowdfunding** — Kickstarter (consumer hardware) / WeFunder (regulation CF)
2. **Each path's required evidence**:
   - Bootstrap: just product
   - Angel: founding story + early signal
   - Pre-seed VC: theme + team + small evidence
   - Seed: PMF signal + early traction ($10k MRR)
   - Series A: PMF + repeatable GTM + $1M+ ARR
   - Grant: fits theme + technical merit + report capacity
3. **Dilution math** — per round expected dilution; cap table after 3 rounds.
4. **Founder fit check** — VC = chase $1B+ outcome; bootstrap = own it; if mismatch don't take VC.
5. **Default plan** — pick 1 primary + 1 backup.

## Output
Write `docs/inception/funding-<project>.md`:

```markdown
# Funding Strategy — <project>
**Date:** <YYYY-MM-DD>

## Path-fit matrix
| Path | Fit | Evidence have? | Founder appetite | Verdict |
|---|---|---|---|---|
| Bootstrap | high | ✓ | yes | PRIMARY |
| Angel | med | partial | open | BACKUP |
| Pre-seed VC | low | weak | reluctant | NO |
| Seed VC | low | none | reluctant | NO |
| Grant (NSF SBIR) | med | ✓ tech merit | yes | PARALLEL |
| Revenue-based | low | no MRR yet | open | LATER |

## Primary plan
**Bootstrap** for 12 mo to $5k MRR. Re-evaluate.

## Backup plan
**Angel raise $250k** if MRR <$500/mo by M9. Use to extend runway 12 mo.

## Parallel
**SBIR Phase I ($150k non-dilutive)** if technical work fits — apply Q1.

## Dilution scenarios (if any equity raise)
| Round | Pre-money | Raise | Dilution | Founder % after |
|---|--:|--:|--:|--:|
| Pre-seed | $4M | $500k | 11% | 89% |
| Seed | $12M | $2M | 14% | 76% |
| Series A | $40M | $8M | 17% | 64% |
| Series B | $120M | $20M | 14% | 55% |

## Founder fit declaration
- Outcome ambition: <lifestyle / midsize $50M exit / $1B+>
- Time horizon: <5 / 10 / 15 yr>
- Governance comfort: <solo / advisors / board>
- Geography: <X>
- → Implied path: <Y>

## Anti-pattern
- ✗ VC funding for $5M-TAM lifestyle business
- ✗ Bootstrap for capital-intensive infra play
- ✗ Grant-only with no commercial path
- ✗ Crowdfunding for non-tangible product

## Decision deadline
By <date>: confirm path + start outreach if needed.
```

## Verification
- All 11 paths triaged.
- Primary + backup + parallel paths chosen.
- Dilution math if equity.
- Founder-fit declaration explicit.
- Anti-pattern check applied.
