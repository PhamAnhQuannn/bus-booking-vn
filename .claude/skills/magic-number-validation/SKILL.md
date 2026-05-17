---
name: magic-number-validation
description: Find product's "magic moment" + leading retention indicator — the action that predicts long-term use (Facebook 7-friends, Slack 2k-msg). Outputs to `docs/inception/magic-number-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "magic number", "aha moment", "activation metric", "/magic-number-validation", or after first cohort of users.
output_size:
  XS: skip
  S: skip
  M: 1h
  L: 2h
  XL: 4h
---

# /magic-number-validation — Aha-Moment Detection

## Why you'd care

Without identifying the magic-number activation event, growth experiments optimize for vanity metrics that don't predict retention. The number tells the whole team which action actually matters.

Invoke as `/magic-number-validation`. Find threshold = retained user.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (need usage cohort)
   - M+ → run after 100+ active users
2. Read `docs/inception/north-star-metric-<project>.md` if exists.

## Inputs
- ≥100 users with ≥30 days history.
- Action log per user (events table or CSV export).
- Retention definition (DAU/WAU/MAU back N days later).

## Process
1. **Cohort split** — retained (≥X day return) vs churned.
2. **Action histogram per cohort** — count of every action per user in first N days.
3. **Find divergence** — actions where retained users do MUCH more than churned in first 7/14/30 days.
4. **Test thresholds** — for top divergent action, plot retention curve at action count = 1, 3, 5, 10, 20.
5. **Pick magic number** — knee of curve where retention asymptotes (e.g., "users who do X 5+ times in week 1 retain at 75%").
6. **Validate** — does cohort hitting magic number actually retain longer? (split-test).
7. **Operationalize** — onboarding designed to push users to magic number ASAP.

## Output
Write `docs/inception/magic-number-<project>.md`:

```markdown
# Magic Number — <project>
**Date:** <YYYY-MM-DD> | **N users analyzed:** N | **Retention def:** <X>

## Cohort split
- Retained (D30 return): N (X%)
- Churned: N (X%)

## Top divergent actions (first 7d)
| Action | Avg retained | Avg churned | Lift |
|---|--:|--:|--:|
| Connected integration | 4.2 | 0.6 | 7x |
| Created project | 2.8 | 1.1 | 2.5x |
| Invited teammate | 1.9 | 0.2 | 9.5x |

## Threshold curve (top action: invited teammate)
| Invites in week 1 | Retention D30 |
|--:|--:|
| 0 | 12% |
| 1 | 35% |
| 2 | 58% |
| 3 | 72% |
| 5 | 78% |
| 10 | 80% |

## Magic number
**"3 teammates invited in week 1 → 72% D30 retention"**

## Knee point
- 0→3 = 60pt jump
- 3→10 = 8pt jump (diminishing)

## Operationalize
- Onboarding goal: push to 3 invites in 24h
- Activation event in analytics: `magic_number_hit`
- Drip email if not hit by D3: nudge invites
- Block dashboard until 1 invite (debate)

## Validation plan
- A/B: forced-invite onboarding vs current
- Measure: D30 retention delta
- Sample: 200/arm, 30 days
```

## Verification
- ≥100 users analyzed (less = noise).
- Knee point identified (not "more = better" — diminishing).
- Magic number tied to leading indicator NSM, not lagging revenue.
- Operationalization plan concrete.
