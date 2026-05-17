---
name: chasm-segment-map
description: Crossing-the-chasm segment map — Moore's whole-product + reference-account strategy to jump from early adopters to early majority. Outputs to `docs/inception/chasm-map-<project>.md`. Use when user says "crossing the chasm", "chasm", "whole product", "/chasm-segment-map", or after `/adoption-curve-position` shows you're stuck at early adopters.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /chasm-segment-map — Cross The Adoption Chasm

## Why you'd care

The "early adopters love us" stage is where most startups quietly die — early majority buyers don't take your call without reference accounts and a whole-product story. Mapping the bridge means the next dollar of GTM is aimed at the right buyer, not the one you already won.

The chasm is where startups die. Early adopters love you; early majority ignores you. This skill maps the bridge.

## Pre-flight
Run `/adoption-curve-position` first. Skill is only relevant if you're at or near the chasm.

## Inputs
- Beachhead segment.
- 3-5 current early-adopter customers (or strong prospects).

## Process
1. **Pick the bowling pin** — one tightly-defined vertical/use-case that the early majority pragmatist in that niche cannot ignore. Narrower than beachhead.
2. **Whole-product gap list** — pragmatist won't buy a "product"; they buy a complete solution. Enumerate gaps:
   - Generic product (you have)
   - Expected product (table-stakes for vertical)
   - Augmented product (training, support, SLA, integrations)
   - Potential product (roadmap promises)
3. **Pragmatist's pain check** — is this pain top-3 for the pragmatist? If not, pick a different pin.
4. **Reference accounts** — 3-5 named pragmatists in the vertical who will go public. Without these, no crossing.
5. **Distribution channel pick** — pragmatists buy through trusted channels (analyst report, peer recommendation, vertical conference, channel partner). Pick one.
6. **Compete on whole product, not features** — pragmatists compare you to "do nothing" or to category leader. Position accordingly.
7. **D-day** — pick a launch event (vertical conference, analyst quadrant inclusion) and work backwards.

## Output
Write `docs/inception/chasm-map-<project>.md`:

```markdown
# Crossing the Chasm Map — <project>
**Date:** <YYYY-MM-DD>

## Target bowling pin
**Vertical + use-case:** <e.g., "12-30 table independent bistros, no-show recovery during dinner rush">
**Pragmatist persona:** <name role, traits, where they hang out>
**Size of pin:** <N companies in this exact shape>

## Whole product gap analysis
| Layer | What pragmatist expects | We have? | Gap |
|-------|------------------------|----------|-----|
| Generic | Core product | ✓ | — |
| Expected | <e.g., POS integration> | ✗ | Build / partner |
| Expected | <e.g., 24/7 support> | ✗ | Hire / outsource |
| Augmented | <e.g., onboarding training> | ✗ | Concierge |
| Potential | <e.g., loyalty roadmap> | Roadmap | Communicate |

## Pragmatist pain check
- Top 3 pains in this pin: <pain 1>, <pain 2>, <pain 3>
- We solve: <which>
- **Buy now?** <Yes / No — if no, pick different pin>

## Reference accounts target list
| # | Account | Why they'd go public | Status |
|---|---------|---------------------|--------|
| 1 | ... | ... | In conversation |
| 2 | ... | ... | Prospect |
| 3 | ... | ... | Cold |
| 4 | ... | ... | — |
| 5 | ... | ... | — |

## Distribution channel
**Pick:** <analyst / vertical conference / channel partner / peer ref / publication>
**Why:** pragmatists in this pin trust <X>

## Competitive position
**Against:** <category leader / do-nothing alternative>
**Wedge:** <one specific advantage that matters to this pin>

## D-day
**Event:** <conference / launch / analyst report>
**Date:** <YYYY-MM-DD>
**Work-back milestones:**
- T-90: <e.g., 5 reference accounts signed>
- T-60: <whole-product gaps closed>
- T-30: <case studies published>
- T-0: <launch>

## Next
- Bowling-pin expansion order → `/bowling-pin-sequence`
- Reference-customer program → `/customer-advisory-board`
- Whole-product gap close → `/early-design-partner-plan`
```

## Verification
- One bowling pin named with size estimate.
- Whole-product gap table has ≥ 3 gaps.
- Reference list has 5 named targets.
- D-day has a specific date with work-back milestones.
