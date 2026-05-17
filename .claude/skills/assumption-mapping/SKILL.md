---
name: assumption-mapping
description: 2x2 assumption map — importance × evidence. Surfaces leap-of-faith bets. Outputs to `docs/inception/assumption-map-<project>.md`. Use when user says "assumption mapping", "leap of faith", "what assumes", "/assumption-mapping", or before `/riskiest-assumption-test`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /assumption-mapping — Surface the Bets

## Why you'd care

The bet that kills a startup is the one no one wrote down. Importance × evidence forces you to name which beliefs are load-bearing-without-proof, so the next test sprint targets the actual killshot instead of the comfortable known-known.

Every plan has hidden assumptions. The dangerous ones are HIGH importance + LOW evidence. Find those first.

## Pre-flight
None. Pairs with `/problem-hypothesis-tree`, `/riskiest-assumption-test`.

## Inputs
- Current product/business hypothesis.

## Process
1. **Dump everything you're assuming** — desirability, viability, feasibility. 15-30 items minimum. Quantity > quality at this stage.
2. **Categorize** by type:
   - DESIRABILITY (users want it, pain real)
   - VIABILITY (we can make money)
   - FEASIBILITY (we can build it)
   - USABILITY (they can use it)
   - ETHICS/LEGAL (we're allowed to)
3. **Score importance 1-5** — if this assumption is wrong, how badly does the project die?
4. **Score evidence 1-5** — 1 = pure guess, 5 = repeated direct observation in our target market.
5. **Plot 2x2** — importance (Y) × evidence (X).
6. **Top-right quadrant = SAFE** (high importance, high evidence). Move on.
7. **Top-left = LEAP OF FAITH** (high importance, low evidence). Test these first.
8. **Bottom = LATER** (low importance — defer).

## Output
Write `docs/inception/assumption-map-<project>.md`:

```markdown
# Assumption Map — <project>
**Date:** <YYYY-MM-DD>

## All assumptions
| # | Assumption | Type | Importance (1-5) | Evidence (1-5) |
|---|-----------|------|------------------|----------------|
| 1 | Users will pay $X/mo | VIABILITY | 5 | 1 |
| 2 | We can build in 4 weeks | FEASIBILITY | 4 | 3 |
| ... | ... | ... | ... | ... |

## 2x2 plot
```
Importance
   5 | [#1]      |         | [#7] [#12]
   4 |           | [#2]    |
   3 |   [#5]    | [#3]    |
   2 |           |         | [#9]
   1 |   [#11]   |         |
     +-----------+---------+-----------
       1   2   3   4   5
                 Evidence
```

## Leap-of-faith assumptions (top-left quadrant)
| # | Assumption | Why dangerous | Test idea |
|---|-----------|---------------|-----------|
| 1 | ... | ... | ... |

## Safe (validate later, not now)
| # | Assumption |
|---|-----------|
| ... | ... |

## Next
- Top leap-of-faith → `/riskiest-assumption-test`
- After test → re-score evidence, replot
- Repeat until top-left is empty → `/mvp-scope`
```

## Verification
- ≥ 15 assumptions dumped.
- Each scored 1-5 × 1-5.
- 2x2 plot rendered.
- Top-left quadrant explicitly listed with test idea per item.
