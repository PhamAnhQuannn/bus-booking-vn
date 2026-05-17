---
name: riskiest-assumption-test
description: Identify single assumption most likely to kill product, design cheapest test to verify. Outputs to `docs/inception/rat-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "riskiest assumption", "RAT", "what could kill this", "/riskiest-assumption-test", or before any MVP build.
output_size:
  XS: skip
  S: 1h
  M: 2h
  L: 4h
  XL: 8h
---

# /riskiest-assumption-test — RAT

Invoke as `/riskiest-assumption-test`. Find biggest unknown. Test cheapest.

## Why you'd care

Every product has one assumption that, if wrong, makes the whole thing pointless — usually unrelated to the part you're most worried about. Naming it and testing it cheap is the highest-leverage hour of the whole inception.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/lean-canvas-<project>.md` or `mvp-scope-<project>.md` — pull assumption set.

## Inputs
- All product assumptions (brain-dump).
- Resources: $ + time-budget for testing.

## Process
1. **List assumptions** — desirability / viability / feasibility / scalability.
2. **Per assumption score** — 0–10:
   - Probability of being WRONG (uncertainty).
   - Impact if WRONG (kills product Y/N + how much $/time wasted).
3. **Risk = uncertainty × impact** — rank.
4. **Top assumption** = the RAT.
5. **Design test** — falsifiable + cheap + fast:
   - Falsifiable: defines "fail" condition before run.
   - Cheap: ≤10% of build cost.
   - Fast: ≤2 weeks.
6. **Run + report** — log result; either proceed or pivot/kill.

## Output
Write `docs/inception/rat-<project>.md`:

```markdown
# Riskiest Assumption Test — <project>
**Date:** <YYYY-MM-DD>

## All assumptions
| # | Assumption | Type | Uncertainty | Impact | Risk |
|--:|---|---|--:|--:|--:|
| 1 | "Users will pay $X/mo" | Viability | 8 | 9 | 72 |
| 2 | "Stripe Connect supports our payout flow" | Feasibility | 4 | 8 | 32 |
| 3 | ... | | | | |

## RAT (top risk)
**"<assumption>"**

## Test design
- **Hypothesis (testable):** <if X, then Y>
- **Method:** <landing page / interview / prototype / spike>
- **Sample needed:** N
- **Cost:** $X + N hr
- **Duration:** N days
- **Pass:** <metric ≥ threshold>
- **Fail:** <metric < threshold>
- **Inconclusive:** <range>

## Plan
- Day 1: <step>
- Day 2: <step>
- Day N: report

## Result (post-run)
- Outcome: <metric>
- Verdict: PASS / FAIL / INCONCLUSIVE
- Decision: PROCEED / PIVOT / KILL

## Next RAT (if PASS)
<next-highest risk assumption>
```

## Verification
- ≥5 assumptions listed (single-assumption = blind spot).
- Test is falsifiable (failure condition pre-defined).
- Test cost ≤10% of full build estimate.
- Pass/fail thresholds numeric.
