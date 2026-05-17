---
name: incident-commander-runbook
description: Incident Commander (IC) role definition + comms cadence + decision authority during prod page. Outputs IC runbook + drill script to `docs/operate/ic-runbook.md`. Reads `/project-classify` to skip XS. Use when user says "incident commander", "IC", "page", "war room", "incident response", "/incident-commander-runbook", or before first prod outage.
output_size:
  XS: skip
  S: 1h
  M: 4h
  L: 4h
  XL: 4h
---

# /incident-commander-runbook — IC Role + Decision Authority

## Why you'd care

During a prod page, the team defaults to everyone-debugging-in-parallel with no decision authority, no comms cadence, and no one watching the clock — outages last 3–5x longer than they should. A defined IC role is the single biggest MTTR lever.

Invoke as `/incident-commander-runbook`. Incidents without IC = mob debugging. With IC = coordinated response.

## Pre-flight
1. Read `docs/classify/<project>.md`. XS → SKIP.
2. Pre-existing: PagerDuty/Opsgenie/incident.io account, status page tool, comms channel (Slack #incidents).
3. IC role rotates — not a single person.

## Inputs
- Oncall rotation list
- Severity rubric (SEV1/2/3/4)
- Comms channels (internal + customer)
- Authority chain

## Process

1. **Severity rubric**:

   | SEV | Definition | Response time | IC required |
   |---|---|---|---|
   | SEV1 | Full outage, data loss, security breach | <5min | Yes |
   | SEV2 | Major degradation, region down, partial data | <15min | Yes |
   | SEV3 | Single-feature broken, workaround exists | <1h business hours | Optional |
   | SEV4 | Minor bug, no user impact | next business day | No |

2. **IC responsibilities** — IC does NOT debug. IC coordinates:
   - Open incident channel (`#inc-<datetime>-<short-desc>`)
   - Assign roles: Tech Lead (debugs), Comms Lead (status page + customer), Scribe (timeline)
   - Drive cadence: status update every 15min minimum
   - Make call: page more people, declare resolved, hand off
   - Decide: when to roll back, when to communicate externally, when to escalate

3. **Phases**:

   | Phase | Owner | Action |
   |---|---|---|
   | Detection | Monitoring/customer | Page fires |
   | Triage | First responder | Acknowledge, assess severity, page IC if SEV1/2 |
   | Coordination | IC | Open channel, assign roles, set cadence |
   | Mitigation | Tech Lead | Stop the bleeding (not root-cause fix) |
   | Communication | Comms Lead | Status page, customer email, internal updates |
   | Resolution | IC | Declare resolved when monitoring clean for N min |
   | Post-mortem | IC schedules | `/post-mortem` within 5 business days |

4. **Comms cadence**:
   - Internal: every 15min in incident channel, even "still investigating"
   - Status page: within 5min of SEV1/2 confirmation, update every 30min
   - Customer email: at start (if >30min impact), at resolution

5. **Decision authority**:
   - IC can: roll back deploy, page anyone, take service offline, declare resolved
   - IC cannot: bypass change-management for non-rollback fixes (escalate to VP Eng)

6. **Drill schedule**:
   - Quarterly tabletop: scenario walked through, no actual systems touched
   - Annual live drill: planned outage in non-peak window

7. **Handoff protocol** — if incident exceeds shift:
   - Outgoing IC writes handoff: timeline, current theory, next action, comms status
   - 15-min overlap with incoming IC
   - Channel pinned: current IC, current Tech Lead, current Comms

## Output

Write `docs/operate/ic-runbook.md`:

```markdown
# Incident Commander Runbook
**Date:** <YYYY-MM-DD> | **Owner:** VP Eng

## Severity rubric
<table from process step 1>

## Roles (each incident)
- **IC** — coordinator, decisions, comms cadence (NOT debugger)
- **Tech Lead** — investigates, mitigates
- **Comms Lead** — status page, customer emails
- **Scribe** — timestamped timeline (becomes post-mortem source)

## Channels
- Internal: Slack `#inc-<datetime>-<slug>`
- Status: <status page URL>
- Customer email: from `incidents@<domain>`
- Internal escalation: PagerDuty schedule `<name>`

## IC checklist (first 15min)
- [ ] Open channel
- [ ] Confirm severity
- [ ] Assign Tech Lead + Comms Lead + Scribe
- [ ] Post status-page incident if SEV1/2
- [ ] Set 15-min update cadence
- [ ] Identify "stop the bleeding" candidate

## Decision authority
| Action | IC | VP Eng | CEO |
|---|:--:|:--:|:--:|
| Roll back deploy | ✓ | ✓ | ✓ |
| Page anyone | ✓ | ✓ | ✓ |
| Take service offline | ✓ | ✓ | ✓ |
| Bypass change mgmt | – | ✓ | ✓ |
| External press statement | – | – | ✓ |

## Handoff
- Written handoff: timeline + theory + next action
- 15min overlap

## Drills
- Tabletop: quarterly
- Live: annual, planned

## Post-incident
- Post-mortem scheduled within 24h, drafted within 5 business days
- Action items tracked in <Linear/Jira project>
```

## Verification
- IC role separated from debugger.
- Severity rubric concrete (not "depends").
- Comms cadence has minutes, not "regular updates".
- Decision authority matrix written.
- Drill cadence on calendar.
- Handoff protocol exists.
