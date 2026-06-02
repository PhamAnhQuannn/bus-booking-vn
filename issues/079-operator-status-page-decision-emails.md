---
depends-on: [076-operator-registration, 058-notification-dispatcher-stub]
type: FEATURE
wave: 5
spec: [S05, SYS12]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S05] / [SYS12]

## What to build

Operator **application status page** + **decision emails** both ways. [S05]: operator checks
status anytime (pending / under review / approved / rejected); a decision email fires on
approve (go live) and reject (reason + resubmit). Every state change notifies.

- Status-check page (operator console / a ref-keyed page): shows current `OperatorStatus`
  (issue 045) + next steps; rejected shows the reason + a resubmit path
  (REJECTED→PENDING_REVIEW edge).
- Decision emails (enqueue via issue 058): APPROVED → "go live"; REJECTED → reason + resubmit
  instructions. Wire to the issue-045 transition notifications (the enqueue hooks already
  exist from 045; this issue supplies the templates + the status page).
- SUSPENDED → listings pulled + reason (notification + status reflects it).

## Acceptance criteria

- [ ] Status page shows live OperatorStatus + next steps; rejected shows reason + resubmit.
- [ ] Approve email ("go live") + reject email (reason + resubmit) enqueued on transition.
- [ ] Suspend reflected in status + notified.
- [ ] Resubmit path moves REJECTED → PENDING_REVIEW (issue 045 edge).

## Blocked by

- Blocked by `issues/076-operator-registration.md`,
  `issues/058-notification-dispatcher-stub.md`

## User stories addressed

- [S05] check application status anytime; decision email both ways; every state change
  notifies.
