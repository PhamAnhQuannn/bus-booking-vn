---
name: north-star-instrumentation
description: Wire a single north-star metric into the product so every team sees the same number every day. Outputs to `docs/product/north-star.md` + dashboard config. Reads `/project-classify` to skip XS. Use when user says "north star metric", "NSM", "one metric that matters", "OMTM", "/north-star-instrumentation", or after picking NSM via `/north-star-metric-pick`.
output_size:
  XS: skip
  S: skip
  M: 4h
  L: 4h
  XL: 8h
---

# /north-star-instrumentation — Wire the One Metric

## Why you'd care

An NSM that lives in a slide deck and not in a dashboard isn't a north star, it's a wish. Wiring the metric into the product is what makes every team see the same number every day.

Invoke as `/north-star-instrumentation`. Picking the NSM is a one-day workshop. Wiring it so everyone watches the same number every day is the actual work.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. NSM picked (see `/north-star-metric-pick`).
3. Analytics + warehouse exist (PostHog / Mixpanel + Snowflake / BigQuery).

## Inputs
- The NSM definition (formula + numerator + denominator + filters)
- Sub-metrics tree (1 NSM + 3-5 input drivers)
- Refresh cadence (real-time / hourly / daily)
- Audience (everyone in the company; not engineering-only)

## Process

1. **NSM definition document** — unambiguous:

   ```
   North Star: weekly active teams that completed ≥3 collaborative actions

   Numerator: count distinct(team_id)
     where COUNT(collaborative_action) >= 3
     within rolling 7-day window

   Denominator: none (count, not rate)

   Filters:
   - Excludes internal teams (team.is_internal = false)
   - Excludes deleted teams
   - Excludes free trial teams in first 24h (signal noise)

   Collaborative action = comment, share, assign, mention (see events.yaml)
   ```

   Every metric must have a query that compiles. SQL or DSL pinned in repo.

2. **Sub-metrics tree** — what moves the NSM:
   ```
   NSM: WA-Teams(>=3 collab)
   ├── Total active teams (volume)
   ├── % of active teams doing collab (depth)
   │   ├── % doing 1+ collab
   │   ├── % doing 2 collab
   │   └── % doing 3+ collab (this IS NSM after threshold)
   └── Collab actions per team (intensity)
   ```
   Each team picks a sub-metric to push; org pushes NSM.

3. **Single source query** — pinned in repo, versioned:
   - `metrics/north-star.sql` — canonical query
   - Tested in CI: returns N rows, expected schema
   - Reviewed like code (PRs require approval to change)
   - When definition changes: backfill historical numbers + announce

4. **Dashboard** — one screen, big number:
   - Title: the NSM, current value, % change WoW
   - Sub-metrics tree underneath
   - 8-week trend chart
   - Segmentation toggle (by plan, channel, segment)
   - Pinned in Slack channel; emailed weekly

5. **Daily refresh job** — automated:
   - Query runs nightly UTC
   - Result lands in `metrics_north_star` warehouse table (date, value, sub-metric breakdown)
   - Dashboards read from this table (not raw events) for speed + consistency
   - Alert if job fails 2 days in a row

6. **Operating cadence** — make the metric the center of gravity:

   | Cadence | What |
   |---|---|
   | Daily (Slack bot) | "NSM today: <value> (Δ from yesterday)" |
   | Weekly all-hands | NSM + sub-metric movement, who owns which sub-metric |
   | Monthly review | NSM trend, segment cuts, top hypotheses for next month |
   | Quarterly | NSM definition review — still right? |

   Tie compensation/OKRs to NSM at org level (not team level — risks gaming).

7. **Guardrail metrics** — don't game NSM:

   | Guardrail | Why |
   |---|---|
   | Churn rate | NSM bump from new sign-ups masking churn |
   | NPS | retention up but users hate it |
   | Revenue | NSM up but free-tier inflation |
   | Cost per NSM unit | NSM up via ad spend, not product |

   Any guardrail moving wrong direction blocks "we're winning" narrative.

8. **Drift detection** — when NSM definition changes silently:
   - Hash of the SQL + Git SHA stored alongside daily value
   - Dashboard shows "definition v3 since 2026-04-12"
   - Backfill rerun on definition change; both old + new series shown for 4 weeks

9. **Anti-patterns**:
   - Two dashboards with slightly different definitions — endless "which is right?"
   - Vanity NSM (signups, MAU) without value tied — moves but doesn't predict revenue/retention
   - NSM only in eng / data team — leadership uses different number; misalignment
   - Definition change without backfill — chart looks like a discontinuity
   - No guardrails — NSM gamed via destructive shortcuts
   - Daily noise alarms — focus weekly, not daily

## Output

Write `docs/product/north-star.md`:

```markdown
# North Star Metric — <project>
**Date:** <YYYY-MM-DD> | **Owner:** <PM/data>

## Definition
<one sentence>

## Formula
```sql
-- pinned in metrics/north-star.sql
SELECT count(distinct team_id) AS nsm
FROM events
WHERE ...
```

## Sub-metrics tree
- Total active teams
- % active doing collab
- Collab actions per team

## Pipeline
- Query: metrics/north-star.sql
- Schedule: nightly UTC
- Storage: warehouse.metrics_north_star
- Dashboard: <URL>
- Slack bot: daily summary to #north-star

## Cadence
- Daily Slack post
- Weekly all-hands review
- Monthly segment cuts
- Quarterly definition review

## Guardrails
- Churn rate
- NPS
- Gross margin per NSM unit

## Versioning
- Definition v<N>, since <date>
- Last backfill: <date>
- Change process: PR + review + backfill + announce

## Anti-game
- No team-level NSM bonus
- Guardrails block "win" claims
```

Also write `metrics/north-star.sql` and add the Slack bot script if applicable.

## Verification
- One single SQL source, versioned in repo.
- Daily refresh job + warehouse landing table.
- Dashboard pinned; same numbers everywhere.
- Sub-metric tree (1 NSM + 3-5 drivers).
- Guardrail metrics defined.
- Operating cadence (daily/weekly/monthly/quarterly) documented.
- Definition versioning + backfill plan exists.
