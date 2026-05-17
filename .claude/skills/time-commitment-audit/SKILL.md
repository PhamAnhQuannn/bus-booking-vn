---
name: time-commitment-audit
description: Honest hours-per-week founder time audit. Day-job, family, sleep, deep-work blocks. Reality-check vs runway. Outputs to `docs/inception/time-audit-<project>.md`. Use when user says "time audit", "how many hours", "founder time", "moonlight", "/time-commitment-audit", or before commit-to-build gate.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /time-commitment-audit — Hours-per-Week Reality Check

Most solo founders lie to themselves by 50%. Audit before committing.

## Why you'd care

Founders who claim 60 productive hours/week while holding a day job and a newborn are lying to themselves about runway. An honest audit replaces the founder-mythology number with the one that matches reality.

## Pre-flight
None. Pre-classify gate. If `docs/inception/time-audit-<project>.md` exists → refresh.

## Inputs
- Current status: full-time, part-time, employed, student, parent, etc.

## Process
1. **168-hour budget** — week has 168 hrs. Subtract sleep (×7), meals (×7), day-job (×N), family/relationship blocks, exercise, commute, admin.
2. **Available hours** — what's left = max possible.
3. **Realistic hours** — multiply by 0.6 (fatigue, context-switch, sickness, life).
4. **Deep-work blocks** — how many contiguous 2hr+ blocks per week? (Most product work needs deep blocks.)
5. **Honest comparison** — startup typically demands 40+/wk full-time, 15+/wk part-time. Where do you land?
6. **Runway implication** — at realistic hours, how long until MVP / first revenue?
7. **Verdict** — FULL-TIME / PART-TIME-VIABLE / TOO-THIN.

## Output
Write `docs/inception/time-audit-<project>.md`:

```markdown
# Time Commitment Audit — <project>
**Date:** <YYYY-MM-DD>

## 168-hr breakdown
| Bucket | Hours/wk |
|---|---|
| Sleep | 49 |
| Day job | X |
| Family/relationship | X |
| Meals/personal care | X |
| Exercise | X |
| Commute | X |
| Admin (bills, errands) | X |
| **Available** | X |
| **Realistic (× 0.6)** | X |

## Deep-work blocks
<count + when>

## Honest comparison
<startup demand vs realistic>

## Runway implication
- MVP target: <hrs> at <realistic/wk> = <weeks>
- First revenue target: <weeks/months>

## Verdict
FULL-TIME | PART-TIME-VIABLE | TOO-THIN

## Next
- If TOO-THIN → reframe scope or `/personal-runway-check` to free time
- If PART-TIME-VIABLE → `/mvp-scope` smaller
- If FULL-TIME → `/runway-model`
```

## Verification
- 168-hr table sums to 168.
- Realistic = available × 0.6 computed.
- Verdict picked.
