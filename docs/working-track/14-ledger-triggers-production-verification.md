# 14 -- Append-Only Ledger Triggers Production Verification

## Status: DONE

## What changed

Created production verification tooling for LedgerEntry append-only triggers.

### Existing coverage (already in place)

- **DB triggers**: `ledger_entry_no_update` + `ledger_entry_no_delete` BEFORE triggers
  on `LedgerEntry` table, created in migration `20260602020000_ledger_entry`
- **Trigger function**: `ledger_entry_immutable()` raises exception with TG_OP name
- **Integration tests**: `lib/ledger/__tests__/ledgerImmutability.int.test.ts` verifies:
  - UPDATE throws "append-only" exception
  - DELETE throws "append-only" exception
  - INSERT still works (append-only, not read-only)
  - Idempotent re-append returns existing row (no duplicate)
  - `deriveOperatorBalance()` sums signed amounts as BigInt
- **CI**: integration tests run in CI against migrated DB on every PR

### New: production verification script

- `scripts/verify/ledger-triggers.sh` — safe to run against production DB
- Checks 7 conditions via `pg_trigger` / `pg_proc` catalog queries:
  1. `ledger_entry_immutable()` function exists
  2. Both triggers attached to LedgerEntry table
  3. Both triggers enabled (tgenabled = 'O')
  4. Both triggers fire BEFORE (not AFTER)
- No data mutation — reads catalog only
- Usage: `DATABASE_URL="postgres://..." bash scripts/verify/ledger-triggers.sh`
- Exit code 0 = pass, 1 = fail

### Design notes

- Trigger-based immutability (not REVOKE) is role-independent — survives pooled-role
  rotations (Neon, PgBouncer, etc.)
- Triggers are SQL-only — invisible to Prisma DSL/migrate diff (same exception as
  partial indices Issue 007, CHECK constraints Issue 020)
- Functional mutation testing (actual UPDATE/DELETE on live rows) stays in integration
  tests only — the production script verifies trigger existence, not execution

## Files

- `scripts/verify/ledger-triggers.sh` — production verification script (new)
- `lib/ledger/__tests__/ledgerImmutability.int.test.ts` — existing integration tests (unchanged)
- `prisma/migrations/20260602020000_ledger_entry/migration.sql` — trigger definition (unchanged)

## GL-006 checklist

Satisfies: `- [x] Append-only ledger triggers active`
