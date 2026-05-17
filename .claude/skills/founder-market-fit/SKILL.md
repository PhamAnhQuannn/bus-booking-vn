---
name: founder-market-fit
description: Score founder-market fit before sinking 6+ months. Domain depth, network, unfair info, persistence ceiling. Outputs to `docs/inception/fmf-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "founder market fit", "FMF", "am I the right person", "/founder-market-fit", or before commit-to-build gate.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /founder-market-fit — Founder-Market Fit Score

## Why you'd care

Without explicit FMF scoring you can sink six months into a market where you have no unfair advantage and slowly lose to anyone with domain depth. The score forces the honest answer before the calendar bill arrives.

Honest 0–10 audit. Cheap to flunk now, expensive later.

## Pre-flight
`docs/inception/classification-<project>.md` exists. Skip if XS. If `docs/inception/fmf-<project>.md` exists → load + refresh.

## Inputs
- Idea slug, target market, founder background.

## Process
1. **Domain depth** — years in this domain, scars, what you know that outsiders don't (0–10).
2. **Network** — first 20 customers reachable warm? Distribution edge? (0–10).
3. **Unfair info** — data, access, insight competitors can't get (0–10).
4. **Persistence ceiling** — how long can you stick when revenue is zero? (0–10, time in months).
5. **Motivation** — why this idea vs other ideas you could chase (free text).
6. **Risk** — top 3 reasons you might be the wrong founder.
7. **Verdict** — GO / GO-WITH-CO-FOUNDER / REFRAME / KILL.

## Output
Write `docs/inception/fmf-<project>.md`:

```markdown
# Founder-Market Fit — <project>
**Date:** <YYYY-MM-DD>

## Scores (0–10)
- Domain depth: X — <why>
- Network: X — <why>
- Unfair info: X — <why>
- Persistence ceiling: X months

## Motivation
<free text>

## Top 3 wrong-founder risks
1. <risk>
2. <risk>
3. <risk>

## Verdict
GO | GO-WITH-CO-FOUNDER | REFRAME | KILL

## Next
- If GO-WITH-CO-FOUNDER → `/co-founder-fit-assessment`
- If GO → `/problem-validation`
- If REFRAME → `/idea-capture` redo
- If KILL → `/idea-kill-list`
```

## Verification
- 4 scores numeric, motivation written, 3 risks named, verdict picked.
- Total domain+network+unfair < 15 → flag REFRAME by default.
