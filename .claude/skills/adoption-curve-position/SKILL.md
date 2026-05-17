---
name: adoption-curve-position
description: Pick adoption-curve position — innovators, early adopters, early majority, late majority, laggards. Rogers' diffusion. Outputs to `docs/inception/adoption-curve-<project>.md`. Use when user says "adoption curve", "diffusion of innovations", "early adopters", "/adoption-curve-position", or before `/chasm-segment-map`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /adoption-curve-position — Know Which Tribe You're Selling To

## Why you'd care

Pitching vision to the early majority gets you politely ignored; pitching references to innovators gets you mocked. Picking the right tribe to sell to first is the difference between a working GTM and a wasted launch quarter.

Early adopters buy vision. Early majority buys references. Don't pitch them the same way.

## Pre-flight
None. Pairs with `/chasm-segment-map`, `/beachhead-segment-pick`.

## Inputs
- Beachhead segment.
- Current sales conversations (if any).

## Process
1. **Identify the curve** — innovators (2.5%) / early adopters (13.5%) / early majority (34%) / late majority (34%) / laggards (16%).
2. **Map prospect traits to curve position:**
   - Visionary, risk-tolerant, willing to be reference → early adopter
   - Pragmatist, wants references, ROI-driven → early majority
   - Conservative, wants industry standard, buys when forced → late majority
3. **Self-locate** — where are your current 5-10 conversations landing?
4. **Pitch tuning** — adjust per position:
   - Innovators: "bleeding edge tech, you'll shape it"
   - Early adopters: "transformational outcome, competitive advantage"
   - Early majority: "proven ROI, peer references, integrates with X"
   - Late majority: "industry standard, low risk, support included"
5. **Reference-pile requirement** — early-majority needs 3-5 named customer references in same vertical. If you don't have them, you can't sell here yet.
6. **Crossing-the-chasm flag** — chasm is between early adopters and early majority. Plan crossing → `/chasm-segment-map`.

## Output
Write `docs/inception/adoption-curve-<project>.md`:

```markdown
# Adoption Curve Position — <project>
**Date:** <YYYY-MM-DD>

## Current position
**Selling to:** <innovators / early adopters / early majority / late majority / laggards>
**Evidence:** <which conversation patterns map to this>

## Prospect trait map
| Prospect | Risk tolerance | Reference-seeking | ROI-driven | Position |
|----------|----------------|-------------------|------------|----------|
| <name> | High | Low | Low | Early adopter |
| <name> | Medium | High | High | Early majority |
| ... | ... | ... | ... | ... |

## Pitch by position
**Current pitch (for <position>):**
"<one-paragraph value prop tuned to this tribe>"

## What's needed to move right (toward majority)
- [ ] <N> customer references in target vertical
- [ ] ROI case study with numbers
- [ ] Integration with <industry-standard tool>
- [ ] Compliance certification (<SOC2/HIPAA/...>)
- [ ] Money-back guarantee / risk-reversal

## Chasm warning
- Early adopters bought vision; early majority will not.
- Plan crossing → `/chasm-segment-map`

## Next
- Crossing plan → `/chasm-segment-map`
- Bowling-pin segment expansion → `/bowling-pin-sequence`
- Reference building → `/customer-advisory-board`
```

## Verification
- Current position named with evidence.
- Pitch differs by position.
- "What's needed to move right" has ≥ 3 items.
- Chasm crossing flagged if relevant.
