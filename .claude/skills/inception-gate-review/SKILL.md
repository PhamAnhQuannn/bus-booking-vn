---
name: inception-gate-review
description: Final go/no-go gate aggregating all inception artifacts before commit-to-build. Reads classify, validation, canvas, pricing, runway, NSM, kill-criteria, competitor-scan, etc. Outputs to `docs/inception/gate-review-<project>.md`. Reads `/project-classify` to skip XS/S (small stuff doesn't need a gate). Use when user says "ready to build", "inception gate", "go no go", "/inception-gate-review", or before `/write-a-prd` heavy spend.
output_size:
  XS: 30m
  S: 30m
  M: 1h
  L: 1h
  XL: 2h
---

# /inception-gate-review — Pre-Build Gate

## Why you'd care

Without an explicit go/no-go gate, projects slide from inception into build because no one wants to say stop — and the runway burns on a thesis no one actually defended. The gate forces the artifacts to argue for themselves.

Invoke as `/inception-gate-review`. Aggregates inception phase. One verdict.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS / S → SKIP (over-process for small).
   - M+ → continue.
2. Glob `docs/inception/*.md` for project. Note which exist, which missing.

## Inputs
None — reads inception artifacts.

## Required artifacts (M+ class)
| Artifact | M | L | XL |
|---|:--:|:--:|:--:|
| classify | ✓ | ✓ | ✓ |
| problem-validation (≥PASS) | ✓ | ✓ | ✓ |
| founder-fit (≥GO) | ✓ | ✓ | ✓ |
| competitor-scan | ✓ | ✓ | ✓ |
| lean-canvas | ✓ | ✓ | ✓ |
| pricing-model | ✓ | ✓ | ✓ |
| runway-model | ✓ | ✓ | ✓ |
| north-star-metric | ✓ | ✓ | ✓ |
| kill-criteria | ✓ | ✓ | ✓ |
| time-to-revenue-estimate | ✓ | ✓ | ✓ |
| unit-econ-viability-gate (≥TIGHT) | ✓ | ✓ | ✓ |
| market-sizing | – | ✓ | ✓ |
| stakeholder-map | – | ✓ | ✓ |
| business-case | – | – | ✓ |
| regulatory-preflight | – | ✓ | ✓ |
| threat-model-pre | – | ✓ | ✓ |

> **M-class front-load note**: for M domain in {scrape, PII, payments}, `regulatory-preflight` verdict GATES `problem-validation` continuation — both run in parallel during inception, but a KILL on regulatory aborts the validation effort. Treat regulatory-preflight as required (not optional dash) for those M domains.

## Process
1. **Artifact inventory** — present/missing table per required item for class.
2. **Verdict carry-forward** — extract verdict from each (PASS/KILL/etc).
3. **Hard gates**:
   - problem-validation = KILL → BLOCK
   - founder-fit = WALK → BLOCK
   - any kill-criteria already triggered → BLOCK
   - missing required artifact → BLOCK (or DEFER if optional)
4. **Risk roll-up** — top 3 risks across artifacts.
5. **Verdict** — PROCEED / CONDITIONAL-GO (AMBER) / DEFER / KILL.
   - PROCEED: all hard gates pass, no named open items.
   - CONDITIONAL-GO (AMBER): all hard gates pass BUT 1–3 named open items remain. Build may start in parallel with item resolution; named deadline per item required.
   - DEFER: ≥1 required artifact missing AND fillable in ≤2 weeks. Re-gate on completion.
   - KILL: hard gate broken (kill-criteria triggered, founder-fit=WALK, problem-validation=KILL).

## Output
Write `docs/inception/gate-review-<project>.md`:

```markdown
# Inception Gate — <project>
**Date:** <YYYY-MM-DD> | **Class:** <X> | **Verdict:** PROCEED / CONDITIONAL-GO / DEFER / KILL

## Artifact inventory
| Artifact | Required | Present? | Verdict carry |
|---|:--:|:--:|---|
| classify | ✓ | ✓ | <X> |
| problem-validation | ✓ | ✓ | PASS (3.2/4) |
| founder-fit | ✓ | ✓ | GO (15/20) |
| competitor-scan | ✓ | ⨯ | MISSING |
| ... | | | |

## Hard-gate checks
- [ ] No KILL verdicts
- [ ] No WALK on founder-fit
- [ ] No triggered kill-criteria
- [ ] All required artifacts present

## Conditional-GO open items (AMBER only)
| # | Open item | Owner | Hard-deadline-to-resolve | Blocks |
|--:|---|---|---|---|
| 1 | <named gap> | <name> | <YYYY-MM-DD> | <build phase blocked> |

## Top 3 risks
1. ...
2. ...
3. ...

## Verdict rationale
<2-3 sentences>

## Next
- PROCEED → /write-a-prd → /prd-to-issues
- CONDITIONAL-GO → /write-a-prd with named blockers tracked; re-gate on each item's deadline.
- DEFER → fill <missing artifacts>, re-gate
- KILL → /idea-kill-list, free runway
```

## Verification
- Class-correct artifact list checked.
- Each missing item explicit (not silently ignored).
- Verdict tied to hard-gate checks, not vibes.
