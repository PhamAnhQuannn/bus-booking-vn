---
name: messaging-pillars
description: Build 3-5 messaging pillars — proof-backed claims tying to ICP pain. Outputs to `docs/inception/messaging-pillars-<project>.md`. Use when user says "messaging pillars", "key messages", "value props", "message house", "/messaging-pillars", or before landing page / sales deck / pitch.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /messaging-pillars — The Three Things You Always Say

## Why you'd care

Without 3–5 defended messaging pillars, every page, deck, and ad rewrites the value-prop from scratch and the brand drifts. The pillars give every comms surface a shared spine.

Without pillars, every page reinvents the message. With them, every surface compounds.

## Pre-flight
None. Pairs with `/positioning-statement`, `/brand-voice-charter`, `/tagline-shortlist`.

## Inputs
- ICP top 3 jobs-to-be-done + top 3 anxieties.
- Positioning statement (e.g., `/vision-positioning-statement`).
- 3-5 customer interview quotes verbatim.
- Competitor messaging scan.

## Process
1. **Anchor the message house** — one umbrella claim (your positioning), then 3-5 pillars beneath it.
2. **Pick 3-5 pillars** — each pillar must:
   - Address a top ICP pain
   - Differentiate from substitutes
   - Be provable (data, demo, customer quote)
3. **Per pillar, write:**
   - Pillar headline (5-7 words)
   - Sub-claim (1 sentence)
   - 3 proof points (data, screenshot, quote)
   - Failure language (when NOT to claim it)
4. **Map pillars to surfaces** — which pillars lead on landing hero, vs sales deck slide 3, vs onboarding, vs investor pitch.
5. **Strip-test** — remove any pillar a competitor could plausibly also claim. Generic = dead.
6. **Pressure test with 3 ICP** — show pillars stripped of brand. Do they pick yours over competitor's?

## Output
Write `docs/inception/messaging-pillars-<project>.md`:

```markdown
# Messaging Pillars — <project>
**Date:** <YYYY-MM-DD>
**Umbrella claim:** <positioning, 1 sentence>

## Pillar 1: <headline>
**Sub-claim:** <1 sentence — what we promise>
**ICP pain addressed:** <pain>
**Proof:**
1. Data: <stat, source>
2. Demo: <feature / screenshot link>
3. Customer quote: "<verbatim>" — <name, role, company>
**Don't claim when:** <conditions where this is dishonest>

## Pillar 2: <headline>
...same structure...

## Pillar 3: <headline>
...same structure...

## Pillar mapping by surface
| Surface | Lead pillar | Support pillars |
|---------|-------------|-----------------|
| Landing hero | 1 | 2 |
| Landing features section | 1, 2, 3 | — |
| Sales deck slide 3 | 1 | 2, 3 |
| Onboarding day 1 | 2 | — |
| Investor pitch problem slide | 1 | — |
| Email nurture series | 1 → 2 → 3 | — |

## Strip test
| Pillar | Could competitor X claim? | Keep / kill |
|--------|---------------------------|-------------|
| 1 | No — depends on our data moat | KEEP |
| 2 | Resy could → reframe | REWRITE |
| 3 | No — depends on our integration | KEEP |

## ICP blind test (3 prospects)
| Tester | Picked ours over competitor's? | Reason |
|--------|-------------------------------|--------|
| A | yes | "More specific" |
| B | yes | "Sounds like they get it" |
| C | no | "Resy promised the same" |

## Next
- Apply to tagline → `/tagline-shortlist`
- Apply to landing → `/landing-page-test`
- Apply to deck → `/pitch-deck-narrative`
- Apply to onboarding → `/onboarding-flow`
```

## Verification
- 3-5 pillars (no more — diluted).
- Each pillar has sub-claim + 3 proof points + failure language.
- Surface mapping covers ≥ 5 surfaces.
- Strip test eliminates generic pillars.
- ICP blind test logged.
