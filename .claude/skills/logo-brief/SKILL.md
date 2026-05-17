---
name: logo-brief
description: Brief for logo designer — wordmark vs mark vs combo, usage contexts, constraints. Outputs to `docs/inception/logo-brief-<project>.md`. Use when user says "logo brief", "logo design", "designer brief", "/logo-brief", or before hiring designer / using AI tools.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /logo-brief — Tell A Designer What You Need

## Why you'd care

Designers asked to make a logo with no brief produce three rounds of generic options and burn the budget on revisions. The brief makes the first round usable.

A bad brief produces a bad logo no matter how good the designer. Spend 30 minutes here, save 5 revisions.

## Pre-flight
None. Pairs with `/visual-mood-board`, `/brand-voice-charter`, `/trademark-pre-screen`.

## Inputs
- Trademark-cleared name (`/trademark-pre-screen`).
- Mood board (`/visual-mood-board`).
- Brand voice (`/brand-voice-charter`).

## Process
1. **Pick logo type**:
   - **Wordmark** (text only — Google, FedEx) — best when name is unique + short
   - **Lettermark** (initials — IBM, HBO) — long company name
   - **Pictorial mark** (icon — Apple, Twitter) — high-recall, hard to start with
   - **Abstract mark** (Nike, Pepsi) — needs marketing budget
   - **Combination** (mark + wordmark — Adidas) — most flexible for startups
2. **Usage contexts** — list 8+ where logo will appear (favicon 16x16, app icon 1024x1024, OG image, business card, swag, video bumper, slide deck, invoice). Logo must work in ALL.
3. **Constraints**:
   - Monochrome version works (single-color fax / engraving)
   - Min size legible (16px favicon)
   - Aspect ratio range (1:1 + 3:1)
   - Color tokens (from mood board)
4. **Avoid list** — gradients, drop shadows, 3D, photographic elements, > 2 fonts, swooshes, generic icons (gears, lightbulbs, mountains, infinity).
5. **References** — 3 logos you'd kill for (with why) + 3 you'd reject (with why).
6. **Deliverables list** — SVG, PNG (1x / 2x / 3x), favicon ICO, social-media kit, dark + light variants, clearspace guide.
7. **Timeline + budget** — 99designs $500, Fiverr designer $200, indie designer $2-5k, agency $10k+. AI tools (Midjourney + manual cleanup) $50 + your time.

## Output
Write `docs/inception/logo-brief-<project>.md`:

```markdown
# Logo Brief — <project>
**Date:** <YYYY-MM-DD>
**Name (TM-cleared):** <name>

## Logo type
**Picked:** Combination (icon + wordmark)
**Why:** short name benefits from icon for favicon + app icon, wordmark for header

## Usage contexts
| Surface | Min size | Notes |
|---------|----------|-------|
| Favicon | 16×16 | icon only |
| App icon | 1024×1024 | icon only, rounded mask |
| Header | 32px tall | combo horizontal |
| OG image | 1200×630 | combo centered |
| Email signature | 120×40 | combo |
| Business card | 1" tall | combo or wordmark |
| Swag (shirt) | 4" tall | icon or combo |
| Video bumper | 1920×1080 | combo + tagline |

## Constraints
- Monochrome version (single color) must work
- Legible at 16px
- Two aspect ratios: 1:1 (icon) + 3:1 (combo)
- Color from `/visual-mood-board`: anchor #1a1a1a, accent #c9472b
- Font from `/visual-mood-board`: Söhne or similar grotesk
- Clearspace = height of icon × 1

## Avoid
- Gradients, drop shadows, 3D
- Photographic elements
- More than 1 font
- Swooshes, motion lines
- Generic icons: gear, lightbulb, mountain, infinity, brain
- Anything that signals "AI startup" (sparkles, atom, robot face)

## Loved references
| # | Logo | Why |
|---|------|-----|
| 1 | Linear | crisp wordmark, single weight |
| 2 | Stripe | warm color, distinctive S |
| 3 | Notion | playful but mature, monoline mark |

## Rejected references
| # | Logo | Why |
|---|------|-----|
| 1 | <typical SaaS cube logo> | generic, forgettable |
| 2 | <gradient swoosh> | 2015 web 2.0 |
| 3 | <wordmark in Lobster font> | unprofessional |

## Deliverables
- [ ] SVG master (icon, wordmark, combo)
- [ ] PNG @1x / @2x / @3x for each
- [ ] Favicon .ico + apple-touch-icon
- [ ] Social-media kit (Twitter, LinkedIn, IG profile + cover)
- [ ] Dark + light variants
- [ ] Brand guidelines PDF (clearspace, don'ts, color codes)

## Source files
- Editable Figma file
- All fonts licensed for commercial use (or open-source)
- Copyright assigned to <legal entity>

## Budget + timeline
- Budget: $<X>
- Designer: <name / platform>
- Timeline: 2-week round 1, 1-week revisions, 1-week deliverables

## Next
- After delivery: `/design-system` to tokenize
- Apply to landing → `/landing-page-test`
- Apply to onboarding → `/onboarding-flow`
```

## Verification
- Logo type picked with reason.
- 8+ usage contexts with min size.
- Avoid list non-empty.
- 3 loved + 3 rejected refs with reasons.
- Deliverables list includes monochrome + favicon + dark.
- Budget + timeline set.
