---
name: raci-chart
description: Build a RACI chart per workstream — Responsible / Accountable / Consulted / Informed. Outputs to `docs/inception/raci-<project>.md`. Use when user says "RACI", "responsibilities", "who owns what", "decision rights", "/raci-chart", or when 2+ people overlap on workstreams.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /raci-chart — Two People "Responsible" Means Zero Are

RACI is unsexy and prevents the worst kind of dropped balls. Solo founder? Skip. Co-founders + 1 hire? Required.

## Why you'd care

When two people think they own a decision, it gets made twice and contradictorily; when zero people own it, it doesn't get made at all. RACI is the antidote to both failure modes.

## Pre-flight
Run after `/co-founder-prenup`, `/milestone-gantt`. Pairs with `/founders-agreement`, `/decision-log-bootstrap`.

## Inputs
- Workstreams from roadmap (product, eng, design, sales, marketing, ops, legal, fundraise, etc).
- People: founders + advisors + hires.
- Decision rights already implicit (often unclear).

## Process
1. **List workstreams** — granular enough that owner is unambiguous:
   - Product roadmap decisions
   - Engineering architecture
   - Customer interviews
   - Pricing decisions
   - Hiring decisions
   - Investor relations
   - Marketing / content
   - Sales pipeline
   - Legal / contracts
   - Finance / cap table
   - Board / governance
2. **Per workstream assign:**
   - **R (Responsible)** — does the work; can be multiple
   - **A (Accountable)** — single owner, signs off; never split
   - **C (Consulted)** — input needed before decision
   - **I (Informed)** — kept in the loop post-decision
3. **One A only** — most common RACI failure. Force single Accountable.
4. **Avoid all-As-on-everything** — that's not how it works.
5. **Decision rights doc** — for big calls (raise, hire, fire, kill product) explicit decision rules.
6. **Override clauses** — who breaks ties.
7. **Review when** — new hire, role change, conflict arises.

## Output
Write `docs/inception/raci-<project>.md`:

```markdown
# RACI Chart — <project>
**Date:** <YYYY-MM-DD>
**Team:** Founder A (CEO), Founder B (CTO), Eng #1 (Senior Eng, M4+)
**Review:** quarterly + at any role change

## Notation
- **R** = Responsible (does the work)
- **A** = Accountable (single sign-off, the buck stops here)
- **C** = Consulted (input before decision)
- **I** = Informed (loop in after)

## Workstreams

### Product
| Item | Founder A (CEO) | Founder B (CTO) | Eng #1 |
|------|-----------------|-----------------|--------|
| Roadmap (12-mo) | A | C | I |
| Roadmap (90-day) | A | R | C |
| Feature prioritization | A | R | C |
| Customer interview synthesis | A | R | I |
| Pricing changes | A | C | I |

### Engineering
| Item | A | B | Eng #1 |
|------|---|---|--------|
| Stack picks | I | A | C |
| Architecture decisions (ADRs) | I | A | R |
| Code review | I | R | R |
| Production incidents | I | A | R |
| Security posture | C | A | R |

### Customer
| Item | A | B | Eng #1 |
|------|---|---|--------|
| Interview cadence | A | C | I |
| Customer feedback synthesis | A | R | I |
| Customer renewal / churn | A | C | I |
| Demos | A | I | I |
| Support escalation | A | R | C |

### Sales / Marketing
| Item | A | B | Eng #1 |
|------|---|---|--------|
| Sales playbook | A | C | I |
| Content (writing) | R | A | I |
| Community management | R | A | I |
| Press / PR | A | C | I |
| Paid acquisition | A | C | I |

### Hiring
| Item | A | B | Eng #1 |
|------|---|---|--------|
| Role definition | A | C | C (for eng) |
| Sourcing | R | R | R (eng only) |
| Hiring decision (offer extended) | A | A* | C |
| Comp + equity decisions | A | C | I |
| Performance management | A | A* | I |

*Founder A and B are jointly accountable on hiring decisions = exception, both must agree. If disagree, see Decision Rights below.

### Fundraise / Finance
| Item | A | B | Eng #1 |
|------|---|---|--------|
| Investor relations | A | C | I |
| Cap table | A | C | I |
| Burn / runway | A | C | I |
| Banking / payments | A | C | I |
| Board reporting | A | C | I |

### Legal
| Item | A | B | Eng #1 |
|------|---|---|--------|
| Entity, contracts, IP | A | C | I |
| Privacy / security | C | A | R |
| Employment agreements | A | C | I |
| Investor docs | A | C | I |

## Decision rights (big calls)
| Decision | Rule | Override |
|----------|------|----------|
| Hire/fire | Founder A + B must agree | None — if persistent split, see prenup arbitration clause |
| Raise round | Founder A leads; Founder B has veto on terms | Both sign |
| Kill a product line | Both must agree | None |
| Major partnership (>$50k or exclusivity) | A decides, B consulted | A has final say |
| Equity grants > 1% | Both sign | Board if board seated |
| Pricing change | A decides, B informed | A |
| Architecture rewrite | B decides, A informed | B |

## Conflict resolution
1. Direct conversation between founders
2. If unresolved 48hrs → advisor (named in `/founders-agreement`) mediates
3. If still unresolved → arbitration per founders agreement

## When to update
- New hire that adds workstreams
- Role change (e.g., Founder B starts running sales)
- Repeated conflict on a decision = ambiguity in RACI
- Investor / board joins → governance update
- Quarterly review even if nothing changed

## Anti-patterns avoided
- ❌ Two As on the same item ("we both decide") — paralyzes
- ❌ No A ("the team decides") — accountability vacuum
- ❌ A different from R when one person could be both — adds bureaucracy
- ❌ Hidden Cs ("oh by the way I disagree") — surface upfront

## Pitfalls flagged
- [ ] Single A per item (no doubles)
- [ ] R can be multiple but A cannot
- [ ] Decision rights document for big calls
- [ ] Conflict resolution path explicit
- [ ] Update triggers named (hiring, role change, conflict)
- [ ] Quarterly review cadence

## Next
- Founders agreement formalizes → `/founders-agreement`
- Decision log feeds → `/decision-log-bootstrap`
- Operating cadence → `/weekly-operating-rhythm`
- Board governance → `/board-of-directors-setup`
```

## Verification
- Workstreams listed, granular enough.
- R/A/C/I assigned per item.
- Single A per workstream item.
- Decision rights doc for big calls.
- Conflict resolution path explicit.
- Update / review triggers named.
