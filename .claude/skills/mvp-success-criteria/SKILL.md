---
name: mvp-success-criteria
description: Pre-build MVP success bar — what proves it works, what proves it fails. Outputs to `docs/inception/mvp-success-<project>.md`. Use when user says "MVP success criteria", "MVP success bar", "when is MVP done", "/mvp-success-criteria", or before `/mvp-scope`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /mvp-success-criteria — Define Win/Kill Before Build

## Why you'd care

Without a pre-set success bar, the post-MVP debate becomes 'is this working or not' and gets resolved by whoever's loudest. Pre-defining what proves it works and what proves it fails is what makes the decision honest.

Without numeric pre-commit, every result is rationalized as "promising."

## Pre-flight
Run `/problem-statement-doc` first. Pairs with `/kill-criteria-doc`, `/north-star-metric-pick`.

## Inputs
- Problem statement.
- Time budget (weeks).
- Cash budget.

## Process
1. **Pick ONE north star** — single metric the MVP proves or disproves. Activation rate, payback time, retention week-4, NPS at 30d, etc.
2. **Success threshold** — number you commit to BEFORE building. "≥ 30% activation in week 1 across ≥ 50 users."
3. **Kill threshold** — number that means STOP. "< 10% activation in week 4 across ≥ 50 users."
4. **Ambiguous zone** — between thresholds → extend test, do not pivot.
5. **Sample size** — N to reach statistical confidence. < 50 = anecdote, not signal.
6. **Time horizon** — how long the experiment runs. Default 4-6 weeks post-launch.
7. **Counter-metrics** — what should NOT degrade. Don't optimize activation by torching retention.
8. **Decision log timestamp** — sign + date BEFORE first commit.

## Output
Write `docs/inception/mvp-success-<project>.md`:

```markdown
# MVP Success Criteria — <project>
**Date committed:** <YYYY-MM-DD>
**Signed:** <founder name>

## North-star metric
<one metric>

## Thresholds
| Outcome | Threshold | Action |
|---------|-----------|--------|
| SUCCESS | ≥ <X> | Scale → `/launch-strategy` |
| AMBIGUOUS | <X> > <Y> | Extend test 2 weeks, no pivot |
| KILL | < <Y> | Stop → `/pivot-decision` |

## Sample size
- N target: <number>
- Source: <where they come from>
- Confidence: <statistical or anecdotal>

## Time horizon
<weeks from launch>

## Counter-metrics (must NOT degrade)
| Metric | Floor |
|--------|-------|
| ... | ... |

## What this MVP does NOT test
- ...
- ...

## Next
- Scope MVP → `/mvp-scope`
- Instrument metric → `/analytics-spec`
- After horizon → check thresholds → `/pivot-decision`
```

## Verification
- Single north-star metric (not 3).
- Both success AND kill numeric.
- N ≥ 30 (preferably ≥ 50).
- Date + signature pre-build.
