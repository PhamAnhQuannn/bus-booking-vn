---
name: north-star-metric-pick
description: Pick the one north-star metric the whole team optimizes for. Avoid vanity. Outputs to `docs/inception/north-star-<project>.md`. Use when user says "north star metric", "NSM", "one metric", "OMTM", "/north-star-metric-pick", or before setting OKRs.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /north-star-metric-pick — One Metric, Or You Are Not Aligned

## Why you'd care

Without one north-star metric, every team optimizes for its own dashboard and the company pulls in five directions. Picking the OMTM is the cheapest organizational alignment money can buy.

If everyone optimizes for a different metric, the team drifts apart. Pick one that proxies customer value AND business value.

## Pre-flight
Run after `/mvp-success-criteria`, `/analytics-spec`. Pairs with `/okr-tree`, `/kpi-dashboard-investors`.

## Inputs
- Product type (transactional / SaaS / marketplace / consumer / dev tool).
- Customer value moment (when do they realize value?).
- Business model (subscription / transaction fee / ads / etc).

## Process
1. **3 tests for a good NSM:**
   - **Leading** — moves before revenue (not lagging)
   - **Reflects value** — customer can't fake liking it
   - **Drives business** — improving it improves the P&L
2. **By product type — common patterns:**
   - **B2B SaaS** — weekly active accounts (not seats); active workflows per account; AHA-moment events per week
   - **Consumer SaaS** — DAU/MAU ratio; sessions per user per week; specific value action per week
   - **Marketplace** — matched transactions per week (both sides); GMV per cohort
   - **Dev tool** — active integrations / API calls per dev per week
   - **Creator tool** — pieces of content published per creator per week
   - **Communication** — messages sent / received per user per week
3. **Pick 3 candidates** → pressure-test each:
   - Does it move ahead of revenue? (leading)
   - Can users game it without getting value? (vulnerable to vanity)
   - Does improving it correlate with retention?
4. **Pick ONE** — others become input metrics.
5. **Input metric tree** — sub-metrics that feed the NSM (5-10).
6. **Counter-metric** — what could go wrong if NSM is gamed?
7. **Set baseline + target** — where are we, where to be in 90 days.
8. **Dashboard placement** — visible to whole team, weekly review.

## Output
Write `docs/inception/north-star-<project>.md`:

```markdown
# North Star Metric — <project>
**Date:** <YYYY-MM-DD>
**Product type:** B2B SaaS (cross-functional ops)
**Stage:** pre-launch / early customers

## NSM candidates considered
| Candidate | Leading? | Value-proxy? | Drives biz? | Gameable? | Verdict |
|-----------|----------|--------------|-------------|-----------|---------|
| Weekly active accounts | ✓ | weak | ✓ | yes (seat-add gaming) | reject |
| Workflows completed per account per week | ✓ | ✓ | ✓ | no | ⭐ pick |
| Total API calls | ✓ | weak (volume ≠ value) | partial | yes | reject |

## Picked NSM
**Workflows completed per account per week (WCAW)**

**Definition:** A workflow = a multi-step cross-functional process (e.g., onboarding new hire, weekly business review). "Completed" = all steps closed with at least one human acknowledgment per step.

**Why:**
- Leading: account doing 5+ WCAW retains > 95%; account doing 0-1 churns within 90 days
- Value-proxy: completing a workflow = customer got the value they signed up for
- Drives biz: NRR + retention math directly tied
- Hard to fake: requires actual cross-team participation

## Baselines + targets
| Window | WCAW (median account) | NSM total | Notes |
|--------|----------------------|-----------|-------|
| Today | 2.1 | 220 | 100 accounts active |
| 30 days | 3.0 | 450 | onboarding ramp |
| 90 days | 5.0 | 1,500 | activation tightening |
| 180 days | 6.5 | 3,200 | mature mix |

## Input metric tree
```
WCAW (workflows completed / account / week)
├── Workflows started / account / week
│   ├── Active users / account
│   ├── Workflow templates discovered
│   └── First-time-launch rate
├── Workflows completed / started ratio
│   ├── Steps assigned vs completed
│   ├── Time-to-completion p50/p90
│   └── Abandoned workflow rate
└── Workflow stickiness
    ├── Repeat workflow rate
    └── Template re-use rate
```

## Counter-metric
**Workflow-completion-per-active-user** — guard against the "1 admin creates 50 fake workflows" gaming scenario. Watch for divergence.

## Dashboard placement
- Pinned in Slack #metrics channel — daily auto-post
- Weekly review in operating cadence (`/weekly-operating-rhythm`)
- Quarterly target reset

## Review cadence
| Cadence | Question |
|---------|----------|
| Daily | Did WCAW move? Why? |
| Weekly | Cohort split: new vs mature WCAW? Trend? |
| Monthly | NSM ↔ NRR correlation still holding? |
| Quarterly | Is the NSM still the right one? |

## Anti-patterns avoided
- ❌ MAU as NSM for B2B → can grow without value
- ❌ Total signups → ego metric, doesn't reflect value
- ❌ Page views → no value tied
- ❌ NPS as NSM → important but lagging + slow
- ❌ Revenue as NSM → lagging; we want a leading proxy

## Pitfalls flagged
- [ ] NSM is leading (not lagging revenue)
- [ ] NSM is hard to game without delivering value
- [ ] Input metric tree mapped (5-10 sub-metrics)
- [ ] Counter-metric named (guards against gaming)
- [ ] Baseline + 90-day target set
- [ ] Dashboard placement + cadence locked
- [ ] Anti-patterns explicitly rejected

## Next
- OKR scaffold → `/okr-tree`
- Investor KPI dashboard → `/kpi-dashboard-investors`
- Analytics spec → `/analytics-spec`
- Operating rhythm review → `/weekly-operating-rhythm`
```

## Verification
- 3 candidates pressure-tested.
- ONE NSM picked with explicit definition.
- Input metric tree drawn.
- Counter-metric named.
- Baselines + 90-day targets.
- Dashboard placement + review cadence.
