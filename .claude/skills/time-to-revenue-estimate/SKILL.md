---
name: time-to-revenue-estimate
description: Estimate weeks-to-first-dollar honestly with class-aware buffers — kills "ship in 2 weeks" delusion before commit. Outputs to `docs/inception/time-to-revenue-<project>.md`. No class skip (runs early, may inform classify). Use when user says "how long to revenue", "ship date", "/time-to-revenue-estimate", or before commit-to-build.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /time-to-revenue-estimate — Honest TTR

Invoke as `/time-to-revenue-estimate`. Anti-Hofstadter skill. Includes the parts you forget.

## Why you'd care

"We'll ship in two weeks" is the most expensive sentence in startup vocabulary because the founder commits the runway against it. A class-aware estimate is what keeps the commit-to-build gate honest.

## Pre-flight
None — often runs pre-classify to inform classification.

## Inputs
- Idea slug.
- Best-guess ship date (raw founder estimate).
- Distribution channel (how do customers find you?).

## Process
1. **Founder estimate** — record raw "ship in N weeks" claim.
2. **Decompose** — list every step from today → first paid customer:
   - Build MVP
   - Payment integration
   - Legal (ToS, privacy, entity if needed)
   - Domain + landing page
   - Initial outreach / first 10 leads
   - Onboarding back-and-forth
   - First paid conversion
3. **Per-step weeks** — honest, not aspirational.
4. **Buffer** — multiply total by Hofstadter factor:
   - XS: 1.5x
   - S: 2x
   - M: 2.5x
   - L: 3x
   - XL: 4x
5. **Distribution lag** — add weeks for channel to warm up (SEO: 12+ wk; cold outreach: 4 wk; existing audience: 1 wk).
6. **Honest TTR** = (Σ steps × buffer) + distribution lag.

## Output
Write `docs/inception/time-to-revenue-<project>.md`:

```markdown
# Time to Revenue — <project>
**Date:** <YYYY-MM-DD> | **Founder estimate:** N wk | **Honest TTR:** M wk

## Steps
| Step | Weeks |
|---|---:|
| Build MVP | X |
| Payment integration | X |
| Legal (ToS/privacy/entity) | X |
| Domain + landing | X |
| First 10 leads | X |
| Onboarding | X |
| First paid conversion | X |
| **Sum** | **X** |

## Buffer
- Class: <X>
- Multiplier: <Yx>
- Adjusted: X * Y = Z weeks

## Distribution lag
- Channel: <SEO / cold / audience / paid>
- Lag: + W weeks

## Honest TTR
**Z + W = M weeks** (vs founder N — gap: M-N weeks)

## Implication
<if gap > 50%, flag scope cut or runway re-check>
```

## Verification
- ≥7 decomposed steps (not lumped "build").
- Buffer applied (not skipped because "I'm fast").
- Distribution lag included.
- Gap vs founder estimate explicit.
