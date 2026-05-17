---
name: runway-model
description: Cash runway projection — solo savings / MRR target / Series A burn. Class-branched. Outputs to `docs/inception/runway-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "runway", "burn rate", "how long can I last", "/runway-model", or before commit.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /runway-model — Cash Runway

Invoke as `/runway-model`. Default-alive = revenue covers burn before cash zero. Else default-dead.

## Why you'd care

Without a cash projection, you find out you have two months left in week six of those two months. The runway model is the alarm that goes off in time to do something about it.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
2. Read `docs/inception/cost-model-<project>.md` if exists.

## Inputs
- Starting cash (savings, raised, debt available).
- Monthly burn (fixed + variable).
- Projected MRR by month.
- Founder ability/willingness to cut burn.

## Process — class-branched
1. **Class S (solo savings runway)**:
   - Starting savings + side income
   - Monthly burn = personal expenses + tools
   - Months runway = savings / monthly burn
   - Trigger to ship paid product / get day-job: at month X
2. **Class M (MRR-target runway)**:
   - Starting cash
   - Burn = solo costs + minimal tools + 1 contractor
   - MRR ramp projection (cohort-based)
   - Default-alive month = first month MRR ≥ burn
3. **Class L (Series A burn)**:
   - Starting cash post-raise
   - Burn = team comp + infra + S&M
   - Net burn = burn − revenue
   - Months runway = cash / net burn
   - Default-alive scenario or next-raise scenario
4. **Class XL (Series A+ disciplined burn)**:
   - Same as L but with milestone-gated hiring
   - Burn multiple <2 (efficient growth)
5. **Stress scenarios** — what if MRR ramp is 50% slower? what if 3-mo no growth?

## Output
Write `docs/inception/runway-<project>.md`:

```markdown
# Runway Model — <project>
**Date:** <YYYY-MM-DD> | **Class:** <X>

## Class-branch profile
**<Class S / M / L / XL>** — <branch description>

## Inputs
- Starting cash: $<X>
- Side income: $<Y>/mo
- Monthly burn (base): $<Z>
- Variable burn per user: $<W>

## Month-by-month projection
| Month | New cust | MRR | Burn | Net | Cum cash |
|---|--:|--:|--:|--:|--:|
| M1 | 0 | 0 | -3000 | -3000 | 27000 |
| M2 | 5 | 200 | -3050 | -2850 | 24150 |
| M3 | 10 | 600 | -3100 | -2500 | 21650 |
| ... | ... | ... | ... | ... | ... |
| M18 | (steady) | 4500 | -4000 | +500 | 8200 |

## Default-alive
- Target month: M<X>
- Required MRR: $<Y> = burn
- Probability hit (your gut): <30/50/70%>

## Cash-zero month (if no growth)
- Month: M<X>
- Decision deadline: M<X-2> (must pivot or raise by then)

## Stress scenarios
| Scenario | Cash-zero | Default-alive |
|---|---|---|
| Base | M22 | M18 ✓ |
| Slow ramp (50%) | M16 | never (need pivot) |
| 3-mo flat after M6 | M19 | M21 |

## Action triggers
- M3: if MRR <$200 → reassess problem
- M6: if MRR <$1000 → consider day-job extension
- M9: if MRR <$2500 → kill/pivot/raise

## Verdict
**DEFAULT-ALIVE / BORDERLINE / DEFAULT-DEAD**
```

## Verification
- Month-by-month table at least 18 mo.
- Default-alive month named (or "never under base").
- Cash-zero month named.
- ≥2 stress scenarios.
- Action triggers tied to dates.
