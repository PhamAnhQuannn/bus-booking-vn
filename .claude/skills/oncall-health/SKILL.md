---
name: oncall-health
description: Track oncall load — page frequency, after-hours, sleep disruption, weekend pages. Burnout early warning. Outputs quarterly oncall-health report to `docs/operate/oncall-health-<YYYY-Q>.md`. Reads `/project-classify` to skip XS/S. Use when user says "oncall health", "burnout", "page volume", "/oncall-health", or quarterly.
output_size:
  XS: skip
  S: skip
  M: 2h
  L: 4h
  XL: 4h
---

# /oncall-health — Oncall Burden Audit

## Why you'd care

Pager burnout is invisible until your senior engineer quits, and by then the team's institutional knowledge walks out the door. A quarterly health report surfaces the load before it costs the headcount.

Invoke as `/oncall-health`. Heroes are a smell. If one person carries the pager, you have a single point of failure. Measure load so you can lower it.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS/S → SKIP.
2. PagerDuty/Opsgenie/incident.io export available for trailing quarter.
3. Rotation has ≥2 people per shift.

## Inputs
- Page log (last 90 days)
- Rotation schedule
- Sleep-window definition (e.g., 22:00–07:00 local)
- Weekend definition

## Process

1. **Metrics per oncall**:

   | Metric | Threshold healthy | Threshold concerning |
   |---|---|---|
   | Pages / shift | ≤2 | >5 |
   | After-hours pages / week | ≤1 | >3 |
   | Sleep-window pages / month | ≤2 | >5 |
   | Weekend pages / month | ≤1 | >3 |
   | Auto-resolved (false) % | <10% | >30% |
   | Pages requiring code change | — | high = systemic |

2. **Per-person view** — surface skew:
   - Total pages, after-hours, sleep-window per oncaller
   - If one person carries >2× median, rebalance

3. **Top alert sources** — Pareto:
   - Rank alerts by page count
   - Top 3 alerts likely cause >50% of load
   - Each top alert → action: tune threshold, add auto-remediation, deprecate, or accept

4. **Followup tracking**:
   - Every page generates a ticket: "is this alert still needed? was it actionable? root-cause fix scoped?"
   - Pages without followup ticket → process gap

5. **Survey questions** (quarterly, 5min):
   - "Did oncall disrupt your sleep this quarter?" 1–5
   - "Did you feel adequately staffed?" 1–5
   - "Were runbooks helpful when paged?" 1–5
   - "Anything you want changed?" free text

6. **Action triggers**:
   - >5 pages/shift median → halt feature work, fix top alerts
   - Any oncall reports sleep disruption ≥3 nights/month → mandatory rebalance
   - >30% auto-resolved → noisy-alert audit
   - Survey score <3 on staffing → grow rotation

## Output

Write `docs/operate/oncall-health-<YYYY-Q>.md`:

```markdown
# Oncall Health — <YYYY-Q>
**Date:** <YYYY-MM-DD> | **Owner:** VP Eng | **Rotation:** <name>

## Headline metrics
| Metric | This Q | Last Q | Threshold |
|---|---:|---:|---|
| Median pages/shift | <N> | <N> | ≤2 |
| After-hours/week | <N> | <N> | ≤1 |
| Sleep-window/month | <N> | <N> | ≤2 |
| Weekend/month | <N> | <N> | ≤1 |
| Auto-resolved % | <N%> | <N%> | <10% |

## Per-person load
| Person | Pages | After-hours | Sleep | Weekend |
|---|---:|---:|---:|---:|
| <name> | <N> | <N> | <N> | <N> |

## Top alert sources
1. <alert> — N pages — action: <tune/auto-remediate/deprecate>
2. <alert> — N pages — action: <...>
3. <alert> — N pages — action: <...>

## Survey
- Sleep disruption: <avg>
- Staffing adequacy: <avg>
- Runbook helpfulness: <avg>
- Top free-text themes: <list>

## Actions
| Action | Owner | Due |
|---|---|---|
| Tune <alert> threshold | <name> | <date> |
| Add <Nth> person to rotation | <name> | <date> |

## Trend
- Quarter-over-quarter: <improving/flat/worsening>
- Trigger hit: <e.g., median >5 pages/shift — feature freeze>
```

## Verification
- Per-person load broken out (not just averages).
- Top 3 alerts have an action each.
- Survey run + summarized.
- Sleep + weekend tracked separately from raw page count.
- Action items have owners + dates.
