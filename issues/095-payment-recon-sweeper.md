---
depends-on: [034-monotonic-transition-guard, 058-notification-dispatcher-stub]
type: FEATURE
wave: 2
spec: [SYS06, SYS10, S12]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS06] / [SYS10] / [S12]

## What to build

The **payment-reconciliation sweeper** that the codebase already assumes exists but nothing
builds. Issue 032 (DONE) intentionally leaves underpaid / short success-IPN bookings in
`awaiting_payment` "for the reconciliation sweeper to resolve"; issue 094 (go-live) lists a
`/payment-reconciliation` pass and "recon sweeper picks up + expires stuck `awaiting_payment`" as
acceptance — but there is no sweeper. Stuck `awaiting_payment` rows currently live forever.

- A dispatch cron under `app/api/cron/reconcile-payments/route.ts`, **run-locked** via `runJob` +
  `withAdvisoryLock` (`lib/jobs/withAdvisoryLock.ts`, the pattern from the 6 existing crons /
  issue 019); one `JobRunLog` row per run.
- New `lib/jobs/reconcilePayments.ts`: select `awaiting_payment` bookings older than a threshold
  (> hold TTL, e.g. 30 min). For each:
  - (a) a matching confirmed `PaymentEvent` / PSP-confirmed paid (amount ≥ `totalVnd`) →
    transition to paid through the **same guarded/monotonic path** as `processWebhook` (never
    regress a paid row — issue 034);
  - (b) no confirmation AND the hold has expired → `payment_failed_expired`.
- **Degraded match** for bank-transfer rails per [SYS06]: when the memo is missing/garbled, match
  on `amount + receiving-account + time-window` instead of `orderRef`.
- Resolve the underpaid-success rows parked by issue 032 (do not silently mark them paid; expire
  them when genuinely unpaid).
- Register the cron in the cron registry (`vercel.json` / wherever the other crons are wired).

## Acceptance criteria

- [ ] A stuck `awaiting_payment` booking past the threshold is resolved to paid (when a confirming
      event exists) OR `payment_failed_expired` (when unpaid + hold expired).
- [ ] Monotonic guard respected: a reconciled/replayed event never regresses a paid booking.
- [ ] Degraded match (amount + account + time-window) resolves a memo-less bank-transfer event.
- [ ] Run-locked: two concurrent ticks do not double-process (advisory lock); one `JobRunLog`/run.
- [ ] Integration test seeds a stuck `awaiting_payment` + a matching event → reconciled to paid;
      and a stuck row with no event + expired hold → `payment_failed_expired`.

## Blocked by

- Blocked by `issues/034-monotonic-transition-guard.md` (reuse the guarded transition).
- Blocked by `issues/058-notification-dispatcher-stub.md` (enqueue reconcile-outcome notifications
  through the dispatcher, not in-process).

## User stories addressed

- [S12] As platform, short/wrong/stuck payments are reconciled server-side so no booking is left
  permanently `awaiting_payment` and no underpayment is accepted as paid.
