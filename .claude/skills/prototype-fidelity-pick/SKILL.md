---
name: prototype-fidelity-pick
description: Pick prototype fidelity — paper, clickable Figma, concierge, Wizard-of-Oz, or coded. Outputs to `docs/inception/prototype-fidelity-<project>.md`. Use when user says "prototype fidelity", "how high fidelity", "Figma vs code", "/prototype-fidelity-pick", or before `/solution-mockup` or `/concierge-mvp-plan`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /prototype-fidelity-pick — Match Fidelity to Question

Higher fidelity ≠ better. Pick the lowest fidelity that can answer the question.

## Why you'd care

Pixel-perfect Figma prototypes for problems that needed paper sketches is how teams burn three weeks on UI before validating any feedback. The right fidelity is the one that gets you the most learning per hour.

## Pre-flight
None. Feeds `/solution-mockup`, `/concierge-mvp-plan`, `/wizard-of-oz-plan`, `/landing-page-test`.

## Inputs
- Question being tested (desirability / usability / viability / feasibility).
- Time + cash budget.

## Process
1. **State the question** — what one thing do you need to learn? "Do they click 'buy'?" "Can they complete signup unassisted?"
2. **Fidelity ladder** (cheap → expensive):
   - **Landing page** — desirability, demand
   - **Paper sketch** — concept clarity
   - **Clickable Figma** — flow, usability
   - **Concierge** — desirability + value with human-in-loop
   - **Wizard-of-Oz** — perceived automation, value
   - **Coded MVP** — feasibility + scale-readiness
3. **Match fidelity to question** — pick lowest tier that can answer it.
4. **Anti-pattern check** — if you picked "coded MVP" to test desirability, downgrade. If you picked "paper sketch" to test feasibility, upgrade.
5. **Budget bound** — time + cash ceiling. If picked fidelity exceeds, drop a tier and re-frame question.
6. **Success criteria** — what observation = answered? (≥ X% click, ≥ Y% complete, $Z pre-orders, etc.)

## Output
Write `docs/inception/prototype-fidelity-<project>.md`:

```markdown
# Prototype Fidelity Pick — <project>
**Date:** <YYYY-MM-DD>

## Question
"<one sentence>"

## Fidelity ladder
| Tier | What it tests | Cost (time/$) | Picked? |
|------|---------------|---------------|---------|
| Landing page | Desirability/demand | 1d / $50 ad | ... |
| Paper sketch | Concept clarity | 2h / $0 | ... |
| Clickable Figma | Flow / usability | 1-3d / $0 | ... |
| Concierge | Desirability + value (human) | 1-2 wk | ... |
| Wizard-of-Oz | Perceived automation | 2-4 wk | ... |
| Coded MVP | Feasibility + scale | 4+ wk | ... |

## Pick
**Tier:** <name>
**Why this tier:** answers question at lowest fidelity that won't lie

## Anti-pattern check
- ❌ Coded MVP for desirability → use landing page first
- ❌ Paper sketch for feasibility → spike instead
- ✓ Picked tier matches question

## Budget
- Time: <X>
- Cash: <Y>
- Stops at: <date or $ cap>

## Success criteria
- Observation: <X>
- Threshold: <Y>

## Next
- Tier = landing page → `/landing-page-test`
- Tier = concierge → `/concierge-mvp-plan`
- Tier = WoO → `/wizard-of-oz-plan`
- Tier = coded → `/mvp-scope`
```

## Verification
- Question stated in one sentence.
- One tier selected.
- Anti-pattern check explicit.
- Success criteria numeric.
