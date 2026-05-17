---
name: feasibility-spike
description: Run a timeboxed proof-of-concept for a single tech unknown to kill the riskiest technical assumption before committing to build. Outputs to `docs/inception/spike-<topic>.md`. Reads `/project-classify` to skip XS. Use when user says "spike", "POC", "can we even build this", "/feasibility-spike", or after `/riskiest-assumption-test` flags a tech-feasibility risk.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /feasibility-spike — Timeboxed Tech POC

## Why you'd care

Skipping the spike means you commit weeks of build to a tech bet that may not be physically possible — and you only find out after sunk cost has locked in the decision. The spike answers the binary question before the team rallies behind it.

Invoke as `/feasibility-spike`. One unknown. One timebox. One go/no-go.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - **XS** → SKIP (just try it, 5 min).
   - S+ → continue.
2. Confirm: spike has **single** unknown. If multi-unknown → split into multiple spikes.

## Inputs
- The unknown (one sentence: "Can <tech X> do <thing Y> within <constraint Z>?").
- Timebox (S: 2 hr / M: 1 day / L: 3 days / XL: 1 week max).
- Success criteria (binary: works / doesn't).

## Process
1. **Frame** — write the unknown as a falsifiable yes/no question.
2. **Smallest test** — what's the minimum code/config that proves it? Throwaway code OK.
3. **Run** — within timebox, no scope creep.
4. **Decide** — works / doesn't / inconclusive. If inconclusive after timebox = treat as doesn't.
5. **Decision log** — capture verdict + evidence + next action.

## Output
Write `docs/inception/spike-<topic-slug>.md`:

```markdown
# Spike — <topic>
**Date:** <YYYY-MM-DD> | **Timebox:** <X hr/day> | **Status:** WORKS / FAILED / INCONCLUSIVE

## Unknown
<one sentence>

## Success criteria
- [ ] <binary check>
- [ ] <binary check>

## Method
<2-3 lines: what was built/tested>

## Result
<verdict + 1-2 lines evidence>

## Code/config
```<lang>
<smallest reproducible snippet>
```

## Decision
- WORKS → green-light <skill/feature>
- FAILED → kill / find alternative <name>
- INCONCLUSIVE → re-spike with <change> OR treat as failed
```

## Verification
- Single unknown, not bundled.
- Within timebox (overrun = failed).
- Decision recorded (no "we'll see").
