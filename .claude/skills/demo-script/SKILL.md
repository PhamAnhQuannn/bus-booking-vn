---
name: demo-script
description: 3-5 minute end-to-end demo script — narrated golden path with backup plan. Outputs to `docs/inception/demo-script-<project>.md`. Use when user says "demo script", "demo flow", "scripted demo", "/demo-script", or before customer call / investor meeting / Demo Day.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /demo-script — Scripted Golden Path

## Why you'd care

The unscripted demo wanders into the half-broken admin screen because the founder couldn't remember which tab to avoid, and the prospect remembers the wander, not the value prop — the deal stalls "for budget reasons." A 3-5 minute scripted golden path with a tested backup (offline screenshots, pre-recorded video) is what keeps the showing-not-telling moment crisp under demo-gods pressure, and it converts roughly 2× more demos to next-meeting compared with the freestyle alternative.

A demo that wanders loses the room. Script it, rehearse it, have a backup.

## Pre-flight
None. Pairs with `/pitch-deck-narrative`, `/demo-day-script`.

## Inputs
- Working prototype or product surface.
- Audience (customer / investor / press / internal).

## Process
1. **One outcome promise** — what does the viewer see resolved in 3-5 min? Frame it as job-to-be-done, not feature.
2. **Persona snap** — name the person we're acting as in the demo. Real-sounding context (e.g., "Sara, owner of 12-table bistro, Friday 8pm rush").
3. **Beats** — 4-6 numbered moments. Each beat = one click/action + one talking-line.
4. **Surprise moment** — one beat must show a "wow" the audience couldn't predict.
5. **No "let me show you the settings"** — cut menu spelunking. Only the path.
6. **Failure-recovery branches** — for each beat, what if a click fails? Pre-loaded backup state? Voiceover-only fallback?
7. **Rehearsal timer** — three full runs. If over 5 min, cut a beat.
8. **Backup plan** — pre-recorded video + screenshots if live demo dies.

## Output
Write `docs/inception/demo-script-<project>.md`:

```markdown
# Demo Script — <project>
**Date:** <YYYY-MM-DD>
**Audience:** <customer / investor / press / internal>
**Length target:** <3-5 min>

## Outcome promise
"In the next 4 minutes you'll see <persona> go from <pain state> to <resolved state>."

## Persona for demo
- Name: <fake but realistic>
- Context: <role, scale, time-of-day>
- Goal: <what they're trying to do>

## Beats
| # | Action (click) | Talking line | Time | Wow? |
|---|---------------|--------------|------|------|
| 1 | Land on dashboard | "It's 8pm Friday — every table booked." | 0:30 | — |
| 2 | Click X | "She gets a no-show alert." | 0:45 | — |
| 3 | Click Y | "One tap reseats the waitlist party." | 1:00 | ⭐ |
| ... | ... | ... | ... | ... |

## Wow moment
Beat #<X> — <why this is unexpected>

## Cut-from-demo (do NOT show)
- Settings panel
- Onboarding
- <other tangents>

## Failure-recovery
| Beat | If click fails | Recovery |
|------|----------------|----------|
| 1 | Login slow | Pre-logged-in tab ready |
| 3 | API 500 | Voiceover: "Normally..." + screenshot |

## Backup plan
- Pre-recorded screencast: <path>
- Static screenshots: <path>
- Fallback verbal pitch: <30s summary>

## Rehearsal log
| Run | Time | Issue | Fix |
|-----|------|-------|-----|
| 1 | 5:30 | Cut beat #4 | done |
| 2 | 4:10 | Stumbled on beat #3 | rephrase |
| 3 | 3:55 | Clean | ship |

## Next
- Demo Day version → `/demo-day-script`
- Investor pitch context → `/pitch-deck-narrative`
- Capture in marketing → screencast for landing page
```

## Verification
- Outcome promise in one sentence.
- 4-6 beats, each with action + line.
- One ⭐ wow moment.
- Backup plan documented.
- ≥ 3 rehearsals logged, under target time.
