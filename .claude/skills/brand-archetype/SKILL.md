---
name: brand-archetype
description: Pick Jung/Mark brand archetype + voice + visual mood. Outputs to `docs/inception/brand-archetype-<project>.md`. Reads `/project-classify` to skip XS/S. Use when user says "brand archetype", "brand voice", "brand identity", "/brand-archetype", or after PMF before scaling brand.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /brand-archetype — Brand Archetype

## Why you'd care

Post-PMF, every screen, ad, and email needs to sound like one company; without a chosen archetype, copy and visuals drift into incoherence as the team grows. Pre-PMF, this is procrastination — that's why the skill gates itself to M+ projects.

Invoke as `/brand-archetype`. M+ post-PMF only. Pre-PMF brand work = procrastination.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S → SKIP (anti-pattern: brand work pre-validation)
2. Read `docs/inception/positioning-statement-<project>.md` + `category-<project>.md`.

## Inputs
- Product positioning + ICP.
- Founder personality + values.
- Competitor brand archetypes.

## Process
1. **12 archetypes (Mark/Pearson)**:
   - **Innocent** — Coca-Cola, Dove (purity, simplicity)
   - **Sage** — Google, NYT (wisdom, knowledge)
   - **Explorer** — Patagonia, Jeep (freedom, adventure)
   - **Outlaw** — Harley, Virgin (rebellion, disruption)
   - **Magician** — Apple, Disney (transformation, vision)
   - **Hero** — Nike, BMW (mastery, courage)
   - **Lover** — Chanel, Häagen-Dazs (passion, sensuality)
   - **Jester** — Old Spice, Mailchimp (joy, fun)
   - **Everyman** — IKEA, Target (belonging, realism)
   - **Caregiver** — Johnson & Johnson, Volvo (compassion, safety)
   - **Ruler** — Mercedes, Rolex (control, leadership)
   - **Creator** — Lego, Adobe (innovation, imagination)
2. **Pick 1 primary + 1 secondary** — primary dominant, secondary nuance.
3. **Avoid same as direct competitors** — differentiation:
   - If incumbent is Ruler → consider Outlaw or Jester
   - If incumbent is Sage → consider Magician or Hero
4. **Voice + tone derivation**:
   - Word choice (formal/casual, jargon/plain)
   - Sentence length
   - Humor (none/dry/playful)
   - Pronoun (we/I/you)
5. **Visual mood**:
   - Color (warm/cool, saturated/muted)
   - Typography (serif/sans, geometric/humanist)
   - Imagery (people/abstract, polished/raw)
6. **Brand strategy doc** — DO/DON'T list per archetype.

## Output
Write `docs/inception/brand-archetype-<project>.md`:

```markdown
# Brand Archetype — <project>
**Date:** <YYYY-MM-DD>

## Chosen archetypes
- **Primary:** <Magician>
- **Secondary:** <Sage>

## Rationale
- Product positioning: <X> — Magician transforms work
- Persona: developer wants to build → empowered by tool
- Founder voice: <Y>
- Differentiation: incumbents are Ruler (heavy enterprise) → Magician disrupts
- Competitor archetype map:
  - Salesforce: Ruler
  - HubSpot: Caregiver/Sage
  - Notion: Creator
  - **Us: Magician + Sage** (transformation backed by depth)

## Voice & tone
| Dimension | Choice | Example |
|---|---|---|
| Pronoun | "you" + "we" | "you ship; we handle the boilerplate" |
| Formality | conversational professional | not "synergize"; not "bro" |
| Humor | dry, occasional | rare jokes, never forced |
| Jargon | tech-fluent | "vertex shader" OK with dev audience |
| Sentence length | medium-short | avoid run-ons |
| Confidence | quietly confident | no superlatives "best ever" |

## Visual mood
| Element | Choice |
|---|---|
| Color palette | deep purple primary, warm accent, muted gray neutrals |
| Typography | sans (Inter); mono accent (JetBrains Mono) |
| Imagery | abstract geometric > stock people; product UI > illustrations |
| Logo style | wordmark > icon |
| Motion | subtle; meaningful, not decorative |

## DO / DON'T
**DO**
- Show transformation in case studies ("from chaos → clarity")
- Use depth-of-knowledge in content (Sage backbone)
- Confident without arrogance
- Reveal craft (engineering posts, behind-scenes)

**DON'T**
- Generic SaaS startup voice ("revolutionary platform")
- Fake humor / forced jokes
- Stock photography of diverse-team-laughing-at-laptop
- Motion graphics for the sake of it
- Cluttered design

## Brand pillars (3)
1. **Depth** — we know the domain better than alternatives (Sage)
2. **Transformation** — measurable change, not incremental (Magician)
3. **Craft** — visible quality of work (cross-archetype)

## Competitor archetype map
| Competitor | Archetype | How they sound |
|---|---|---|
| Salesforce | Ruler | authoritative, enterprise |
| HubSpot | Caregiver/Sage | helpful, instructive |
| Notion | Creator | playful, building |
| Linear | Magician | sleek, transformation |
| Us | Magician + Sage | transformation + depth |

## Application
- Marketing copy: rewrite per voice
- Logo + colors: design brief next
- Sales deck: tone
- Support replies: tone
- Job descriptions: tone
- Investor updates: tone

## Anti-patterns
- ✗ "We're all 12 archetypes" (no archetype = no brand)
- ✗ Picking based on what you wish you were vs what product delivers
- ✗ Same archetype as #1 incumbent (no differentiation)
- ✗ Brand work before PMF
```

## Verification
- 1 primary + 1 secondary chosen (not all 12).
- Differentiation from competitors mapped.
- Voice + visual mood explicit.
- DO/DON'T list applied.
- 3 brand pillars max.
