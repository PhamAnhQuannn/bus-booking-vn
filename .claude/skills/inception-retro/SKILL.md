---
name: inception-retro
description: Post-inception retrospective on what evidence held vs broke after first 90 days of build/launch — feeds future inception calibration. Outputs to `docs/inception/retro-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "inception retro", "what did we miss", "/inception-retro", or 90 days post-launch.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /inception-retro — Calibration Loop

## Why you'd care

Most founders never compare what they assumed at commit-to-build against what actually held 90 days later, so the same blind spots show up on the next project. The retro converts the lesson into a calibration the next inception inherits.

Invoke as `/inception-retro`. After-action review on inception phase. Improves next project.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Read all `docs/inception/*-<project>.md` — load original predictions.
3. Read `docs/inception/pivot-<project>-*.md` if exists — actual outcome.

## Inputs
- Date of inception completion.
- Date of retro (typically launch + 90d).
- Key metric actuals to compare vs predictions.

## Process
1. **Prediction vs actual** — table per metric: predicted, actual, delta, % off.
2. **Evidence audit** — which inception evidence held? Which was wrong?
3. **Skipped artifacts** — what did we skip that we now wish we had?
4. **Wasted artifacts** — what did we produce that never got used?
5. **Calibration** — adjust scoring rubrics for next project.

## Output
Write `docs/inception/retro-<project>.md`:

```markdown
# Inception Retro — <project>
**Inception complete:** <date> | **Retro date:** <date> | **Days since launch:** N

## Prediction vs actual
| Metric | Predicted | Actual | Delta | % off |
|---|---:|---:|---:|---:|
| TTR | X wk | X wk | X | X% |
| Yr1 revenue | $X | $X | $X | X% |
| Yr1 users | X | X | X | X% |
| CAC | $X | $X | $X | X% |
| Burn rate | $X/mo | $X/mo | $X | X% |

## Evidence held
- ...

## Evidence broken
- ...

## Wished-we-had
- ...

## Wasted artifacts (low/zero use)
- ...

## Calibration for next project
- ...
```

## Verification
- ≥3 metrics compared with concrete numbers.
- ≥1 wished-we-had AND ≥1 wasted artifact (honest both ways).
- Calibration is actionable (specific rubric tweak), not "do better".
