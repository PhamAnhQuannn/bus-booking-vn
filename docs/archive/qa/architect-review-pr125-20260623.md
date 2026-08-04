# Architectural Review: PR #125 -- Remove Pickup Area System

**Date:** 2026-06-23
**PR:** #125 (commits `57ae7d5`, `0815236`)
**Scope:** Remove 4 DB tables, 2 enums, CRUD API routes, operator UI pages, lib domain modules. Simplify customer booking pickup to station/custom toggle.
**Net:** ~3,100 lines deleted, ~200 lines added across 83 files.

---

## 1. Module Dependency Graph

### 1a. Dangling References

**Status: CLEAN**

Grep sweep across `app/`, `lib/`, `components/`, `e2e/` for all deleted module names, Prisma model names, removed API route paths, and removed enum/type names. Zero functional references remain.

One historical comment in `e2e/op-routes.spec.ts:215` mentions `OperatorPickupArea` in a past-tense note about the prior Issue 104 removal of PickupPoint. This is documentation, not a functional reference -- no action needed.

### 1b. Import Cycles

**Status: CLEAN**

- `lib/core/` does not import from any non-core domain.
- No `lib/<domain>/` imports from `app/` or `components/` (no reverse deps).
- No `'use client'` files barrel-import `@/lib/auth` (the Issue 092b rule holds).
- Cross-domain imports (e.g., `lib/booking/` -> `@/lib/payment`) go through barrels as required.

### 1c. Barrel Exports

**Status: CLEAN**

- `lib/catalog/index.ts` -- 12 lines of pickup-area re-exports removed. Remaining 17 exports are route/template/bus catalog functions.
- `lib/trips/index.ts` -- 3 lines removed (`setTripPickupAreas`, `snapshotPickupAreas`). Remaining 17 exports are trip CRUD/lifecycle.
- `lib/api/index.ts` -- 10 lines removed (`pickupAreasClient` and related). Remaining 40 exports are operator/customer API clients.

No orphan exports. No barrel references to deleted modules.

---

## 2. Coupling Spread

**Status: IMPROVED (removal PR)**

The pickup area system had cross-domain coupling across 5 domains:
- `lib/catalog/` (7 modules, 3 test files) -- DELETED
- `lib/trips/` (2 modules) -- DELETED
- `lib/core/validation/` (1 schema) -- DELETED
- `lib/api/` (1 client) -- DELETED
- `lib/booking/` (pickup selection) -- SIMPLIFIED

All coupling edges to the deleted modules are gone. The remaining `lib/booking/pickupSelection.ts` is a pure validator (`validatePickupSelection`) with no cross-domain imports -- it validates `{ pickupKind: 'station'|'custom', pickupDetail?: string }` and returns a discriminated result. This is simpler than the previous multi-table join path.

---

## 3. Schema and Migration

### 3a. Migration Quality

**Status: SOUND**

The migration (`20260622100000_remove_pickup_area_system/migration.sql`, 102 lines) handles:

1. **Data preservation** (Steps 1a-1c): `point` -> `custom` backfill with label concatenation, fallback for NULL detail, and short-string padding to satisfy the existing CHECK constraint (`pickupDetail >= 5 trimmed chars when customPickupRequested`). Defensive -- covers edge cases.
2. **FK cleanup** (Step 3): Drops FK constraints on Hold and Booking before dropping columns.
3. **Column removal** (Step 4): Drops `pickupAreaId` and `pickupAreaLabel` from Hold and Booking.
4. **Table drops** (Step 5): Correct FK-dependency order -- child tables (`RoutePickupArea`, `TripPickupArea`, `TemplatePickupArea`) before parent (`OperatorPickupArea`).
5. **Enum swap** (Steps 6-7): Standard Prisma pattern -- create new enum, alter columns, drop old, rename. Also drops `PickupPlaceKind` enum (no longer referenced).

No issues found. Indexes on dropped tables are implicitly dropped by PostgreSQL.

### 3b. Schema Parity

**Status: CLEAN**

- `prisma/schema.prisma` contains zero references to removed models or enums.
- `PickupKind` enum correctly reduced to `('station', 'custom')`.
- Hold and Booking models retain `pickupKind`, `pickupDetail`, `customPickupRequested` -- these are the simplified fields.
- No dangling relation fields on Operator, Route, Trip, or Booking.

---

## 4. ADR Coverage

**Status: NO NEW ADR NEEDED**

This PR removes architectural complexity rather than adding it. No new frameworks, libraries, or patterns were introduced. The station/custom toggle is a simplification of an existing pattern, not a new architectural decision.

However, see Advisory A1 below regarding documentation drift.

---

## 5. Domain Isolation Invariants

| Invariant | Status | Notes |
|-----------|--------|-------|
| `app/` -> `lib/<domain>/` -> `lib/core/` flow | HOLDS | No reverse deps detected |
| Cross-domain imports through barrels only | HOLDS | Barrels cleaned of removed exports |
| `'use client'` deep-import rule (Issue 092b) | HOLDS | No barrel imports in client files |
| No schema DDL in app code | HOLDS | Migration is in `prisma/migrations/` |
| Payment crypto in webhooks only | N/A | No payment changes in this PR |
| No new cycles | HOLDS | `pnpm lint` passes (0 errors) |

---

## 6. Build Verification

| Check | Result |
|-------|--------|
| `pnpm tsc --noEmit` | PASS (0 errors) |
| `pnpm lint` | PASS (0 errors, 45 pre-existing warnings unrelated to PR) |
| New dependencies added | NONE |
| Deleted file still imported | NONE found |

---

## Advisories

### A1 (Low): Documentation Drift -- 35 Spec Files Reference Removed System

35 documentation files under `documentation/` still reference "pickup area", "PickupArea", or the removed system. These span:

- Data model spec (DS-001)
- API contract spec (DS-003)
- Feature implementation specs (FI-002 through FI-013)
- Frontend design specs (FD-003, FD-014, FD-016, FD-022)
- Architecture decisions (ADR-004, ADR-011)
- Domain model docs (bounded-contexts, ubiquitous-language, event-flows)
- Current-status audit files (00 through 25)

**Impact:** Low. These are design-time reference docs, not runtime code. The codebase is correct. However, any future contributor reading the specs will encounter references to a system that no longer exists.

**Recommendation:** A follow-up documentation sweep (not blocking merge) to update or annotate these 35 files. Could be as simple as adding a note at the top of each: "Note: The pickup area system was removed in PR #125. References below are historical."

### A2 (Info): Historical Comment in E2E Spec

`e2e/op-routes.spec.ts:214-215` contains a past-tense comment about `OperatorPickupArea`. This is accurate historical context (Issue 104 replaced PickupPoint with OperatorPickupArea; PR #125 now removes OperatorPickupArea). No action needed, but could be updated for completeness in the doc sweep above.

### A3 (Info): Seed Data Simplification

`prisma/seed.ts` had 86 lines removed (pickup area seed data). The remaining seed data correctly creates trips and bookings without pickup area references. The `pickupKind: 'station'` default in the schema means existing seed rows that don't specify pickup kind will default correctly.

---

## Verdict

**PASS** -- Clean removal. No dangling references, no broken imports, no cycle regressions, no layer violations. Migration handles data preservation correctly. The only follow-up is a non-blocking documentation sweep (A1).
