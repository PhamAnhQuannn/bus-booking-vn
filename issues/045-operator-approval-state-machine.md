---
depends-on: []
type: FEATURE
wave: 1
spec: [S05, SYS12]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S05] / [SYS12]

## What to build

The operator **approval state machine** (model layer). Today `Operator` has only
`disabledAt` (binary); spec needs a 4-state machine. This issue is the enum + transitions
+ per-state caps; the search/booking GATES are issue 046; KYB doc submit + registration UI
are Wave 5.

- Add `OperatorStatus` enum `PENDING_REVIEW | UNDER_REVIEW | APPROVED | REJECTED | SUSPENDED`
  + `status` column on `Operator` (migration; default `PENDING_REVIEW` for new, backfill
  existing live operators → `APPROVED`). Keep `disabledAt` or fold into `SUSPENDED` — decide
  + document.
- Transition edges (enforced in a `lib/onboarding` service): `PENDING_REVIEW → UNDER_REVIEW
  → APPROVED | REJECTED`; `REJECTED → PENDING_REVIEW` (resubmit); `APPROVED ↔ SUSPENDED`.
  Reject illegal transitions.
- Per-state capability flags (read by gates + UI): pending/under-review = login + draft
  setup only (NO sell / search-visibility / payout); approved = full; rejected = resubmit;
  suspended = read + frozen payout + listings hidden.
- Every state change emits a notification (via NotificationLog enqueue — dispatcher is
  Wave 2; enqueue the row now).
- `rejectionReason` field for REJECTED.

## Acceptance criteria

- [ ] `OperatorStatus` enum + `Operator.status` column (migration schema.prisma + SQL);
      existing operators backfilled to APPROVED.
- [ ] Transition service enforces the 5 legal edges; illegal transition rejected.
- [ ] Per-state capability helper returns correct caps for each status.
- [ ] Each transition enqueues a NotificationLog row (template per transition).
- [ ] Unit tests cover every legal + a sample illegal transition.

## Blocked by

- none

## User stories addressed

- [S05] 4-state operator lifecycle (pending/under-review/approved/rejected) + resubmit +
  suspend.
