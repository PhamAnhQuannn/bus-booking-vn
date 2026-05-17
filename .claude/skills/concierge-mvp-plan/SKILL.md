---
name: concierge-mvp-plan
description: Plan manual-service MVP — deliver outcome by hand to first 3-10 users, no code. Outputs to `docs/inception/concierge-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "concierge", "manual MVP", "do it by hand", "/concierge-mvp-plan", or before `/mvp-scope` build.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /concierge-mvp-plan — Manual Service MVP

## Why you'd care

Building the product before you've delivered the outcome by hand means you're guessing about every step the automation should optimize. Three to ten concierge-served users is how you find out what to build before spending engineering cycles on the wrong workflow.

Invoke as `/concierge-mvp-plan`. Deliver outcome by hand. Code later.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP (too small to need validation layer)
   - S/M → recommended
   - L/XL → may skip if regulated/contract-blocked
2. Read `docs/inception/mvp-scope-<project>.md` — pull primary outcome.

## Inputs
- Outcome user pays for.
- 3–10 named target users.
- Manual delivery time-budget (hr/week you can spend).

## Process
1. **Outcome statement** — what user receives, no method named.
2. **Manual delivery script** — hour-by-hour what YOU do per user.
3. **Inputs from user** — what they hand over (form, email, call).
4. **Outputs to user** — exact deliverable format.
5. **Time per user / week** — capacity check.
6. **Charge?** — free / discounted / full price (recommend: charge SOMETHING, even token).
7. **Learning hypotheses** — what 5 questions you'll answer in 4 weeks.
8. **Graduation criteria** — when do we automate? (e.g. ≥10 paid users + 3 same-step pattern).

## Output
Write `docs/inception/concierge-<project>.md`:

```markdown
# Concierge MVP Plan — <project>
**Date:** <YYYY-MM-DD> | **Outcome:** <X> | **Capacity:** N hr/wk

## Outcome user receives
<deliverable>

## First users (named)
1. <name> — <segment> — <committed Y/N>
2. ...

## Manual delivery script
| Step | What I do | Time | Tool |
|---|---|--:|---|
| 1 | Receive intake form | 5m | Typeform |
| 2 | Pull data from <X> | 30m | manual |
| 3 | Process / draft | 60m | spreadsheet |
| 4 | Deliver as PDF | 15m | email |

**Time per user: N hr | Capacity: N users/wk**

## Pricing
- Charge: $X (rationale: <Y>)

## Learning hypotheses (answer in 4 wk)
1. Will N users pay $X for this outcome?
2. Which step takes longest? (automate first)
3. What do users actually ask for in step 1?
4. ...

## Graduation triggers (build software when)
- ≥N paid users
- ≥X% steps repeating identically
- Manual time > Y hr/user (not scalable)

## Failure triggers (kill concierge)
- 0 paid by week 4
- Users unwilling to do step 1 (proves no real demand)
```

## Verification
- Named users (not "I'll find them").
- Time-per-user × capacity ≥ user count.
- Pricing > $0 (free = no signal).
- Graduation + failure triggers both quantified.
