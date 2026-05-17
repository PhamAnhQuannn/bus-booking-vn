---
name: buyer-persona-deep
description: Deep buyer persona built from interviews (not imagination) — role, day-in-life, tools, budget authority, success metric. Outputs to `docs/inception/persona-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "persona", "ICP", "ideal customer", "/buyer-persona-deep", or after ≥10 interviews logged.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /buyer-persona-deep — Evidence-Based Persona

## Why you'd care

An imagined persona produces an imagined product. Pulling role, day-in-life, tools, and success metric from real interview transcripts is the difference between targeting the customer you wish existed and the one who'd actually pay you.

Invoke as `/buyer-persona-deep`. NOT imagined — built from interview-log only.

## Pre-flight
1. Read `docs/classify/<project>.md` — XS → SKIP.
2. Read `docs/inception/interview-log-<project>.md` — require ≥10 entries.
   - <10 → BLOCK with "Run more interviews first".

## Inputs
- Segment(s) from interview-log.
- Highest-signal interview cluster.

## Process
1. **Cluster interviews** — by role/segment/buying behavior.
2. **Per cluster, build persona from verbatim** — quote-source every claim.
3. **Day in life** — exact hourly pattern from interviews.
4. **Tools stack** — actual tools they named.
5. **Budget authority** — can they swipe? need approval? ceiling $?
6. **Success metric** — what does "I won this week" look like for them?
7. **Anti-persona** — who's NOT this (avoid building for adjacent miss).

## Output
Write `docs/inception/persona-<project>.md`:

```markdown
# Buyer Persona — <project>
**Date:** <YYYY-MM-DD> | **N interviews backing:** N

## Primary persona: <name/title>
**Role:** <exact title>
**Segment:** <industry/size>
**Source interviews:** #1, #4, #7, #12 (4 of 12)

## Demographic
- Age range: X
- Geo: X
- Team size around them: X

## Day in life (verbatim-derived)
- 8:30 — <activity> ("I always start with..." — #4)
- 10:00 — <activity>
- ...

## Tools currently used
| Tool | Purpose | Frequency | Pain noted |
|---|---|---|---|
| <X> | <Y> | daily | "slow" |

## Budget authority
- Discretionary: $X/mo
- Approval needed above: $X
- Buying cycle: <self / mgr / committee>

## Success metric (their definition of winning)
- "<verbatim>" — #N

## Triggers (what makes them search for solution)
- <event A>
- <event B>

## Anti-persona (NOT this user)
- <profile> — why they're a miss
- <profile>

## Confidence
**HIGH / MEDIUM / LOW** (evidence-density)
```

## Verification
- Every section has ≥1 verbatim quote citation.
- Anti-persona explicit.
- Budget authority quantified.
- Confidence score honest (LOW if <10 interviews backing).
