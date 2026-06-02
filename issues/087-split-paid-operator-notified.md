---
depends-on: [058-notification-dispatcher-stub, 034-monotonic-transition-guard]
type: FIX
wave: 7
spec: [S01, SYS05, S04, S07, S15-10]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S01] / [SYS05] (S15 ratified item 10)

## What to build

**Split `paid_operator_notified` → `paid`** — the forbidden combined money+notification flag
(#12). Money truth = `paid`; notification delivery lives in `NotificationLog` (issue 058
dispatcher), never folded into booking state. Part of the coordinated Phase B migration.

- Migrate `BookingStatus`: `paid_operator_notified` → `paid`. Update the enum + a data
  migration converting existing rows.
- Update every read path keying on the old value: `searchTrips.ts:142-147` (booking-sum
  status filter), booking/account status badges (`listCustomerBookings`,
  `listOperatorBookings`), the money-state machine writes (`processWebhook.ts:145`).
- Notification fact now read from `NotificationLog` (delivery status), decoupled (already
  enforced by issue 058 — this removes the last place state was conflated).
- Coordinate with the monotonic-transition map (issue 034) — update its legal-transition set
  to the renamed value.
- Also rename hold `converted` → `consumed` (SYS05 named state) in the same migration if low-
  risk; else document as a follow-up.

## Acceptance criteria

- [ ] `BookingStatus` has `paid` (not `paid_operator_notified`); existing rows migrated.
- [ ] All read paths (search sum-filter, customer/operator badges) key on `paid`.
- [ ] Notification delivery read from NotificationLog, not booking state.
- [ ] Monotonic-transition map updated to the new value.
- [ ] Full test suite green (search/booking/account specs updated).

## Blocked by

- Blocked by `issues/058-notification-dispatcher-stub.md`,
  `issues/034-monotonic-transition-guard.md`

## User stories addressed

- [S01]/#12 booking money-state = `paid`; delivery tracked separately in NotificationLog.
