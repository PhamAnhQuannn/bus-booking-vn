---
name: mentor-circle-bootstrap
description: Build 5-7 person mentor circle — domain, GTM, finance, legal, peer. Cadence + ask scripts. Outputs to `docs/inception/mentor-circle-<project>.md`. Use when user says "mentor", "advisor list", "mentor circle", "/mentor-circle-bootstrap", or before `/advisor-program-design`.
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

# /mentor-circle-bootstrap — Informal Mentor Circle

## Why you'd care

Without an explicit mentor bench, founders re-derive every domain question from first principles and the answer arrives three weeks late. A 5–7 person circle is enough to shortcut the 80% of questions someone has already solved.

Pre-formal-advisor stage. Free help. Build before you need it.

## Pre-flight
None. Feeds `/advisor-program-design` later.

## Inputs
- Idea slug, target market.

## Process
1. **Identify 5 roles needed** — Domain expert, GTM/sales, Finance/economics, Legal/regulatory (only if regulated), Peer-founder (1 stage ahead).
2. **Source per role** — 3 candidate names per slot (LinkedIn, alumni, prior coworkers, Twitter, founder communities).
3. **Ask script** — 200-word cold message: who you are, what you're building, the specific 30-min ask, no equity, no commitment.
4. **Cadence design** — quarterly 30-min, monthly written update, ad-hoc questions in Slack/email.
5. **Update template** — what shipped, what's blocking, what I need.
6. **Reciprocity plan** — how do you return value (intros, public credit, beta access)?

## Output
Write `docs/inception/mentor-circle-<project>.md`:

```markdown
# Mentor Circle — <project>
**Date:** <YYYY-MM-DD>

## Roles & candidates
| Role | Slot | Candidate 1 | Candidate 2 | Candidate 3 |
|---|---|---|---|---|
| Domain | ... | ... | ... | ... |
| GTM | ... | ... | ... | ... |
| Finance | ... | ... | ... | ... |
| Legal | ... | ... | ... | ... |
| Peer-founder | ... | ... | ... | ... |

## Cold ask script
> Hi <name>, I'm building <one-line>. I admire <specific reason>. I'm not asking for time on an ongoing basis — just one 30-min call to ask <specific question>. Worst case you say no, best case I learn something that saves me 6 months. No equity, no obligation.

## Cadence
- Quarterly 30-min call
- Monthly written update (template below)
- Ad-hoc Slack/email

## Update template
- Shipped: ...
- Blocked: ...
- Ask: ...
- Win: ...

## Reciprocity
<how you give back>

## Next
- Send 15 cold messages this week (3 per role)
- After 6 months → `/advisor-program-design` for formal advisors
```

## Verification
- 5 roles × 3 candidates = 15 names slotted.
- Cold script under 200 words.
- Update template has 4 fields.
