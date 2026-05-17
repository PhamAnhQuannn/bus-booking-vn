---
name: unit-econ-viability-gate
description: Hard viability verdict from unit economics + runway + pricing + cost-model. Outputs VIABLE / TIGHT / UNVIABLE to `docs/inception/unit-econ-viability-<project>.md`. Reads `/project-classify` to skip XS. Class M/L gates here BEFORE `/inception-gate-review`. Use when user says "is this viable", "viability gate", "/unit-econ-viability-gate", or after `/unit-economics-model`.
output_size:
  XS: skip
  S: 1h
  M: 1h
  L: 1h
  XL: 1h
---

# /unit-econ-viability-gate — Viability Verdict

Invoke as `/unit-econ-viability-gate`. Hard kill-gate. Healthy unit-econ ≠ viable business — runway, burn, payback all gate together. One verdict, no vibes.

## Why you'd care

A product with charming unit economics on a slide and unviable unit economics in the spreadsheet ships anyway, because nobody made the call. The viability gate is the documented decision that prevents shipping known-unviable.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (no unit econ, no gate).
   - S+ → continue.
2. Read prerequisites — fail-fast if any missing:
   - `docs/inception/unit-economics-<project>.md` (required)
   - `docs/inception/runway-<project>.md` (required M+)
   - `docs/inception/pricing-<project>.md` (required)
   - `docs/inception/cost-model-<project>.md` (required)

## Inputs
- LTV/CAC ratio (from unit-economics)
- Payback period in months (from unit-economics)
- Monthly burn $ (from runway-model)
- Runway months (from runway-model)
- Gross margin % (from cost-model)
- Burn-multiple = net-burn / net-new-ARR (from runway + ARR forecast)

## Process

1. **Threshold table** — score each:

   | Metric | VIABLE | TIGHT | UNVIABLE |
   |---|---|---|---|
   | LTV/CAC | ≥3 | 1.5–3 | <1.5 |
   | Payback (mo) | ≤12 | 12–24 | >24 |
   | Burn multiple | ≤2 | 2–4 | >4 |
   | Gross margin (SaaS) | ≥70% | 50–70% | <50% |
   | Runway (mo) | ≥18 | 9–18 | <9 |

2. **Hard kills** — ANY one of these → UNVIABLE verdict regardless of others:
   - LTV/CAC <1 (you lose money per customer)
   - Runway <6 months AND no funding line of sight
   - Gross margin <0% (unit-loss)

3. **Aggregate verdict**:
   - All 5 metrics VIABLE → VIABLE
   - All 5 metrics ≥TIGHT, no hard kill → TIGHT (proceed with named fix)
   - Any UNVIABLE OR any hard kill → UNVIABLE (block /inception-gate-review)

4. **Stress test** — re-run thresholds under: (a) churn 2× (b) CAC 2× (c) burn 1.5×. Note which scenario flips verdict.

5. **Action plan** (mandatory if TIGHT or UNVIABLE):
   - Which lever moves the worst metric? (price, CAC, churn, burn, margin)
   - What's the 30-day test to confirm the lever works?
   - What kill-criterion fires if lever fails?

## Output

Write `docs/inception/unit-econ-viability-<project>.md`:

```markdown
# Unit-Econ Viability — <project>
**Date:** <YYYY-MM-DD> | **Class:** <M/L/XL> | **Verdict:** VIABLE / TIGHT / UNVIABLE

## Score table
| Metric | Value | Threshold | Status |
|---|--:|--:|---|
| LTV/CAC | <X> | ≥3 | VIABLE / TIGHT / UNVIABLE |
| Payback (mo) | <X> | ≤12 | ... |
| Burn multiple | <X> | ≤2 | ... |
| Gross margin | <X>% | ≥70% | ... |
| Runway (mo) | <X> | ≥18 | ... |

## Hard kills
- [ ] LTV/CAC <1 — fired? <Y/N>
- [ ] Runway <6mo no funding — fired? <Y/N>
- [ ] Gross margin <0% — fired? <Y/N>

## Stress
| Scenario | Verdict | Notes |
|---|---|---|
| Base | <V/T/U> | |
| Churn 2× | <V/T/U> | |
| CAC 2× | <V/T/U> | |
| Burn 1.5× | <V/T/U> | |

## Action plan (TIGHT or UNVIABLE)
1. Lever: <price/CAC/churn/burn/margin>
2. 30-day test: <what to measure>
3. Kill-criterion if test fails: <named threshold>

## Verdict rationale
<2–3 sentences>

## Next
- VIABLE → /inception-gate-review (this artifact required ≥TIGHT)
- TIGHT → run 30-day test, re-gate; meanwhile gate-review may proceed with named blocker.
- UNVIABLE → block /inception-gate-review. /idea-kill-list or pivot.
```

## Verification
- All 5 metrics tabled with explicit threshold.
- Hard-kill checklist explicit (not silently passed).
- Stress test ≥3 scenarios.
- TIGHT/UNVIABLE verdicts carry a named lever + 30-day test + kill-criterion.
- Output drives `/inception-gate-review` required-artifacts row.
