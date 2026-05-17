---
name: ethnography-pass
description: Field observation pass — watch users in their natural workflow, capture friction without interviewing. Outputs to `docs/inception/ethnography-<project>.md`. Use when user says "ethnography", "field study", "observe users", "shadow", "contextual inquiry", "/ethnography-pass", or when interviews keep producing generic answers.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /ethnography-pass — Watch, Don't Ask

## Why you'd care

A user who tells you in an interview they use spreadsheets to manage inventory is the same user who, when you sit beside them for 45 minutes, switches between four different spreadsheets, a printed sheet, and three Slack DMs to track a single order — and the spreadsheet was the only one mentioned because it's the only one they think of as the system. Watching beats asking when interviews keep returning generic answers, and the discovered duct-tape stack is usually the actual product surface to displace.

Interviews capture what users say. Ethnography captures what they actually do.

## Pre-flight
None. Pairs with `/mom-test-protocol`, `/diary-study`.

## Inputs
- Target persona + workflow segment.
- 3-5 observation slots (60-90 min each).
- Permission to watch.

## Process
1. **Scope the workflow** — pick ONE bounded task (e.g., "Monday morning incident triage on the on-call rotation"). Not a whole day.
2. **Observer stance** — silent shadowing. No questions during observation. Note-taker only.
3. **Field-note schema** — 4 columns: time, action, tool, friction.
4. **Tag friction inline** — WORKAROUND / WAIT / RETRY / ERROR / DUPLICATION / CONTEXT-SWITCH.
5. **Photograph the artefacts** — sticky notes, whiteboards, hacked spreadsheets, paper ledgers. Workarounds are gold.
6. **Post-session debrief** — 10 min with subject: "I saw you do X — tell me about that." NOT during observation.
7. **Affinity cluster** — group friction notes from all sessions into 3-5 themes.

## Output
Write `docs/inception/ethnography-<project>.md`:

```markdown
# Ethnography — <project>
**Date:** <YYYY-MM-DD>
**Sites observed:** <N>

## Scope
Workflow: <bounded task>
Duration per session: <min>

## Field notes (sample)
| Time | Action | Tool | Friction tag |
|------|--------|------|--------------|
| 09:02 | Opened PagerDuty incident | Browser | — |
| 09:04 | Cross-checked Datadog dashboard | Browser tab 2 | DUPLICATION |
| 09:06 | Slack DM pings, switches | Slack | CONTEXT-SWITCH |
| ... | ... | ... | ... |

## Artefacts captured
- <photo/note ref> — <what it tells us>

## Affinity themes
1. <theme> — <N occurrences across N sessions>
2. ...
3. ...

## Top 3 pain candidates (validated by behavior)
1. ...
2. ...
3. ...

## Quotes from debrief
> "..."

## Next
- Validate pain candidates via `/mom-test-protocol`
- Promote top theme to `/problem-statement-doc`
- Workarounds → first MVP scope candidates
```

## Verification
- One bounded workflow, not "a day".
- Friction tags applied inline.
- At least one artefact captured.
- Affinity themes derived from observed behavior, not opinions.
