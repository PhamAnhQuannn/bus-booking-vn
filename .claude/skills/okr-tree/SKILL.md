---
name: okr-tree
description: North-Star metric + Objective/Key-Result tree with input → output → outcome metric chain. Outputs to `docs/inception/okr-tree-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "OKR", "north star", "success metrics", "KPIs", "metrics tree", "/okr-tree", or before launch / quarterly planning.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /okr-tree — OKR & Success-Metrics Tree

## Why you'd care

OKRs without an input-output-outcome chain become activity theater — teams hit their KRs and the company doesn't move. The tree forces the linkage from team-controllable inputs to the metric that actually matters.

Invoke as `/okr-tree`. Define North Star. Cascade objectives → key results → input metrics. Set scoring rules.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - S → North Star + 1 Objective + 3 KRs (single quarter).
   - M/L/XL → full 3–5 Objectives × 3 KRs each, full tree.
2. Pull priors:
   - `docs/inception/lean-canvas-<project>.md` — value prop, channels.
   - `docs/inception/magic-number-validation-<project>.md` — magic moment.
   - `docs/inception/unit-economics-model-<project>.md` — LTV/CAC.
   - `docs/inception/jtbd-<project>.md` — outcome users hire product for.

## Inputs
- Time horizon (default: next quarter).
- Current baseline metrics (if any).
- Stage (pre-launch → focus on activation; post-launch → retention; scale → revenue).

## Process
1. **Pick North Star Metric** — the *single* number that best captures sustained value delivered:
   - Must move with customer success.
   - Must be a leading indicator of revenue (not revenue itself).
   - Examples: msgs-sent-per-WAU (Slack), nights-booked (Airbnb), weekly active deploys (devtool), weekly active reservations completed (restaurant).
2. **Anti-North-Stars**: list 2–3 metrics you will NOT chase (vanity: sign-ups, page-views; gameable: DAU without depth).
3. **Cascade**: North Star → 3–5 Objectives (qualitative) → 3 KRs each (quantitative, time-bound, falsifiable).
4. **Per KR define**:
   - Baseline (today's value)
   - Target (end-of-quarter)
   - Stretch (top-decile outcome)
   - Owner (founder solo)
   - Cadence to measure (daily/weekly/monthly)
   - Data source (PostHog event, Stripe API, DB query)
5. **Input → output → outcome chain** per Objective:
   - **Input** (action you control): e.g., demos booked
   - **Output** (immediate result): e.g., trials started
   - **Outcome** (KR proxy for North Star): e.g., paying customers
6. **Scoring rules**:
   - 0.0–0.3 = miss (red)
   - 0.4–0.6 = on-track / partial
   - 0.7–1.0 = success
   - 1.0+ = stretch hit
   - Aim for 0.7 average (Google rule — 1.0 means sandbagged).
7. **Review cadence** — weekly check-in (5 min), monthly score, quarterly re-set.

## Output
Write `docs/inception/okr-tree-<project>.md`:

```markdown
# OKR Tree — <project>
**Quarter:** <YYYY-Qn> · **Set:** <YYYY-MM-DD> · **Review:** <YYYY-MM-DD>

## North Star Metric
**<metric>** — <one-line why this captures value>
- Baseline: <n>
- Target (EOQ): <n>
- Stretch: <n>

## Anti-North-Stars (DO NOT chase)
- Sign-ups without activation
- Page-views without intent
- ...

## Tree

### O1: <objective — qualitative, inspiring>
| KR | Baseline | Target | Stretch | Cadence | Source |
|---|--:|--:|--:|---|---|
| KR1.1 — Weekly active deploys ≥ 200 | 40 | 200 | 350 | Weekly | DB query |
| KR1.2 — Activation rate (signup→1st run) ≥ 40% | 12% | 40% | 55% | Weekly | PostHog funnel |
| KR1.3 — D30 retention ≥ 50% | 25% | 50% | 65% | Monthly | DB cohort |

**Chain:**
- Input: 20 cold-outreach demos/wk → Output: 8 trial signups/wk → Outcome: 4 paying customers/wk

### O2: <objective>
| KR | Baseline | Target | Stretch | Cadence | Source |
|---|--:|--:|--:|---|---|
| KR2.1 — LTV/CAC ≥ 3 | 1.2 | 3.0 | 4.5 | Monthly | Stripe + ads |
| KR2.2 — ... | | | | | |
| KR2.3 — ... | | | | | |

### O3: <objective>
| KR | ... | | | | |

## Scoring rules
- 0.0–0.3 miss · 0.4–0.6 partial · 0.7–1.0 hit · >1.0 stretch
- Avg target: 0.7 (≥0.9 means goals were too soft)

## Weekly check-in (5 min)
| Week | KR1.1 | KR1.2 | KR1.3 | KR2.1 | Notes |
|---|--:|--:|--:|--:|---|
| 1 | 40 | 12% | 25% | 1.2 | baseline |
| 2 | ... | | | | |

## End-of-quarter score
- O1 avg: __ · O2 avg: __ · O3 avg: __ · Overall: __
- Carry to next quarter: <KRs to re-set>
- Retired: <KRs hit and stable>
```

## Verification
- Exactly 1 North Star Metric (not 2).
- 3–5 Objectives, 3 KRs each.
- Every KR is numeric + time-bound + has a data source.
- Anti-North-Stars list ≥ 2.
- Input→Output→Outcome chain stated per Objective.
- North Star is leading, not lagging revenue.

## When to re-run
- Quarterly (set new tree).
- After pivot (force re-derive).
- Always before `/inception-gate-review` and before `/launch-strategy`.
