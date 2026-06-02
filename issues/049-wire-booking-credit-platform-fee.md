---
depends-on: [047-ledger-entry-model-immutability, 048-feeconfig-model]
type: FEATURE
wave: 1
spec: [SYS07, S13]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS07] / [S13] (Ledger slice c)

## What to build

Wire the two inbound ledger entries at credit time: `booking_credit` (operator's share) +
`platform_fee` (its own separate entry, rate from `FeeConfig` — never baked into the credit).
This replaces the `Payout.platformFee` baked-column approach.

- On booking paid (the point the credit becomes real per the money-state machine), write a
  `booking_credit` entry (net to operator) + a `platform_fee` entry, both keyed by a
  `sourceEventId` derived from the booking/payment event (idempotent — replay-safe).
- Fee = `gross * getEffectiveFeeRate(operatorId, paidAt)` computed in **BigInt minor units**
  (Mistake-Log Issue 016 — `(gross * feePpm) / 1_000_000` in BigInt domain, half-even, no
  float, no `n` suffix).
- Entries are PENDING (not available) until trip completion + T+1 (slice d wires the state
  derivation; here just write the entries with the right type/amount/refs).
- Keep `completeTripCore` / `processPayouts` working during transition — the legacy `Payout`
  rows can coexist; slice d migrates balance derivation to SUM(entries).

## Acceptance criteria

- [ ] On booking paid, exactly one `booking_credit` + one `platform_fee` entry written,
      idempotent on `sourceEventId` (replayed webhook → no duplicate entries).
- [ ] Fee computed in BigInt from the effective FeeConfig rate; matches the prior 6% output
      at cutover (regression check).
- [ ] Fee is a distinct entry, not folded into the credit amount.
- [ ] Entries reference `bookingId` + operator; amounts are signed minor units.
- [ ] Unit + integration tests for credit+fee on a paid booking.

## Blocked by

- Blocked by `issues/047-ledger-entry-model-immutability.md`,
  `issues/048-feeconfig-model.md`

## User stories addressed

- [S13] fee = own entry, rate from FeeConfig, at credit time; BigInt minor units.
