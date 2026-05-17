---
name: demo-day-script
description: Demo day script — 60-90 sec investor pitch with timed beats. Outputs to `docs/inception/demo-day-script-<project>.md`. Use when user says "demo day", "demo script", "60-second pitch", "investor demo", "/demo-day-script", or pre-YC-DD / batch pitch.
output_size:
  XS: 30m
  S: 30m
  M: 30m
  L: 30m
  XL: 30m
---

# /demo-day-script — 60 Seconds Decides Whether You Get The Meeting

## Why you'd care

The 60-second slot at YC Demo Day or any batch event is what 250 investors will use to decide whether to take the post-event meeting — and the company that opens with traction wins five times more first meetings than the one that opens with problem-statement framing. Timed beat-by-beat rehearsal of hook, what, traction, ask is what turns a memorable founder from one of 100 into the three the partner messages their team about that night, and it's the only artifact in the inception kit that compresses fundraising velocity by a measurable factor.

Demo day = 60-90 sec. Investors hear 100+ pitches. Yours = remembered or forgotten in week 1.

## Pre-flight
Run after `/sequoia-deck-skeleton`, `/elevator-pitch`. Pairs with `/pitch-deck-narrative`, `/one-pager-teaser`.

## Inputs
- Hook (1 line).
- Traction (numbers).
- Ask + cap.
- Practiced 30+ times.

## Process
1. **Time budget:** 60s ideal, 90s max. Use stopwatch.
2. **Memorize beats, not script** — sounds rehearsed = bad.
3. **Hook in first 5 seconds** — surprising stat / quote / question.
4. **3 beats:** problem (15s) → solution + traction (30s) → ask (15s).
5. **Numbers visible** — "$25k MRR, 18% MoM, 42 customers" beats "growing fast".
6. **End on ask** — last thing they hear = what you want.
7. **Practice with stopwatch** — go over 90 = cut, not speed-talk.
8. **Co-founder watching** — they catch tics + ums.

## Output
Write `docs/inception/demo-day-script-<project>.md`:

```markdown
# Demo Day Script — <project>
**Time budget:** 60 sec (hard 90 sec ceiling)
**Audience:** investors hearing 50+ pitches that day
**Goal:** they remember us, request the deck

## Script (read at 150 wpm = ~150 words / 60 sec)

### Beat 1 — Hook (0:00–0:08)
> "<Surprising stat or quote>."

Example: "SMB ecom ops teams spend 30% of their week manually processing returns. Not selling. Returns."

### Beat 2 — Problem (0:08–0:20)
> "<Pain in 2 sentences>. <Why it's not solved>."

Example: "Their tools are spreadsheets + email. The big returns platforms cost $50k/yr and take 3 months to integrate. SMBs can't afford either."

### Beat 3 — Solution (0:20–0:35)
> "<What we built>. <The differentiator>."

Example: "We're <Co name>. We let SMB ops teams automate returns in 1 day for $400/month. Plug in Shopify, we handle the rest."

### Beat 4 — Traction (0:35–0:50)
> "<Numbers + growth + signal>."

Example: "Live for 4 months. $25k MRR. 42 paying customers. Growing 18% month-over-month. 7-day payback. NPS 65."

### Beat 5 — Ask (0:50–1:00)
> "<Round + cap + lead status>. Find me after to talk."

Example: "Raising $1.5M at $12M cap. $1M committed. Find me after."

## Memorize-beats not script
**Don't memorize verbatim.** Memorize:
1. The opening line (hook is sacred)
2. The 3 beats (problem / solution / traction)
3. The closing ask

Adapt the middle to room energy.

## Stage presence
- **Stand still** — pacing reads as nerves
- **Look at audience** — not slides
- **Speak slower than feels natural** — recorded yourself = clarity
- **Pause at beat changes** — 1 sec breath = signals important

## Slide companion (if slides allowed)
| Slide | Time | Content |
|-------|------|---------|
| 1 | 0:00 | Logo + tagline + URL |
| 2 | 0:08 | Pain quote + screenshot |
| 3 | 0:20 | Product demo (1 screen, 1 mockup) |
| 4 | 0:35 | Traction chart (MoM growth) |
| 5 | 0:50 | Ask + contact |

5 slides max. No bullet lists. Big numbers, big images.

## After-pitch hallway plan
- Have one-pager PDF on phone
- DocSend link ready to AirDrop
- Calendar app open for "let's grab 15 min next week"
- Don't pitch again in hallway — answer 1 question + book follow-up

## Rehearsal checklist
- [ ] Recorded yourself 5+ times
- [ ] Co-founder + 2 advisors gave notes
- [ ] Timed each beat (not just total)
- [ ] No filler words ("um", "like", "you know")
- [ ] Cut by 20% from first draft
- [ ] Practiced standing + with imagined audience
- [ ] Slides reduced to images + 1 number each

## Anti-patterns
- ❌ Speed-talking to fit content (cut content instead)
- ❌ Reading slides
- ❌ "Today I'd like to introduce..." (skip, hook first)
- ❌ Future-tense everything ("we will be...")
- ❌ Mission-first ("Our mission is to...")
- ❌ "We're the Airbnb of X" (cliche → trash)

## Pitfalls flagged
- [ ] Under 90 sec
- [ ] Hook in first 8 sec
- [ ] Specific numbers (not "fast", "many")
- [ ] Ask is last thing said
- [ ] Rehearsed 30+ times
- [ ] Co-founder + advisor reviewed
- [ ] Slides ≤ 5

## Next
- Deck for follow-ups → `/sequoia-deck-skeleton`
- One-pager handout → `/one-pager-teaser`
- Investor target list → `/investor-target-list`
- Diligence prep → `/diligence-checklist`
```

## Verification
- ≤ 90 sec.
- Hook in first 8 sec.
- 3 beats clearly timed.
- Ask is last beat.
- Rehearsed 30+ times.
- Slides ≤ 5.
