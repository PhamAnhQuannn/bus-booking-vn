---
name: vanity-metric-audit
description: Audit dashboards for vanity metrics that go up and don't correlate with revenue/retention so leadership stops celebrating noise. Outputs to `docs/product/vanity-audit.md`. Reads `/project-classify` to skip XS. Use when user says "vanity metric", "metric audit", "what metrics matter", "real vs vanity", "/vanity-metric-audit", or before fundraising / board meeting.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /vanity-metric-audit — Strip the Vanity

Invoke as `/vanity-metric-audit`. A metric is vanity if it goes up while the business stays the same. Audit your dashboards, kill or demote the noise, promote the actionable.

## Why you'd care

Dashboards full of metrics that go up regardless of revenue or retention are how leadership teams celebrate themselves into oblivion. An audit is what surfaces the numbers that actually correlate with the outcome.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Existing dashboards / metrics list.
3. ≥3 months of data to test correlation.

## Inputs
- Current dashboard inventory (URL + metric list)
- Target outcome metric (revenue / retention / NRR / NSM)
- Pitch deck / board deck metrics (often the worst offenders)

## Process

1. **Three-question filter** — for every metric:

   | Question | If "no", metric is suspect |
   |---|---|
   | Is it actionable? (someone can change it next week) | vanity |
   | Does it predict something downstream? (correlated with revenue/retention) | vanity |
   | Is it comparable over time? (definition stable, no per-period changes) | drift |

   Two "no" answers → demote or kill.

2. **Common vanity offenders**:

   | Vanity metric | Why | Replace with |
   |---|---|---|
   | Total signups (cumulative) | only goes up; doesn't measure recent | weekly new signups + activation rate |
   | MAU | counts logins; says nothing about value | WAU doing key action |
   | Pageviews | bots + bounces | sessions with key action |
   | Total downloads | one-time; no engagement | retained installs at D7/D30 |
   | Followers / subscribers | acquisition only | engaged subs (% opening, % clicking) |
   | "Engagement" generic | ill-defined | specific key actions per user per week |
   | Cumulative revenue | always up | MRR + new MRR + churn MRR |
   | "Users helped" | unmeasured value claim | survey-backed CSAT or task-success rate |

3. **Correlation test** — proves predictive:
   - Pull 12 weeks of each metric + target (revenue / retention)
   - Pearson or Spearman correlation
   - Lag the metric (last week's metric vs this week's revenue)
   - Strong (|r| > 0.5) and direction-correct → keep
   - Weak (|r| < 0.2) → demote
   - Noisy / paradoxical → kill

4. **Definition audit**:

   | Question | Action if "no" |
   |---|---|
   | Is there one SQL source? | consolidate |
   | Is the time window pinned? | fix |
   | Is the population filter explicit? | fix |
   | Has the definition changed silently? | annotate + backfill |
   | Is there an owner? | assign or kill |

5. **Promote / demote / kill matrix** — for each metric:

   | Decision | Where it lives |
   |---|---|
   | Promote | top of north-star dashboard |
   | Keep | functional dashboards (eng, growth, CS) |
   | Demote | hidden tab, available on demand |
   | Kill | remove from all dashboards + decks |

6. **Pitch deck check** — usually the worst offenders:
   - "10,000 signups!" without active rate
   - "10M pageviews!" without conversion
   - "1M users!" with no MAU
   - Total $ transacted (when revenue is take rate)
   - Replace with revenue, retention, NRR, NSM, ARR — investors who matter look for these anyway.

7. **Comms script** — selling the strip:
   - "We're focusing on metrics that predict our next month, not our last quarter"
   - Show before/after dashboard: "now leadership sees 5 numbers, not 50"
   - One-time discomfort ("but my signup chart!") → faster decisions

8. **Anti-patterns**:
   - Keeping vanity "because investors expect it" — find better investors
   - Demoting without removing — still distracts
   - One-time audit, no recurrence — drift returns
   - Audit without owner — recommendations die in doc
   - Removing engagement metric without replacement — leaves a hole

## Output

Write `docs/product/vanity-audit.md`:

```markdown
# Vanity Metric Audit — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <PM/data>

## Filter
Actionable? Predictive? Stable? → 2 No's = demote/kill.

## Inventory table
| Metric | Actionable | Predictive (r) | Stable def | Decision | Replace with |
|---|:--:|:--:|:--:|---|---|
| Total signups | NO | 0.1 | YES | demote | Weekly new + activation |
| MAU | weak | 0.3 | YES | demote | WAU + key action |
| Pageviews | NO | 0.05 | NO | KILL | Session+action |
| Cumulative revenue | NO | n/a | YES | demote | MRR + NRR |
| Active accounts (NSM) | YES | 0.7 | YES | promote | — |
| Activation rate D7 | YES | 0.6 | YES | promote | — |

## Pitch deck rewrite
Before / after — bulleted swap list.

## Comms
"Here's why we're hiding signups."

## Cadence
- Re-audit quarterly
- Definition change requires PR + backfill + announce
```

## Verification
- Every metric in scope passes Actionable/Predictive/Stable filter.
- Correlation test run on ≥12 weeks of data.
- Each metric has a decision: promote/keep/demote/kill.
- Pitch deck reviewed + updated.
- Quarterly re-audit scheduled.
