---
depends-on: [081-charter-request-model, 056-admin-middleware-segment, 058-notification-dispatcher-stub]
type: FEATURE
wave: 6
spec: [S18, SYS19]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S18]

## What to build

Admin **charter dispatch** — the queue + per-request `ASSIGN_DIRECT(op) | PUBLISH | REJECT`
+ status/reassign. Lives in the admin realm (issue 056); audit-logged (SYS13).

- Admin charter queue (`app/admin/charter`): incoming requests in `ADMIN_REVIEW`.
- Per-request action: **ASSIGN_DIRECT(operatorId)** (→ ASSIGNED_DIRECT, sets `acceptByAt` =
  +24h), **PUBLISH** (→ PUBLISHED, sets `claimByAt` = +48h), **REJECT(reason)** (spam/invalid).
- See status + **reassign** when an assigned operator declines or a published request expires
  (both routed back to ADMIN_REVIEW by the sweeper, issue 086).
- New-charter-request notification to admin (issue 058).
- Every dispatch action **audit-logged** (issue 062 immutable AdminAuditLog).

## Acceptance criteria

- [ ] Admin charter queue lists ADMIN_REVIEW requests.
- [ ] ASSIGN_DIRECT / PUBLISH / REJECT(reason) transition correctly + set the timeout fields.
- [ ] Reassign works for declined/expired requests.
- [ ] New-request notification to admin; every action audit-logged.
- [ ] Behind admin auth; role-gated.

## Blocked by

- Blocked by `issues/081-charter-request-model.md`,
  `issues/056-admin-middleware-segment.md`, `issues/058-notification-dispatcher-stub.md`

## User stories addressed

- [S18] admin charter dispatch: queue, assign/publish/reject, status/reassign, notifications,
  audit.
