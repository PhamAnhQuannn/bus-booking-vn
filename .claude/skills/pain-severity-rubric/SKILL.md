---
name: pain-severity-rubric
description: Score pain severity 0-10 across frequency, intensity, cost, and visibility — kills "vitamin" ideas vs "painkiller". Outputs to `docs/inception/pain-severity-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "is this a real pain", "vitamin or painkiller", "/pain-severity-rubric", or after `/interview-log` saturation.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /pain-severity-rubric — Painkiller Test

Invoke as `/pain-severity-rubric`. Score pain. Painkiller > vitamin.

## Why you'd care

Vitamin ideas burn 18 months of runway before you notice nobody wants them. A scored pain threshold is the cheapest possible kill switch on "interesting but not urgent" products.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Read `docs/inception/interview-log-<project>.md` — pull magnitude data.

## Inputs
- Job/problem statement.
- ≥5 interviews scored.

## Process
1. **Per-interview score** — 4 axes 0–10:
   - Frequency: how often hits user (0=yearly, 10=multiple/day)
   - Intensity: how bad in the moment (0=mild annoy, 10=blocks work / loses revenue)
   - Cost: $/hr/sanity per occurrence (0=trivial, 10=>$1k or hours)
   - Visibility: who notices (0=just me, 10=boss/customer/regulator)
2. **Aggregate** — mean per axis + total.
3. **Verdict thresholds**:
   - Total ≥30 → PAINKILLER (pursue)
   - 20–29 → VITAMIN-WITH-EDGE (proceed cautiously, need wedge)
   - <20 → VITAMIN (kill or reposition)
4. **Distribution check** — kill if 1 outlier scored 35 + 4 scored 12 (you found 1 fan, not market).

## Output
Write `docs/inception/pain-severity-<project>.md`:

```markdown
# Pain Severity — <project>
**Date:** <YYYY-MM-DD> | **N interviews:** N

## Per-interview scores
| # | Person | Freq | Intensity | Cost | Visibility | Total |
|--:|---|--:|--:|--:|--:|--:|
| 1 | <name> | 8 | 9 | 7 | 6 | 30 |
| 2 | <name> | 5 | 4 | 3 | 2 | 14 |
| ... | | | | | | |

## Aggregate
| Axis | Mean | Median | Min | Max |
|---|--:|--:|--:|--:|
| Frequency | X | X | X | X |
| Intensity | X | X | X | X |
| Cost | X | X | X | X |
| Visibility | X | X | X | X |
| **Total** | **X** | **X** | **X** | **X** |

## Distribution shape
- Spread: <tight cluster / bimodal / 1 outlier>
- Concentration: top quartile mean = X, bottom quartile = X

## Verdict
**PAINKILLER / VITAMIN-WITH-EDGE / VITAMIN**

## Rationale
<2-3 sentences>

## Next
- PAINKILLER → /jtbd → /value-prop-canvas
- VITAMIN-WITH-EDGE → /positioning-statement (find wedge)
- VITAMIN → /idea-kill-list
```

## Verification
- ≥5 interviews scored (1-2 = anecdote, not data).
- Distribution shape called out (mean alone hides outlier-driven scores).
- Verdict tied to threshold, not gut.
