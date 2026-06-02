---
depends-on: [045-operator-approval-state-machine, 058-notification-dispatcher-stub]
type: FEATURE
wave: 5
spec: [S05, SYS12]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S05] / [SYS12]

## What to build

**Self-serve operator registration** + confirmation + pending email. Today operators are
CLI-created (`lib/admin/createOperator.ts`); there's no registration route/page, no
application ref.

- Public operator registration route/page: collect business + contact info → create an
  `Operator` in `PENDING_REVIEW` (issue 045) + the first `OperatorUser` (force-password-change
  per existing first-login gate). Generate an **application ref**.
- **Confirmation page** (ref + next steps).
- **Pending email** with the review **SLA range** ("within 2 business days" — a RANGE, not an
  exact countdown) + the ref (enqueue via issue 058).
- Pending operators can log in + draft setup (buses/routes/draft trips) but cannot
  sell/be-visible/payout (issue 045 caps + issue 046 gate already enforce this).
- Registration route rate-limited + CSRF (SYS14).

## Acceptance criteria

- [ ] Registration creates a PENDING_REVIEW operator + first OperatorUser + an app ref.
- [ ] Confirmation page shows ref + next steps.
- [ ] Pending email enqueued with SLA range + ref (not an exact clock).
- [ ] Pending operator can log in + draft, cannot sell/be-visible/payout.
- [ ] Route rate-limited + CSRF-protected.

## Blocked by

- Blocked by `issues/045-operator-approval-state-machine.md`,
  `issues/058-notification-dispatcher-stub.md`

## User stories addressed

- [S05] register + confirmation (ref + next steps) + pending email (SLA range).
