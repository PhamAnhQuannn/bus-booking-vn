---
depends-on: [076-operator-registration, 059-storage-s3-client]
type: FEATURE
wave: 5
spec: [S05, SYS12, SYS11]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S05] / [SYS12] / [SYS11]

## What to build

**KYB document submission** — business / identity / payout-account docs, stored privately
for admin review (Approvals, issue 065 consumes them).

- `model KybDocument(id, operatorId, type, storageKey, uploadedAt, status)` + migration.
- Direct client→S3 **signed PUT** upload (issue 059); DB stores only the key. Size + type
  validation; access audit-logged.
- Operator UI to upload + see submitted docs (in the pending/under-review console).
- Submitting docs can move the operator PENDING_REVIEW → UNDER_REVIEW (issue 045 transition)
  or leave that to admin — decide + document.

## Acceptance criteria

- [ ] `KybDocument` model + migration; docs uploaded via signed PUT (no server byte-proxy).
- [ ] DB stores keys only; size/type validated; access audit-logged.
- [ ] Operator can upload + view their submitted docs.
- [ ] Admin Approvals (issue 065) can read them via signed GET.
- [ ] Doc submission's effect on operator state documented.

## Blocked by

- Blocked by `issues/076-operator-registration.md`, `issues/059-storage-s3-client.md`

## User stories addressed

- [S05] submit business/identity/payout-account docs to apply to sell.
