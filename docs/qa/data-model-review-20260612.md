# Data Model Design Review — Bus-Booking

**Date:** 2026-06-12 | **Schema:** prisma/schema.prisma (1125 lines, 35 models, 12 enums)

## Top Findings (by priority)

### P0 — Financial Data Integrity
1. **No CHECK constraints on monetary fields** — `Trip.price`, `Booking.totalVnd`, `Payout.gross/net/platformFee`, `FeeConfig.ratePpm` all accept 0 or negative values at DB level. Add `CHECK (price > 0)` etc.
2. **Payout net ≠ gross - platformFee not enforced** — `net` is denormalized from `gross - platformFee` but no CHECK validates the invariant. Add `CHECK (net = gross - platformFee)`.

### P1 — Structural Issues
3. **Soft-delete naming inconsistent** — 5 different patterns: `deletedAt` (Customer), `deactivatedAt` (Bus/Route), `disabledAt` (Operator/OperatorUser), `moderatedAt` (Route/Trip), `suspendedAt` (Customer). Standardize naming.
4. **Trip missing `createdAt`** — Has `updatedAt` but no `createdAt`. Audit trail gap for trip creation.
5. **Status↔timestamp consistency not DB-enforced** — Trip.cancelledAt without status='cancelled', Booking.noShowAt without status='no_show', etc. Add CHECK constraints for each status↔timestamp pair.
6. **7 string-union columns without CHECK constraints** — ContentReport.targetType, RecurringGenerationLog.status, KybDocument.type, StoredObject.purpose, NotificationLog.template, AdminAuditLog.action/target. All allow invalid values.

### P2 — Performance
7. **Trip.busId FK not indexed** — "All trips for bus X" requires full table scan.
8. **CharterRequest missing customerId + publishedAt indexes** — Customer charter history and admin published-charter queries are unindexed.
9. **No partial indexes for soft-delete** — Active buses/routes/templates queries scan deactivated rows. Add `WHERE deactivatedAt IS NULL` partial indexes.
10. **Booking missing `(customerId, createdAt DESC)` composite** — Customer booking history page can't use covering index.

### P3 — Denormalization Risks
11. **Trip.operatorId denormalized from Route** — No trigger/CHECK prevents drift if route reassignment ever happens.
12. **Operator.disabledAt redundant with status enum** — Both track freeze state; app-level sync can drift.
13. **FeeConfig effective-date ranges can overlap** — No CHECK prevents two active rates for same operator at same time.

## Schema Strengths
- **PK strategy**: CUIDs throughout (no sequential enumeration risk)
- **Immutability triggers**: LedgerEntry, AdminAuditLog, ConsentRecord all have BEFORE UPDATE/DELETE triggers
- **Partial unique indexes**: Trip (recurringTemplateId + departureAt), OtpAttempt (phone + active) — correctly SQL-only
- **BigInt for money**: LedgerEntry.amount is BigInt (no float drift)
- **Effective-dated FeeConfig**: New row per rate change, not UPDATE-in-place
- **Comprehensive FK graph**: All relations have explicit or implicit ON DELETE behavior

## Model Count by Domain

| Domain | Models | Notes |
|--------|--------|-------|
| Auth | 8 | Customer, OperatorUser, AdminUser, Session×3, OtpAttempt×2 |
| Booking | 4 | Booking, Hold, ConsentRecord, PaymentEvent |
| Catalog | 7 | Operator, Bus, BusMaintenance, Route, Place, OperatorPickupArea, RoutePickupArea |
| Trip | 4 | Trip, RecurringTripTemplate, RecurringGenerationLog, TripPickupArea, TemplatePickupArea |
| Financial | 4 | LedgerEntry, Payout, FeeConfig, PayoutAccount |
| Operations | 6 | NotificationLog, JobRunLog, AdminAuditLog, ContentReport, StoredObject, KybDocument |
| Analytics | 2 | FunnelEvent, FeatureFlag |
| Charter | 1 | CharterRequest |
