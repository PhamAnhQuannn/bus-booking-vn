---
name: customer-interview-script
description: Mom-Test compliant interview script — past behavior questions only, no pitch, no leading. Outputs to `docs/inception/interview-script-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "interview script", "customer interview", "mom test", "/customer-interview-script", or before `/interview-log`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /customer-interview-script — Mom-Test Script

## Why you'd care

Leading questions and future hypotheticals ("would you pay for X?") produce 30 enthusiastic interviews and a product nobody buys — because people are polite about ideas and unreliable about their own future behavior. Past-behavior interviews with a script that bans pitching are what separate the founders who validate before building from the ones who spend nine months coding the wrong thing on the strength of nodded heads in coffee shops.

Invoke as `/customer-interview-script`. Anti-pitch script. Past-behavior only.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP.
   - Else continue.
2. Read `docs/inception/canvas-<project>.md` if exists — pull problem + segment.

## Inputs
- Problem hypothesis (1 sentence).
- Target segment.
- Interview length (15 / 30 / 45 min).

## Process
1. **Warm-up (2 min)** — name, role, day-in-life.
2. **Problem zone (10 min)** — past concrete instance, no hypotheticals.
3. **Workaround (5 min)** — what they currently do, cost in time/$.
4. **Magnitude (5 min)** — how often, how painful 1–10.
5. **Buying signal (3 min)** — have they paid for solution? searched? built one?
6. **No pitch.** End with "who else should I talk to?"

## Mom-Test rules
- Talk about their life, not your idea.
- Ask about specifics in the past, not generics or opinions about future.
- Talk less, listen more.

## Output
Write `docs/inception/interview-script-<project>.md`:

```markdown
# Interview Script — <project>
**Date:** <YYYY-MM-DD> | **Segment:** <X> | **Length:** N min

## Warm-up
- Tell me about your role.
- Walk me through yesterday.

## Problem zone
- Last time you faced <problem area> — what happened?
- Walk me through that exact moment.
- What did you do next?

## Workaround
- How do you handle this today?
- How long does that take?
- What does it cost you (time/$/sanity)?

## Magnitude
- How often does this come up?
- On a scale 1–10, how painful?
- What's the worst version of this you've experienced?

## Buying signal
- Have you ever paid to fix this?
- Have you searched for tools?
- Have you built something yourself?

## Close
- Who else has this problem?
- Can you intro me?

## Banned questions (do NOT ask)
- Would you use a product that...?
- Do you think X is a good idea?
- How much would you pay for...?
```

## Verification
- Zero "would you" / "do you think" / hypotheticals.
- All problem questions anchored to past concrete event.
- No mention of your solution.
