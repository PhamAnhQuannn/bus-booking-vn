---
depends-on: [056-admin-middleware-segment, 046-approval-gate-search-booking, 059-storage-s3-client]
type: FEATURE
wave: 3
spec: [S11, S05, SYS12]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S11] (Approvals tab)

## What to build

Admin **Approvals** queue — review pending operators + their submitted KYB docs, verify
payout-account ownership, approve / reject (reason) / request-more-info. Drives the operator
state machine (issue 045) transitions; audit-logged.

- Queue of `PENDING_REVIEW` / `UNDER_REVIEW` operators with submitted docs (signed GET URLs
  from storage, issue 059; KYB submission UI/model is Wave 5 issue 077 — Approvals consumes it).
- Actions: move to UNDER_REVIEW, APPROVE, REJECT(reason), request-more-info → each calls the
  issue-045 transition service (no duplicated status logic) + enqueues the state-change
  notification (issue 058).
- Verify payout-account ownership (micro-deposit / name-match confirmation surfaced here;
  the verify mechanism is Wave 5 issue 078 — Approvals records the admin's confirmation).
- Step-up re-auth (issue 055) required for approve (privileged action).
- Every decision audit-logged (`AdminAuditLog`).

## Acceptance criteria

- [ ] Approvals queue lists pending/under-review operators + their docs (signed URLs).
- [ ] Approve/reject/request-info call the 045 transition service + enqueue notifications.
- [ ] Approve requires step-up TOTP (issue 055).
- [ ] Payout-account ownership confirmation captured.
- [ ] Every decision audit-logged; reject stores the reason.

## Blocked by

- Blocked by `issues/056-admin-middleware-segment.md`,
  `issues/046-approval-gate-search-booking.md`, `issues/059-storage-s3-client.md`

## User stories addressed

- [S11] admin Approvals: review queue, verify payout account, approve/reject/request-info.
