# Backwards Compatibility Review: PR #125

| Field | Value |
|-------|-------|
| PR | [#125](https://github.com/PhamAnhQuannn/bus-booking-vn/pull/125) |
| Title | feat(booking): remove pickup area system, simplify to station/custom toggle |
| Branch | `feat/remove-pickup-areas` -> `master` |
| Head SHA | `08152368` |
| Stats | +196 / -3102, 83 files changed |
| Reviewed | 2026-06-23 |

## Verdict: PASS (no blocking findings)

All breaking changes are intentional, properly migrated, and every in-codebase consumer is updated in the same PR. No external API consumers exist (private app).

---

## 1. API Shape Breaks

### 1.1 Deleted Endpoints (INFO)

Six route files removed. All operator-internal or customer-facing pickup-area endpoints:

| Endpoint | File | Consumers updated |
|----------|------|-------------------|
| GET/POST `/api/op/pickup-areas` | `app/api/op/pickup-areas/route.ts` | Yes (PickupAreasClient deleted) |
| GET/PATCH `/api/op/pickup-areas/[id]` | `app/api/op/pickup-areas/[id]/route.ts` | Yes (PickupAreasClient deleted) |
| POST `/api/op/pickup-areas/[id]/deactivate` | `app/api/op/pickup-areas/[id]/deactivate/route.ts` | Yes (PickupAreasClient deleted) |
| GET/PUT `/api/op/routes/[id]/pickup-areas` | `app/api/op/routes/[id]/pickup-areas/route.ts` | Yes (RoutePickupAreaDialog deleted, RoutesClient updated) |
| GET/PATCH `/api/op/trips/[id]/pickup-areas` | `app/api/op/trips/[id]/pickup-areas/route.ts` | Yes (TripDetailClient updated) |
| GET `/api/trips/[id]/pickup-areas` | `app/api/trips/[id]/pickup-areas/route.ts` | Yes (CustomerForm updated) |

### 1.2 Changed Request Shapes (INFO)

- **POST `/api/holds`**: `pickupAreaId` field removed from Zod schema; `pickupKind` enum narrowed from `['station','point','custom']` to `['station','custom']`. Consumer (`holdsClient.ts`) updated.
- **POST `/api/op/trips`**: `pickupAreaIds` array field removed from `CreateTripSchema`. Consumer (`tripsClient.ts`) updated.
- **POST `/api/op/trip-templates`**: `pickupAreaIds` array field removed. Consumer (`tripsClient.ts`) updated.

### 1.3 Changed Response Shapes (INFO)

- **BookingDto**: `pickupAreaLabel: string | null` removed; `pickupKind` narrowed to `'station' | 'custom'`. All consumers (ReviewClient, DashboardClient, BookingDetailClient, StaffDashboardClient) updated.
- **HoldDetails**: `pickupAreaLabel: string | null` removed; `pickupKind` narrowed. Consumer (review page) updated.
- **ManifestRow**: `pickupAreaLabel: string | null` removed; `pickupKind` narrowed. Consumer (ManifestRefresh) updated.
- **BookingQueueRow**: `pickupAreaLabel` removed. Consumer (operatorBookingQueue integration test) updated.

### 1.4 Navigation (INFO)

- Settings hub link "Khu vuc don khach" (`/op/pickup-areas`) removed from `app/op/(console)/settings/page.tsx`. `MapPin` icon import removed.
- No orphaned nav links remain.

---

## 2. Schema Breaks

### 2.1 Dropped Tables (INFO)

Four tables dropped in correct FK dependency order:

1. `RoutePickupArea` (references OperatorPickupArea)
2. `TripPickupArea` (references OperatorPickupArea)
3. `TemplatePickupArea` (references OperatorPickupArea)
4. `OperatorPickupArea` (parent table, dropped last)

### 2.2 Dropped Columns (INFO)

| Table | Column | Handling |
|-------|--------|----------|
| Hold | `pickupAreaId` | FK constraint dropped first, then column |
| Hold | `pickupAreaLabel` | Data merged into `pickupDetail` before drop |
| Booking | `pickupAreaId` | FK constraint dropped first, then column |
| Booking | `pickupAreaLabel` | Data merged into `pickupDetail` before drop |

### 2.3 Enum Changes (INFO)

- **PickupKind**: `'point'` value removed. Done via create-new-enum/alter-columns/drop-old/rename pattern (safe for Postgres).
- **PickupPlaceKind**: Entire enum dropped (`DROP TYPE IF EXISTS`).

### 2.4 Migration Quality (PASS)

The migration (`20260622100000_remove_pickup_area_system`) follows correct ordering:

1. **Data preservation first**: Three-phase backfill of `point` -> `custom`:
   - Step 1a: Rows with both label AND detail get concatenated (`label - detail`)
   - Step 1b: Rows with only label get label copied to detail
   - Step 1c: Rows with neither get defensive placeholder `'Diem don cu (chuyen doi)'`
2. **CHECK constraint satisfied**: Short labels padded with `' (cu)'` to meet `>= 5 trimmed chars` CHECK
3. **`customPickupRequested` flag set**: Point rows get `customPickupRequested = true` before kind change
4. **Backfill before enum drop**: `pickupKind = 'custom'` written BEFORE enum is recreated without `'point'`
5. **FK before columns**: Constraints dropped before columns
6. **Columns before tables**: Hold/Booking columns dropped before area tables
7. **All destructive DDL uses IF EXISTS**: Migration is retry-safe

No issues with migration ordering or data safety.

---

## 3. Shared-lib Signature Breaks

### 3.1 Removed Barrel Exports (INFO)

**`lib/catalog/index.ts`** -- 11 exports removed:
- `createOperatorPickupArea`, `updateOperatorPickupArea`, `deactivateOperatorPickupArea`
- `listOperatorPickupAreas`, `listRoutePickupAreas`, `setRoutePickupAreas`
- `pickupPlaceKindToPickupKind`
- `PickupAreaServiceError`, `RoutePickupAreaServiceError`, `OperatorPickupAreaDto`
- (All backing source files deleted; no remaining importers)

**`lib/trips/index.ts`** -- 2 exports removed:
- `setTripPickupAreas`, `TripPickupAreaItem`
- (Backing files deleted; no remaining importers)

**`lib/api/index.ts`** -- 8 exports removed:
- `listPickupAreasApi`, `createPickupAreaApi`, `updatePickupAreaApi`, `deactivatePickupAreaApi`
- `getRoutePickupAreasApi`, `setRoutePickupAreasApi`, `setTripPickupAreasApi`
- `type PickupAreaItem`
- (Backing file `pickupAreasClient.ts` deleted; no remaining importers)

### 3.2 Function Signature Changes (INFO)

**`validatePickupSelection`** (`lib/booking/pickupSelection.ts`):
- Before: `validatePickupSelection(tripAreaIds: readonly string[], sel: PickupSelection): PickupCheck`
- After: `validatePickupSelection(sel: PickupSelection): PickupCheck`
- First parameter removed (no longer needed without pickup areas)
- Return type union simplified: `'point'` variant removed, `areaId`/`pickupAreaId` fields removed
- All call sites updated: `CustomerForm.tsx`, `app/api/holds/route.ts`, `pickupSelection.test.ts`

### 3.3 Removed Error Code (INFO)

**`lib/trips/errors.ts`**: `'invalid_pickup_area'` removed from `TripErrorCode` union. No remaining throw sites.

### 3.4 Deleted Validation Module (INFO)

**`lib/core/validation/pickupArea.ts`**: Entire file deleted. Contained `operatorPickupAreaCreateSchema`, `operatorPickupAreaUpdateSchema`, and associated input types. No remaining importers.

---

## 4. New Dependency Licenses

**N/A** -- No dependencies added or removed. `package.json` and `pnpm-lock.yaml` are unchanged in this PR.

---

## 5. Typosquat / Post-install Risk

**N/A** -- No new dependencies.

---

## 6. Lockfile Drift

**N/A** -- No `package.json` or `pnpm-lock.yaml` changes in this PR. No drift possible.

---

## Additional Observations

### E2E Test Coverage

No e2e test files (`e2e/**`) reference any pickup area endpoints, types, or fields. The pickup area system was UI-tested via integration and unit tests only, all of which are properly updated or deleted in this PR.

### Seed File

`prisma/seed.ts` properly removes `seedOperatorAreas()` call and `areasByOperator` variable. No orphaned seed logic.

### Documentation Guide Renames (Unrelated)

11 documentation guides renamed with numeric prefixes (e.g., `setup-github.md` -> `01-setup-github.md`). Content-only renames, no backwards compatibility impact.

---

## Summary Table

| Category | Findings | Blocking | Verdict |
|----------|----------|----------|---------|
| API shape breaks | 6 endpoints deleted, 3 request shapes narrowed, 4 response shapes narrowed | 0 | PASS |
| Schema breaks | 4 tables dropped, 4 columns dropped, 2 enum changes, migration well-ordered | 0 | PASS |
| Shared-lib signatures | 21 barrel exports removed, 1 function signature changed, 1 error code removed | 0 | PASS |
| New dep licenses | None | 0 | PASS |
| Typosquat risk | None | 0 | PASS |
| Lockfile drift | None | 0 | PASS |
