---
depends-on: [050-balance-payout-state-machine]
type: FEATURE
wave: 1
spec: [SYS07, S13, S08, S15-1]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS07] / [S13] / [S08] (Ledger slice g)

## What to build

**On-demand withdrawal** of available balance (S15#1 default = both auto T+N AND on-demand
above a min threshold). Today payout is auto-only (T+N cron); no withdraw route.

- `requestWithdrawal(operatorId, amountMinor, idempotencyKey)`: inside `$transaction` with
  `SELECT … FOR UPDATE` on the operator balance gating row, re-check `available >= amount`
  (recomputed from ledger SUM under the lock — no TOCTOU), enforce `>= minWithdrawThreshold`,
  then create a payout (`requested` state) + a `payout_debit` ledger entry. Idempotent on the
  key (double-click → one withdrawal).
- The withdrawal then flows through the same payout state machine (requested→processing→
  paid|failed) as the auto sweep.
- Route: operator-scoped withdraw endpoint under `app/api/op/**` (tenant-checked,
  CSRF-protected per SYS14). UI (Money page Withdraw button) is Wave 5.

## Acceptance criteria

- [ ] Withdraw runs in `$transaction` + `FOR UPDATE`; concurrent double-withdraw → exactly
      one succeeds (integration test).
- [ ] Re-checks `available >= amount` under the lock; rejects over-withdraw + below-min.
- [ ] Idempotent on the withdrawal key (double-submit → single payout).
- [ ] Writes `payout_debit` entry; balance (issue 050) reflects it.
- [ ] Withdraw route tenant-scoped + CSRF-protected.

## Blocked by

- Blocked by `issues/050-balance-payout-state-machine.md`

## User stories addressed

- [S08] withdraw available balance (auto T+N and/or on-demand); [S13] withdrawal tx +
  FOR UPDATE + idempotent + min threshold.
