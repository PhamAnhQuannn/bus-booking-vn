---
depends-on: [049-wire-booking-credit-platform-fee, 037-settlement-delay-t1]
type: FEATURE
wave: 1
spec: [SYS07, S13, S08]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS07] / [S13] / [S08] (Ledger slice d)

## What to build

Derive operator **balance = SUM(entries)** in 3 states (pending / available / paid-out) and
align the payout state machine. Today there's no balance and `PayoutStatus` is
`pending|processing|settled|failed` (spec wants `requested→processing→paid|failed`).

- Balance helper: `pending` = credits whose trip hasn't completed + T+1 yet; `available` =
  completed + T+1 elapsed, not yet paid out; `paid-out` = covered by a `payout_debit` entry.
  All derived from `LedgerEntry` SUMs (never a stored mutable column).
- Money becomes AVAILABLE at trip completion + **T+1** (issue 037 already set the constant);
  this slice reads that timing for the pending→available derivation.
- Payout state machine rename to spec: `requested → processing → paid | failed`. Migrate
  `PayoutStatus` enum + existing rows (`settled`→`paid`; auto-created `pending` semantics
  reconciled). The auto T+N sweep (`processPayouts`) now creates a `payout_debit` ledger
  entry + transitions state; idempotent (FOR UPDATE SKIP LOCKED already present).
- Add `minWithdrawThreshold` config (used by on-demand withdraw, slice g/issue 053).

## Acceptance criteria

- [ ] Balance helper returns pending/available/paid-out from SUM(LedgerEntry), no mutable
      balance column.
- [ ] Available reflects trip completion + T+1; pending before.
- [ ] `PayoutStatus` = `requested|processing|paid|failed`; existing rows migrated.
- [ ] Auto-payout writes a `payout_debit` entry + transitions state; idempotent (no double).
- [ ] Min-withdraw threshold configured + readable.
- [ ] Tests: balance across pending/available/paid-out; payout idempotency.

## Blocked by

- Blocked by `issues/049-wire-booking-credit-platform-fee.md`,
  `issues/037-settlement-delay-t1.md`

## User stories addressed

- [S08] balance (pending/available/paid-out) = SUM(entries); payout requested→processing→
  paid|failed.
