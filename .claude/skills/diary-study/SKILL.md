---
name: diary-study
description: Longitudinal user diary — 7-14 day self-report on pain frequency + context. Outputs to `docs/inception/diary-study-<project>.md`. Use when user says "diary study", "log study", "experience sampling", "/diary-study", or when pain frequency is unknown.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /diary-study — Longitudinal Self-Report

## Why you'd care

A one-shot interview tells you the user remembers the pain; a 14-day diary tells you whether it actually happens twice a week or twice a year — and the second answer is the one that decides whether the product is a vitamin or a painkiller. Most "validated" startups are validated on recall, not frequency, and the discovery that the pain is real but rare arrives only after six months of building when DAU never moves. Diary studies catch the frequency signal cheaply, before the architecture is committed.

One-shot interviews miss frequency and time-of-day. Diary studies catch both.

## Pre-flight
None. Pairs with `/mom-test-protocol`, `/ethnography-pass`.

## Inputs
- 5-15 participants.
- Trigger event to log (e.g., "every time you do X").
- 7-14 day window.

## Process
1. **Pick the trigger** — narrow ("every time you cancel a booking"), not broad ("when frustrated").
2. **Prompt channel** — SMS / WhatsApp / Notion form / paper. Use what the participant already uses.
3. **Entry schema** — 5 fields max: time, trigger, what you did, how long, frustration 1-5.
4. **Frequency target** — aim for ≥ 1 entry/day average. Below = trigger too rare or recall fatigue.
5. **Incentive** — small ($25-50) at completion, NOT per entry (gameable).
6. **Mid-study check-in** — day 3 nudge, day 7 review. Catch dropouts early.
7. **Closing interview** — 30-min wrap synthesizing diary with subject. They surface patterns you missed.
8. **Coding pass** — tag each entry: TRIGGER-TYPE, WORKAROUND, INTENSITY, TIME-OF-DAY.

## Output
Write `docs/inception/diary-study-<project>.md`:

```markdown
# Diary Study — <project>
**Date:** <YYYY-MM-DD start> to <end>
**Participants:** <N>

## Trigger
Log every time: <event>

## Channel
<SMS / WhatsApp / Notion / paper>

## Entry schema
- Time
- What triggered it
- What you did
- How long it took
- Frustration 1-5

## Results
- Total entries: <N>
- Avg entries/participant/day: <X>
- Median frustration: <X>
- Most common workaround: <text>

## Pattern table
| Trigger type | Count | Avg intensity | Time-of-day cluster |
|--------------|-------|---------------|---------------------|
| ... | ... | ... | ... |

## Surprises
- (things diary surfaced that interviews missed)

## Closing-interview synthesis
> "..."

## Next
- High-frequency + high-intensity pattern → `/problem-statement-doc`
- Low frequency → kill or re-scope
- Workaround patterns → MVP feature candidates
```

## Verification
- Trigger is specific event, not mood.
- Avg ≥ 1 entry/day or trigger flagged as too rare.
- Coding tags applied.
- Closing interview held.
