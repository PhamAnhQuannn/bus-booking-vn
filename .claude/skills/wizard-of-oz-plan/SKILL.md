---
name: wizard-of-oz-plan
description: Fake automated product — UI looks real, human delivers behind curtain. Outputs to `docs/inception/wizard-of-oz-<project>.md`. Reads `/project-classify` to skip XS. Use when user says "wizard of oz", "fake AI", "human in loop MVP", "/wizard-of-oz-plan", or after `/mvp-scope` if AI/ML feature.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /wizard-of-oz-plan — Fake the Backend

Invoke as `/wizard-of-oz-plan`. UI = real. Backend = you, manually.

## Why you'd care

Building the automation before validating the demand is how AI/ML features burn six months to confirm nobody wanted them. A human-behind-the-curtain MVP tests the demand for a fraction of the cost.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS → SKIP
   - S/M → recommended for AI/ML/algo features
2. Read `docs/inception/mvp-scope-<project>.md`.

## Inputs
- Feature being faked.
- UI surface (form / chat / dashboard).
- Response SLA you can sustain (e.g. <5 min in business hours).

## Process
1. **Identify automation lie** — what user thinks is auto?
2. **Build minimal UI** — Typeform / Bubble / Retool / Notion form.
3. **Wire intake notify** — Slack/email triggers when input received.
4. **Manual fulfillment script** — your steps to produce response.
5. **Response delivery** — back into UI? email? chat?
6. **SLA + monitoring** — response time target + you alerts.
7. **Disclosure decision** — disclose human now? after pivot? (legal: must disclose if user thinks AI in regulated context).
8. **Graduation criteria** — automate when pattern stable + volume > capacity.

## Output
Write `docs/inception/wizard-of-oz-<project>.md`:

```markdown
# Wizard of Oz Plan — <project>
**Date:** <YYYY-MM-DD> | **Feature faked:** <X> | **SLA:** <T>

## What appears automated
<feature> — user submits, gets answer in <T>, thinks AI/algorithm did it.

## UI stack
- Frontend: <Typeform / Bubble / Retool>
- Intake notify: <Slack webhook / email>
- Response delivery: <UI update / email / chat>

## Manual script
| Step | I do | Time | Tool |
|---|---|--:|---|
| 1 | Receive intake notify | <2m | Slack |
| 2 | Draft response | 10m | spreadsheet/template |
| 3 | Push to UI | 1m | admin panel |

**Cycle time: ~15 min | Capacity: N/day**

## SLA
- Response: <T min in <hours>
- Outside hours: queued + delivered next morning

## Disclosure
- [ ] Disclosed (recommend if regulated / health / finance)
- [ ] Not disclosed (consumer / low-stakes only)
- Reason: <X>

## Learning hypotheses
1. What fraction of intakes follow repeatable pattern?
2. What edge cases break template?
3. Does the perceived-automation create different user behavior than concierge?

## Graduation triggers (automate)
- ≥80% intakes solved by N templates
- Volume > Y/day (manual unsustainable)

## Risk
- Disclosure backlash if found out → mitigation: <X>
- Legal: <regulator concerns>
```

## Verification
- Disclosure decision documented + justified.
- SLA realistic for solo capacity.
- Graduation triggers measurable.
- Legal review noted if regulated domain.
