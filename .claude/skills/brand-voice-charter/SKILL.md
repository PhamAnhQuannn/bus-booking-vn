---
name: brand-voice-charter
description: Define brand voice + tone — adjectives, do/don't pairs, sample copy across surfaces. Outputs to `docs/inception/brand-voice-<project>.md`. Use when user says "brand voice", "tone of voice", "copywriting voice", "voice guide", "/brand-voice-charter", or before any marketing copy / onboarding microcopy.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /brand-voice-charter — How The Product Talks

## Why you'd care

Six writers without a voice charter produce six different products on the same domain. A charter — adjectives, do/don't pairs, sample copy — is what makes microcopy compound into recognizable brand instead of averaging into beige.

Without a charter, every screen sounds different. With one, microcopy compounds.

## Pre-flight
None. Pairs with `/brand-archetype`, `/messaging-pillars`, `/tagline-shortlist`.

## Inputs
- ICP profile (`/ideal-customer-profile`).
- Brand archetype (`/brand-archetype`).
- 3-5 competitor copy samples for contrast.

## Process
1. **Voice adjectives — pick 3-4** from polar axes:
   - formal ↔ casual
   - serious ↔ playful
   - expert ↔ approachable
   - reverent ↔ irreverent
   - matter-of-fact ↔ enthusiastic
   - direct ↔ poetic
2. **Tone shift rules** — voice constant, tone varies by surface:
   - Error message: empathetic + actionable
   - Success: warm + brief
   - Marketing landing: confident + benefit-led
   - Legal: plain-language but precise
   - Onboarding: encouraging + concrete
3. **Do / don't pairs** — for each adjective, write 5 do/don't copy pairs.
4. **Vocabulary list** — words we use, words we never use (banned-word list).
5. **Punctuation rules** — exclamation budget, em-dash use, Oxford comma, sentence case vs title case.
6. **Sample copy per surface** — write microcopy for: 404, empty state, button, toast, header, footer, email subject, push notification.
7. **Failure pattern check** — read aloud — does it sound like a human or a TOS document?

## Output
Write `docs/inception/brand-voice-<project>.md`:

```markdown
# Brand Voice Charter — <project>
**Date:** <YYYY-MM-DD>
**Archetype:** <e.g., The Sage> (see `/brand-archetype`)

## Voice adjectives
1. **Direct** — say it once, no padding
2. **Warm** — like a colleague, not a corporation
3. **Confident** — recommendations not options
4. **Plainspoken** — no jargon, no buzzwords

## Tone shifts by surface
| Surface | Tone |
|---------|------|
| Error message | Calm + actionable |
| Success toast | Brief + warm |
| Marketing hero | Confident + bold |
| Legal | Plain + precise |
| Onboarding | Encouraging + concrete |
| Push notification | Urgent only when real |

## Do / don't
| Do | Don't |
|----|-------|
| "Build passed." | "Pipeline execution completed successfully." |
| "We couldn't reach Stripe. Try again in a moment." | "An error occurred. Please contact support." |
| "Pick a plan." | "Please select your preferred subscription tier." |
| "That repo's private. Want to grant access?" | "Unfortunately, the requested resource is inaccessible." |
| "Done." | "Your action has been successfully completed!" |

## Vocabulary
**Use:** ship, run, pick, send, drop us a line, heads up
**Avoid:** utilize, leverage, synergy, robust, seamless, frictionless, world-class, revolutionary
**Banned:** "We're sorry for any inconvenience" (passive empathy theater)

## Punctuation rules
- Exclamation budget: max 1 per screen, never in errors
- Em-dash for asides, not parentheses
- Oxford comma always
- Sentence case for buttons + headers
- No ellipsis except for genuine loading state

## Sample copy
**404:** "Nothing here. Try the dashboard."
**Empty state:** "No runs yet. Connect a repo →"
**Submit button:** "Run it"
**Success toast:** "Deployed. Live in 30s."
**Header email:** "Your weekly run report"
**Push:** "Build green. Ship it."

## Read-aloud test
- [ ] Sounds like a human, not a TOS
- [ ] Sounds like THIS product, not a generic SaaS
- [ ] A customer could quote it back without irony

## Next
- Messaging pillars → `/messaging-pillars`
- Tagline shortlist → `/tagline-shortlist`
- Apply to onboarding → `/onboarding-flow`
```

## Verification
- 3-4 adjectives picked from polar axes.
- 5+ do/don't pairs.
- Banned-word list non-empty.
- Sample copy for 6+ surfaces.
- Read-aloud test passed.
