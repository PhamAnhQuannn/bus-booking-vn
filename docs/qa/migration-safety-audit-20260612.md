# Migration Safety Audit — Bus-Booking

**Date:** 2026-06-12 | **Total Migrations:** 61 | **Verdict:** GO-WITH-CAUTION (pre-production)

## Summary

| Risk Band | Count | Details |
|-----------|-------|---------|
| BLOCKING | 2 | DROP TABLE PickupPoint, DROP COLUMN + enum recreations |
| CAUTION | 14 | Column renames, backfill UPDATEs, enum renames, FK re-binding |
| SAFE | 45 | CREATE TABLE, ADD COLUMN nullable, ADD INDEX, triggers |

**All migrations already applied to dev DB.** No pending unapplied migrations. This audit is a pre-production safety review.

## Critical Findings

### P0 — FK Delete Behavior Drift on Financial Tables

**Migration:** `20260612063249_add_temp_password_plain`

This migration silently changed `ON DELETE RESTRICT → ON DELETE SET NULL` for 3 financial FKs:

| FK | Table | Column | Before | After | Risk |
|----|-------|--------|--------|-------|------|
| `LedgerEntry_bookingId_fkey` | LedgerEntry | bookingId | RESTRICT | **SET NULL** | Booking delete orphans ledger entries |
| `Payout_tripId_fkey` | Payout | tripId | RESTRICT | **SET NULL** | Trip delete orphans payouts |
| `FeeConfig_operatorId_fkey` | FeeConfig | operatorId | RESTRICT | **SET NULL** | Operator delete orphans fee configs |

**Impact:** If any application code or admin action deletes a Booking/Trip/Operator, the related financial records silently lose their FK reference instead of blocking the delete. This violates the ledger's I7 causality invariant (every entry traces to a business event).

**Recommendation:** Author a new migration to revert these 3 FKs to `ON DELETE RESTRICT`. The `tempPasswordPlain` column addition is fine; the FK drift was bundled incorrectly.

```sql
-- Proposed fix migration: 20260613_revert_financial_fk_restrict
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_bookingId_fkey";
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payout" DROP CONSTRAINT "Payout_tripId_fkey";
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeeConfig" DROP CONSTRAINT "FeeConfig_operatorId_fkey";
ALTER TABLE "FeeConfig" ADD CONSTRAINT "FeeConfig_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### P1 — No Reverse Migrations (3 of 61 have down.sql)

Only `booking_v1`, `issue_004_payment_event`, and `issue_007_auth` have down.sql files. The remaining 58 migrations have no rollback path.

**Acceptable pre-production** (no live data). **Must change before go-live** — every migration touching existing tables should ship with a tested down.sql.

### P1 — No CI Rollback Testing

CI runs `prisma migrate deploy` forward only. No test validates that migrations can be reversed or that schema matches expectations after rollback.

### P1 — No Vercel Migration Hook

`vercel.json` has no build hook for `prisma migrate deploy`. Migrations must be run manually before each deploy. Risk of deploy/schema mismatch.

## BLOCKING Migrations (Already Applied)

### `20260603040000_drop_cash_residue`
- Drops `Booking.cashCollectedAt` column
- Recreates `PaymentMethod` and `BookingStatus` enums (rename-create-drop dance)
- Includes pre-check: `DO $$ ... IF EXISTS cashCollectedAt IS NOT NULL ... RAISE EXCEPTION $$`
- **Irreversible** — dropped column data gone

### `20260608000000_pickup_areas`
- Drops entire `PickupPoint` table
- Drops `Booking.pickupNote` and `Booking.pickupPointId` columns
- Creates new `OperatorPickupArea`, `TripPickupArea`, `TemplatePickupArea` tables
- **Irreversible** — legacy table data gone (acceptable pre-production, no real bookings)

## CAUTION Migrations (Already Applied)

| Migration | Operations | Safeguard |
|-----------|-----------|-----------|
| `20260519012518_issue_012` | UPDATE backfill operatorId on Route | fail-fast DO block |
| `20260519043000_issue_011` | RENAME plateNumber→licensePlate; UPDATE backfill busType | fail-fast DO block |
| `20260519060001_issue_013` | UPDATE backfill operatorId on Trip | fail-fast DO block |
| `20260601000000_canonical_payment_event` | RENAME externalRef→providerTxnId; DROP resultCode | no safeguard |
| `20260602010000_operator_status` | UPDATE CASE-based status backfill | conditional logic |
| `20260602040000_payout_status_rename` | RENAME enum values pending→requested, settled→paid | O(1) in PG12+ |
| `20260606010000_username` | UPDATE backfill username='op-'||id | guaranteed unique |
| `20260609010000_pickup_kind_rename` | RENAME enum value area→point | O(1) |
| `20260609020000_pickup_kind_backfill` | UPDATE with ILIKE heuristic | idempotent |
| `20260609040000_pickup_custom_check` | ADD CHECK constraint | no data modification |
| `20260612063249_add_temp_password_plain` | ADD column + **FK re-binding** (see P0 above) | N/A |

## Immutable Table Protection

Three tables have DB-level immutability triggers preventing UPDATE/DELETE:

| Table | Trigger | Migration |
|-------|---------|-----------|
| LedgerEntry | `ledger_entry_no_update`, `ledger_entry_no_delete` | `20260602020000` |
| AdminAuditLog | `admin_audit_log_no_update`, `admin_audit_log_no_delete` | `20260602110000` |
| ConsentRecord | `consent_record_no_update` | `20260602220000` |

No migration modifies LedgerEntry after creation — correct.

## Rollback Strategy

| Scenario | Strategy | Documented? |
|----------|----------|-------------|
| Bad migration on dev | Drop schema + re-migrate + re-seed | Yes (docs/ops/rollback-pr7.md) |
| Bad migration pre-prod | Forward-fix migration | Implicit |
| Bad migration on prod | **No strategy** | **No** — must author before go-live |
| Enum rollback (ADD VALUE) | Rename-recreate dance | Yes (docs/runbook-issue-016-rollback.md) |
| Hold system rollback | Sweeper mode + blocked-seats rebuild | Yes (docs/runbook-hold-rollback.md) |

## Pre-Production Checklist

- [ ] **Fix P0:** Author migration to revert financial FK delete behavior to RESTRICT
- [ ] **Document:** Backup/restore procedure for production PostgreSQL
- [ ] **CI:** Add `prisma migrate diff` check to CI (schema↔DB parity)
- [ ] **Vercel:** Add build hook or `postbuild` script for `prisma migrate deploy`
- [ ] **Policy:** Require down.sql for every migration touching existing tables post-go-live
