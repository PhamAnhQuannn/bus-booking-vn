---
name: opportunity-cost-frame
description: Frame this idea against the next-best alternative use of your time/capital so you don't drift into a mediocre idea by default. Outputs to `docs/inception/opportunity-cost-<project>.md`. No class skip. Use when user says "is this the best use", "opportunity cost", "/opportunity-cost-frame", or weighing 2+ projects.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /opportunity-cost-frame — Next-Best Alt

## Why you'd care

Founders drift into mediocre ideas because the cost-of-not-doing-the-next-best-thing is invisible by default. The frame makes the comparison explicit before another year disappears.

Invoke as `/opportunity-cost-frame`. Forces you to name the alternative you're skipping.

## Pre-flight
None.

## Inputs
- Current idea slug.
- Next-best 1–2 alternatives (other ideas, contracting, job, rest).
- Time horizon to compare (default: 6 months).

## Process
1. **List candidates** — current idea + ≥1 alternative. If you can't name one, you're not really choosing.
2. **Score each** on: expected $ at horizon, learning value, optionality created, energy cost.
3. **Risk-adjusted** — multiply expected $ by p(success) honest estimate.
4. **Compare** — current idea must beat alternative on ≥2 of 4 dims.
5. **Verdict** — PROCEED / SWITCH / DEFER.

## Output
Write `docs/inception/opportunity-cost-<project>.md`:

```markdown
# Opportunity Cost — <project>
**Date:** <YYYY-MM-DD> | **Horizon:** 6 mo | **Verdict:** PROCEED / SWITCH / DEFER

| Option | Exp $ | p(success) | Risk-adj $ | Learning | Optionality | Energy cost |
|---|---:|---:|---:|---|---|---|
| Current: <slug> | $X | 0.X | $Y | H/M/L | H/M/L | H/M/L |
| Alt 1: <name> | $X | 0.X | $Y | H/M/L | H/M/L | H/M/L |
| Alt 2: <name> | $X | 0.X | $Y | H/M/L | H/M/L | H/M/L |

## Beats alternative on
- [ ] Risk-adj $
- [ ] Learning
- [ ] Optionality
- [ ] Energy fit

## Verdict
<PROCEED / SWITCH-to-X / DEFER + 1-2 lines>
```

## Verification
- ≥1 named alternative (not "nothing else").
- p(success) explicit, not implicit.
- Verdict ties to ≥2 dim wins or explicit override reason.
