---
name: roadmap-12-month
description: 12-month product + business roadmap — quarter by quarter, with milestones, dependencies, kill criteria per bet. Outputs to `docs/inception/roadmap-12-month-<project>.md`. Use when user says "12-month plan", "annual roadmap", "yearly plan", "Q1-Q4", "/roadmap-12-month", or before fundraise / annual planning.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /roadmap-12-month — Plan The Year, Bet Per Quarter

12-month roadmap = guess, not promise. Show direction + bets + kill criteria, not pixel-perfect features.

## Why you'd care

A year without a roadmap is a year of context-switching driven by whoever asked last. Quarterly bets with kill criteria is what lets you say "not this quarter" without losing the relationship.

## Pre-flight
Run after `/north-star-metric-pick`, `/mvp-scope`, `/runway-model`. Pairs with `/roadmap-90-day`, `/milestone-gantt`.

## Inputs
- North star metric + 12-month target.
- Runway (months of cash).
- Team capacity per quarter.
- Top-5 critical assumptions to test.
- Customer commitments (if any).

## Process
1. **Frame each quarter as a bet, not a feature list:**
   - Q1: Validate problem-solution fit → North star X
   - Q2: Validate product-market fit → North star Y
   - Q3: Validate channel-fit → North star Z
   - Q4: Scale + raise next round
2. **Per quarter, define:**
   - **Theme** (1 sentence)
   - **NSM target**
   - **3-5 milestones**
   - **Key bets** (what we're testing)
   - **Kill / pivot criteria** (when to abandon)
3. **Dependencies** — show which quarter unlocks the next.
4. **Capacity reality** — solo + 1 hire = ~250-300 days dev. Don't overload.
5. **Buffer 30%** — surprises happen; add slack.
6. **Reverse-plan from funding milestones** — when must metrics be true to raise A?
7. **Three scenarios** — base / aggressive / conservative — pick 1 to commit, others to monitor.
8. **Revisit quarterly** — roadmap is a living doc.

## Output
Write `docs/inception/roadmap-12-month-<project>.md`:

```markdown
# 12-Month Roadmap — <project>
**Date:** <YYYY-MM-DD>
**NSM:** Workflows completed per account per week (WCAW)
**Current:** 2.1 WCAW, 100 accounts, $20k MRR
**Year-end target (base):** 6.5 WCAW, 800 accounts, $250k ARR

## Quarter overview
| Q | Theme | NSM target | Key bet | Kill criteria |
|---|-------|------------|---------|---------------|
| Q1 | Activation + retention | 3.0 WCAW | New onboarding cuts time-to-aha from 7d → 2d | M3: still > 5d → rethink onboarding |
| Q2 | Channel-fit | 4.5 WCAW, 300 accts | Content + community sources 40% pipeline | M6: < 20% from content → pivot to outbound |
| Q3 | Expansion (NRR) | 5.5 WCAW, 500 accts | Multi-team accounts expand 2x seats | M9: NRR < 105% → cut expansion bets |
| Q4 | Series A readiness | 6.5 WCAW, 800 accts, $250k ARR | Investor traction package | M12: < $200k ARR → extend runway 6mo, don't raise |

## Q1 (Activation + Retention) — Apr-Jun
**Theme:** Get accounts from "signed up" to "doing 3+ workflows/week" fast
**NSM target:** 2.1 → 3.0
**Milestones:**
- [ ] New onboarding flow shipped (M2)
- [ ] First 50 cohort hits 3 WCAW by week 4 (M2)
- [ ] Activation analytics dashboard live (M1)
- [ ] 10 onboarding interview cycles (M1-3)
- [ ] Self-serve trial conversion > 8%

**Key bet:** Re-designed onboarding cuts time-to-aha from 7d to 2d, lifting WCAW
**Kill criteria:** if median time-to-3-WCAW > 5 days after onboarding redesign, rethink approach
**Dependency:** none

## Q2 (Channel-Fit) — Jul-Sep
**Theme:** Find one or two channels that work, beat blended CAC < $400
**NSM target:** 3.0 → 4.5; accounts 100 → 300
**Milestones:**
- [ ] Content engine producing 6 hero pieces (M5-6)
- [ ] Community at 500 members, 100 WAU (M6)
- [ ] Newsletter sponsorships pilot (2 of 4 hit CAC < $50) (M5)
- [ ] Paid channels tested (Google + LinkedIn) → drop/scale (M6)

**Key bet:** Content + community will source 40% of pipeline by M6
**Kill criteria:** if content sourced < 20% by M6, pivot 50% of GTM budget to outbound
**Dependency:** Q1 activation must work — otherwise channel CAC won't pay back

## Q3 (Expansion / NRR) — Oct-Dec
**Theme:** Land-and-expand starts working; NRR > 110%
**NSM target:** 4.5 → 5.5; accounts 300 → 500
**Milestones:**
- [ ] Seat expansion playbook live (M7)
- [ ] Cross-team add-on shipped (M8)
- [ ] CSM ratio: 1 CSM : 100 accounts (M8)
- [ ] Annual prepay program (M9)

**Key bet:** Multi-team accounts expand 2x seats within 90 days
**Kill criteria:** NRR < 105% at M9 → cut expansion bets, refocus on top-of-funnel
**Dependency:** Q2 channels must produce enough accounts to test expansion at scale

## Q4 (Series A Readiness) — Jan-Mar
**Theme:** Get to $250k ARR + clean metrics for institutional raise
**NSM target:** 5.5 → 6.5; accounts 500 → 800; ARR → $250k
**Milestones:**
- [ ] Investor deck v2 + data room ready (M11)
- [ ] Lead investor conversations (15 firms targeted) (M11-12)
- [ ] Hire VP Sales (M11)
- [ ] Audited financials + 409A refresh (M11)

**Key bet:** Metrics + narrative warrant $5-8M Series A
**Kill criteria:** if < $200k ARR at M12 → extend runway 6 months (cut burn), don't raise A on weak metrics
**Dependency:** Q3 expansion + Q2 channel must compound

## Capacity reality check
| Q | Solo dev | +1 eng (M4+) | Total dev-days | Allocated | Buffer |
|---|----------|--------------|---------------|-----------|--------|
| Q1 | 60 | — | 60 | 50 | 17% |
| Q2 | 60 | 60 | 120 | 95 | 21% |
| Q3 | 60 | 60 | 120 | 95 | 21% |
| Q4 | 30 (fundraise eats) | 60 | 90 | 70 | 22% |

## Three scenarios
| | Conservative | Base | Aggressive |
|---|--------------|------|------------|
| Q4 ARR | $120k | $250k | $500k |
| Headcount | 2 | 4 | 6 |
| Burn | $25k/mo | $50k/mo | $80k/mo |
| Series A timing | M18 | M12 | M9 |
| Runway at M12 | 18mo | 12mo | 9mo |

**Committed:** Base. Aggressive triggered only if Q1+Q2 both beat targets.

## Quarterly review template
- Did we hit NSM target?
- Did we hit milestones?
- Did the key bet pan out? (or did kill criteria fire?)
- What new info changes the next quarter's plan?
- Is the year-end target still realistic?

## Pitfalls flagged
- [ ] Each quarter = bet, not feature list
- [ ] Kill criteria per quarter (not just success criteria)
- [ ] Capacity reality-checked (not aspirational)
- [ ] 30% buffer included
- [ ] Three scenarios shown (commitment = base)
- [ ] Quarterly review on calendar
- [ ] NSM target per quarter

## Next
- 90-day deep dive → `/roadmap-90-day`
- Milestone Gantt → `/milestone-gantt`
- Kill criteria deep → `/kill-criteria-doc`
- OKR scaffold → `/okr-tree`
- Runway sync → `/runway-model`
```

## Verification
- 4 quarters with theme + NSM target + bet + kill criteria.
- Capacity reality-checked with buffer.
- Dependencies between quarters explicit.
- 3 scenarios shown, base committed.
- Quarterly review cadence.
