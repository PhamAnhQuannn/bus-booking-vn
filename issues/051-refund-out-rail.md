---
depends-on: [050-balance-payout-state-machine]
type: FEATURE
wave: 1
spec: [SYS06, SYS07, S13, S03, S06]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS06] / [SYS07] / [S13] (Ledger slice e)

## What to build

The **refund-out rail** — money leaving back to the customer. No customer-initiated refunds
(policy), but the system MUST move money back for: operator-cancel (default, S15#2),
oversold-race, and bank-transfer overpayment-difference (issue 032 flags the overpay).

- `refundOut(bookingId, amountMinor, reason, idempotencyKey)`: calls the PSP refund (stub
  under `PAYMENTS_STUB`/`NOTIFY_STUB`-style; real PSP deferred per project memory) AND writes
  a `refund_out` ledger entry + the matching `refund_debit` (clawback of the operator credit)
  — both keyed by an idempotency key **distinct from the inbound payment** key.
- Wire the triggers: operator trip-cancel (`lib/trips/cancelTrip.ts` — today flips bookings to
  `trip_cancelled` but triggers NO refund) now enqueues refund-out per paid booking; oversold-
  race (rare, from issue 036) path; overpayment-difference from issue 032.
- Idempotent: replay of the same refund must not double-refund or double-debit (Mistake-Log
  patterns — sourceEventId/idempotency key + monotonic).
- Stubbed PSP refund returns deterministically under the stub flag for tests.

## Acceptance criteria

- [ ] `refundOut` writes `refund_out` + `refund_debit` entries (idempotent on its own key);
      double-call → no double entries.
- [ ] Operator trip-cancel triggers refund-out for each paid booking (clawback the credit).
- [ ] Overpayment-difference refund path wired (from issue 032 overpay flag).
- [ ] Refund idempotency key is distinct from the inbound payment key.
- [ ] Stub PSP refund deterministic; integration test covers cancel→refund-out→ledger.

## Blocked by

- Blocked by `issues/050-balance-payout-state-machine.md`

## User stories addressed

- [S03] operator cancels my trip → refund (default); [S13] refund_out execution with own
  idempotency key.
