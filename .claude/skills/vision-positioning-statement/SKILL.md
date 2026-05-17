---
name: vision-positioning-statement
description: Vision statement (3–10 yr aspiration) + Geoffrey Moore positioning statement (target, category, benefit, differentiator). Outputs to `docs/inception/vision-positioning-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "vision", "mission", "positioning", "elevator pitch", "tagline", "/vision-positioning-statement", or before launch / brand work.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /vision-positioning-statement — Vision + Positioning

Invoke as `/vision-positioning-statement`. Lock long-term aspiration + crisp positioning sentence. One page, two artifacts.

## Why you'd care

Without a written vision and positioning statement, every hire, every pivot conversation, and every investor meeting starts from scratch. The document is what lets the team make hundreds of small decisions consistent with one big one.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - S/M/L/XL → run full.
2. Pull priors (any that exist):
   - `docs/inception/lean-canvas-<project>.md` — value prop, segments.
   - `docs/inception/jtbd-<project>.md` — outcome users hire for.
   - `docs/inception/buyer-persona-deep-<project>.md` — target customer.
   - `docs/inception/category-design-<project>.md` — category claim.
   - `docs/inception/competitor-scan-<project>.md` — primary competitor anchor.
   - `docs/inception/brand-archetype-<project>.md` — voice.

## Inputs
- Founder's 3–10 yr aspiration (one paragraph dump).
- Primary target customer (from buyer-persona).
- Primary competitor or status-quo alternative.
- Top JTBD outcome.

## Process
1. **Vision statement** — aspirational, 1–2 sentences, 3–10 yr horizon:
   - World-state after success (not feature list).
   - Inspiring + concrete + falsifiable-ish.
   - Format: "A world where <change>." or "<verb> <outcome> for <who>."
   - Bad: "Be best CRM" (vague). Good: "Every indie dev team ships green builds by default, by 2030."
2. **Mission statement** — what you do every day to advance vision:
   - 1 sentence, present tense, verb-led.
   - Format: "We <verb> <what> so that <outcome>."
3. **Positioning statement** — Geoffrey Moore template:
   > For **<target customer>** who **<need / pain>**, **<product>** is a **<category>** that **<key benefit>**. Unlike **<primary competitor / alternative>**, we **<primary differentiator>**.
   - Each blank ≤8 words.
   - Differentiator must be defensible (cite moat: `competitive-moat-analysis`).
4. **Elevator pitch (30 sec)** — derived, 2–3 sentences:
   - Hook (problem) → Solution → Proof/credibility.
5. **Tagline (≤7 words)** — public-facing distillation:
   - One benefit, memorable, no jargon.
6. **Anti-positioning** — what we are NOT:
   - 2–3 categories/customers/use-cases we explicitly reject.
   - Prevents scope creep + dilution.
7. **Test** — read aloud to 3 prospects + 1 outsider:
   - "What does this product do?" → answer within 10 sec.
   - "Who is it for?" → answer matches target.
   - "How is it different from X?" → answer matches differentiator.
   - Fail any → revise.

## Output
Write `docs/inception/vision-positioning-<project>.md`:

```markdown
# Vision & Positioning — <project>
**Date:** <YYYY-MM-DD> · **Version:** v<n>

## Vision (3–10 yr)
> <one-paragraph aspirational world-state>

## Mission (daily)
> We <verb> <what> so that <outcome>.

## Positioning statement
> For **<target customer>** who **<need / pain>**, **<product>** is a **<category>** that **<key benefit>**. Unlike **<primary competitor>**, we **<primary differentiator>**.

### Slot breakdown
| Slot | Value | Source |
|---|---|---|
| Target customer | <persona> | buyer-persona-deep |
| Need / pain | <JTBD outcome> | jtbd |
| Product name | <name> | naming-decision |
| Category | <category> | category-design |
| Key benefit | <benefit> | lean-canvas value prop |
| Competitor | <name> | competitor-scan |
| Differentiator | <moat> | competitive-moat-analysis |

## Elevator pitch (30 sec)
> <hook>. <solution>. <proof>.

## Tagline (≤7 words)
> <tagline>

## Anti-positioning (NOT us)
- Not for <segment> — <why>.
- Not a <category> — <why>.
- Not competing on <axis> — <why>.

## Test log
| Tester | Role | "What does it do?" | "Who for?" | "How different?" | Pass? |
|---|---|---|---|---|:-:|
| <name> | Prospect | <answer> | <answer> | <answer> | ✓ |
| <name> | Outsider | ... | ... | ... | ✗ |

## Revision log
- v1 (YYYY-MM-DD) — initial.
- v2 (YYYY-MM-DD) — narrowed target after pivot.
```

## Verification
- Vision = world-state, not feature list.
- Positioning fills all 6 Moore slots, each ≤8 words.
- Differentiator cites a defensible moat (not a feature).
- Tagline ≤7 words, no jargon.
- Anti-positioning lists ≥2 explicit rejections.
- Tested on ≥3 prospects + 1 outsider; ≥75% pass rate.

## When to re-run
- Quarterly during inception.
- After pivot (target, category, or differentiator change).
- Before `/launch-strategy`, `/naming-decision`, `/content-moat-plan`.
- Always before `/inception-gate-review`.
