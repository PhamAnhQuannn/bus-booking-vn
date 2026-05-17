---
name: mvp-scope
description: Cut feature list to minimum viable — one job, one persona, one channel. Outputs to `docs/inception/mvp-scope-<project>.md`. Reads `/project-classify` to size cut depth. Use when user says "MVP", "scope cut", "v1 features", "/mvp-scope", or after `/jtbd` + `/pain-severity-rubric`.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /mvp-scope — Minimum Viable Cut

## Why you'd care

Every additional feature in v1 multiplies the time-to-customer and dilutes the message. Cutting hard to one job + one persona + one channel is what makes the MVP actually shippable in weeks.

Invoke as `/mvp-scope`. Ruthless. One job. Cut everything else.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → 1 feature MVP (default)
   - S → ≤3 features
   - M → ≤5 features + 1 integration
   - L → ≤8 features + 2 integrations
   - XL → ≤12 features + compliance baseline
2. Read `docs/inception/jtbd-<project>.md` if exists — pull primary job.
3. Read `docs/inception/pain-severity-<project>.md` — confirm PAINKILLER verdict.

## Inputs
- Primary job statement.
- Full feature wishlist (brain-dump OK).
- Class budget from above.

## Process
1. **List all features** — no filter, dump.
2. **Per feature score** — 0–10:
   - Job-criticality: does primary job complete without it?
   - Differentiation: do competitors lack this?
   - Build cost: hr estimate.
3. **Cut rule** — if job completes without it AND differentiation <7 → CUT.
4. **Bundle survivors** — group into "must / should / could / won't (this version)".
5. **Verify cut budget** — must-list ≤ class ceiling. If not, harder cut.
6. **Sequence by dependency** — what blocks what? draw build order.

## Output
Write `docs/inception/mvp-scope-<project>.md`:

```markdown
# MVP Scope — <project>
**Date:** <YYYY-MM-DD> | **Class:** <X> | **Primary job:** <statement>

## Feature scoring
| # | Feature | Job-crit | Diff | Build hr | Verdict |
|--:|---|--:|--:|--:|---|
| 1 | <feat> | 9 | 8 | 12 | MUST |
| 2 | <feat> | 4 | 3 | 6 | CUT |

## MUST (v1)
1. <feat> — <one-line why>
2. ...

## SHOULD (v1.1, post-validation)
- <feat>

## COULD (later)
- <feat>

## WON'T (this product)
- <feat> — <why never>

## Build sequence
1. <feat A> blocks <feat B>
2. ...

## v1 budget check
- Must count: N (ceiling: M) ✓/✗
- Build hr total: N

## Anti-scope
- We will NOT do <X> because <Y>
- We will NOT serve <persona> because <Y>
```

## Verification
- Must-list ≤ class ceiling.
- Every CUT decision has reason logged.
- Anti-scope explicit (says NO out loud).
- Build sequence has no circular deps.
