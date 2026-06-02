---
depends-on: [050-balance-payout-state-machine]
type: FEATURE
wave: 1
spec: [SYS07, S13, S08]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS07] / [S13] / [S08] (Ledger slice f)

## What to build

**Chargeback + payout_reversal** — handle a bank/PayPal dispute that can land AFTER payout.
Liability = operator (`payout_reversal` clawback); platform bad-debt backstop if the operator
balance is insufficient (S15#7).

- `recordChargeback(bookingId, amountMinor, sourceEventId)`: writes a `chargeback` entry +,
  if the related credit was already paid out, a `payout_reversal` entry clawing back against
  the operator balance.
- If operator available balance < clawback amount → record the shortfall as platform
  bad-debt (an `adjustment` entry or a flagged backstop entry — define + document the
  representation), per S15#7.
- Idempotent on `sourceEventId` (a dispute webhook can replay).
- Expose the dispute records for the admin Finance tab (Wave 3) — here just the ledger
  mechanics + a query; the UI is later.

## Acceptance criteria

- [ ] `chargeback` entry written; if post-payout, a `payout_reversal` clawback entry too.
- [ ] Insufficient operator balance → platform bad-debt backstop recorded (per S15#7),
      documented representation.
- [ ] Idempotent on `sourceEventId` (replayed dispute → no double clawback).
- [ ] Balance derivation (issue 050) correctly reflects post-chargeback state.
- [ ] Tests: pre-payout chargeback, post-payout reversal, insufficient-balance backstop.

## Blocked by

- Blocked by `issues/050-balance-payout-state-machine.md`

## User stories addressed

- [S08]/[S13] chargeback + payout_reversal; liability = operator, platform bad-debt
  backstop (S15#7).
