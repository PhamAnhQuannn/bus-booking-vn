---
depends-on: [038-scaffold-lib-core-tenant-helper-lint]
type: FEATURE
wave: 1
spec: [SYS07, S13, SYS13]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS07] / [S13] (Ledger slice a)

## What to build

The **append-only double-entry `LedgerEntry`** — the money one-way door. Today money is
tracked as mutable per-trip `Payout` rows (no ledger). This slice is the model + DB-enforced
immutability ONLY; wiring entries is later slices.

- `model LedgerEntry(id, operatorId, bookingId?, payoutId?, type, amount BigInt-as-minor-units,
  currency='VND', sourceEventId, createdAt)`. `type` enum = `booking_credit | platform_fee |
  refund_debit | refund_out | payout_debit | payout_reversal | chargeback | adjustment` (all
  8 from [S01]). `sourceEventId` unique per (type, source) for idempotency.
- `@@index([operatorId])`, `@@index([bookingId])`, `@@index([payoutId])`; FK + tenant column.
- **DB-enforced immutability** (S13/SYS13): a migration that `REVOKE UPDATE, DELETE ON
  "LedgerEntry" FROM <app_role>` (or a `BEFORE UPDATE/DELETE` trigger that RAISEs). Append-
  only is enforced by the DB, not convention. Document the app DB role assumption.
- Amount stored as integer minor units; the repo enforces BigInt math (no float) per S13 /
  Mistake-Log Issue 016 (`BigInt()` ctor, no `n` suffix — ES2017 target).
- Balance derivation helper stub (`SUM(entries)` grouped by state) — full balance/payout
  rename is slice (d) issue 050.
- Home: `lib/ledger` (per SYS20; `lib/payouts` folds in over later slices).

## Acceptance criteria

- [ ] `LedgerEntry` model with all 8 entry types + signed minor-unit amount + sourceEventId
      (migration schema.prisma + SQL).
- [ ] Immutability enforced at DB level (REVOKE or trigger) — an UPDATE/DELETE on a ledger
      row fails; verified by an integration test that expects the DB error.
- [ ] Idempotent insert on `sourceEventId` (duplicate source → no second entry).
- [ ] BigInt minor-unit math in the repo (no float; no `n` literal).
- [ ] Indexes + tenant column present.

## Blocked by

- Blocked by `issues/038-scaffold-lib-core-tenant-helper-lint.md`

## User stories addressed

- [S13] append-only double-entry ledger; DB-enforced immutability; 8 entry types.
