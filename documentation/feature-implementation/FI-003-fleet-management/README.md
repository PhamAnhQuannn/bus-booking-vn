# FI-003: Fleet Management (Quan ly doi xe)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-004, ADR-009, DS-001, DS-003, FD-022

## Overview

FI-003 covers the operator-facing tools for managing the physical supply side of the platform: buses (vehicles), their maintenance windows, and pickup areas (named boarding/drop-off points). It is the foundation that [FI-004](../FI-004-route-management/README.md) (Route Management) and [FI-005](../FI-005-trip-management/README.md) (Trip Management) depend on -- a Trip cannot exist without a Bus, and both Route and Trip reference OperatorPickupArea records for boarding logistics. The Fleet/Catalog bounded context owns all these entities and enforces the multi-tenant isolation guarantee via `operatorId` FK on every operator-scoped table.

## Scope & Boundaries

### In Scope

- CRUD for `Bus` records (licensePlate, capacity, busType, deactivatedAt, maintenance windows)
- CRUD for `BusMaintenance` records (structured maintenance window history)
- CRUD for `OperatorPickupArea` records (named station and door-to-door pickup points, GSO province/district/ward codes)
- Soft-deactivation of buses
- Capacity-reduction guard enforced at edit time
- Bus-deactivation guard (blocked if future trips assigned)
- Maintenance window overlap detection (prevents trip scheduling during maintenance)

### Out of Scope

- Route definition -> [FI-004](../FI-004-route-management/README.md)
- Trip scheduling -> [FI-005](../FI-005-trip-management/README.md)
- Operator onboarding (KYB, business license) -> [FI-002](../FI-002-operator-onboarding/README.md)
- Customer-facing search -> [FI-006](../FI-006-search-discovery/README.md)
- Staff assignment to trips -> [FI-005](../FI-005-trip-management/README.md) (`StaffTripAssignment`)

### Bounded Context(s)

**Fleet/Catalog Context** (Section 2 of bounded-contexts.md) -- owns Bus, BusMaintenance, OperatorPickupArea, and the pickup area join tables (RoutePickupArea, TripPickupArea, TemplatePickupArea).

**Dependencies:**
- [FI-004](../FI-004-route-management/README.md) (Routes) reads `Bus.capacity` and `Bus.busType` for route-level defaults
- [FI-005](../FI-005-trip-management/README.md) (Trips) requires Bus records to exist; enforces bus-overlap guard and maintenance-overlap guard against Bus state
- `OperatorPickupArea` records created here are linked to Routes (via `RoutePickupArea`) and Trips (via `TripPickupArea`) in FI-004 and FI-005

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Bus | `id` (CUID PK), `operatorId` (FK->Operator, NOT NULL), `capacity` (Int, NOT NULL), `licensePlate` (String, NOT NULL), `busType` (BusType enum: coach/sleeper/limousine, NOT NULL), `deactivatedAt` (DateTime, nullable), `maintenanceStart` (DateTime, nullable), `maintenanceEnd` (DateTime, nullable) | `@@unique([operatorId, licensePlate])` -- plate unique per operator; partial SQL-only index `Bus_operatorId_active_idx` on `(operatorId) WHERE deactivatedAt IS NULL` | Tenant-scoped via `operatorId`. Both `maintenanceStart`/`maintenanceEnd` on the Bus row are supplemented by the `BusMaintenance` join table for historical records. `deactivatedAt` is a soft-delete (never physically deleted). |
| BusMaintenance | `id` (CUID PK), `busId` (FK->Bus, onDelete: Cascade, NOT NULL), `startAt` (DateTime, NOT NULL), `endAt` (DateTime, NOT NULL), `reason` (String, nullable), `createdAt` (DateTime, `@default(now())`) | `@@index([busId])` | Structured maintenance window history. `busId` CASCADE means all maintenance records are deleted when a Bus is deleted (not deactivated -- deactivation soft-disables the bus). |
| OperatorPickupArea | `id` (CUID PK), `operatorId` (FK->Operator, onDelete: Cascade, NOT NULL), `provinceCode` (String, NOT NULL), `districtCode` (String, NOT NULL), `districtName` (String, NOT NULL), `wardCode` (String, NOT NULL), `wardName` (String, NOT NULL), `name` (String, NOT NULL), `addressLine` (String, nullable), `label` (String, NOT NULL, denormalized "Phuong X, Quan Y, Tinh Z"), `kind` (PickupPlaceKind enum: station/pickup, `@default(station)`), `isActive` (Boolean, NOT NULL, `@default(true)`), `displayOrder` (Int, NOT NULL), `createdAt`, `updatedAt` | `@@index([operatorId, isActive])` | Tenant-scoped via `operatorId` (onDelete: Cascade). Deactivate via `isActive = false`, never delete. `label` is denormalized for display. `kind` maps: `station` = Ben xe terminal; `pickup` = Don tan noi. |
| RoutePickupArea | `id` (CUID PK), `routeId` (FK->Route, onDelete: Cascade), `operatorPickupAreaId` (FK->OperatorPickupArea, onDelete: Cascade), `displayOrder` (Int) | `@@unique([routeId, operatorPickupAreaId])`, `@@index([routeId, displayOrder])` | Live link (NOT a snapshot) -- label/kind read from OperatorPickupArea at query time. TripPickupArea snapshots them at trip-create time (immutable after creation). |
| TripPickupArea | `id` (CUID PK), `tripId` (FK->Trip, onDelete: Cascade), `operatorPickupAreaId` (FK->OperatorPickupArea, onDelete: Cascade), `label` (String, NOT NULL, snapshot), `kind` (PickupPlaceKind, snapshot), `displayOrder` (Int) | `@@unique([tripId, operatorPickupAreaId])`, `@@index([tripId, displayOrder])` | Snapshot taken at trip creation -- survives menu edits. |
| TemplatePickupArea | `id` (CUID PK), `recurringTemplateId` (FK->RecurringTripTemplate, onDelete: Cascade), `operatorPickupAreaId` (FK->OperatorPickupArea, onDelete: Cascade), `label` (String, snapshot), `kind` (PickupPlaceKind, snapshot), `displayOrder` (Int) | `@@unique([recurringTemplateId, operatorPickupAreaId])`, `@@index([recurringTemplateId, displayOrder])` | Same snapshot pattern as TripPickupArea, for templates. |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/op/buses` | Operator JWT | Create a new bus. Body: `{ licensePlate, capacity, busType }` | 201, 422 `PLATE_IN_USE` |
| PATCH | `/api/op/buses/:id` | Operator JWT | Update bus properties. Capacity reduction blocked if active bookings exceed new capacity | 200, 422 `CAPACITY_REDUCTION_BLOCKED`, 404 |
| POST | `/api/op/buses/:id/deactivate` | Operator JWT | Soft-deactivate bus. Blocked if future trips assigned | 200, 422 `FUTURE_TRIPS_ASSIGNED`, 404 |
| PATCH | `/api/op/buses/:id/maintenance` | Operator JWT | Set maintenance window (`maintenanceStart`, `maintenanceEnd`). Overlap with scheduled trips returns 409 | 200, 409 `MAINTENANCE_OVERLAP`, 404 |
| POST | `/api/op/pickup-areas` | Operator JWT | Create named pickup/station point. Body: `{ provinceCode, districtCode, wardCode, name, kind, displayOrder }` | 201, 400 `VALIDATION_ERROR` |
| PATCH | `/api/op/pickup-areas/:id` | Operator JWT | Update pickup area. Deactivate via `isActive = false` (never delete) | 200, 404 |

## State Machine

This feature does not have a dedicated state machine. Bus has two soft-state fields:

- `deactivatedAt`: null = active, non-null = deactivated (soft-delete)
- `maintenanceStart`/`maintenanceEnd`: null = no maintenance window, non-null = window defined

OperatorPickupArea has `isActive` boolean (not a state machine).

## Business Rules & Invariants

1. **Capacity Reduction Guard** -- When editing a bus's `capacity` field, the new value must be >= the count of paid bookings on that bus's upcoming trips. Enforced at `PATCH /api/op/buses/:id` via `Booking.aggregate(...)` inside `$transaction` with `SELECT FOR UPDATE` on the Bus row (TOCTOU protection per Mistake Log Issue 011). Returns 422 `CAPACITY_REDUCTION_BLOCKED`. UI shows inline warning below capacity field with exact count; Save button disabled until resolved.

2. **Future Trips Deactivation Guard** -- A bus cannot be deactivated if it has future scheduled (non-cancelled) trips assigned. Enforced at `POST /api/op/buses/:id/deactivate` via `Trip.count(WHERE busId AND departureAt > NOW() AND status != 'cancelled')`. Returns 422 `FUTURE_TRIPS_ASSIGNED`. UI shows inline error with count of blocking trips and guidance to cancel or reassign.

3. **Maintenance Window Overlap -- Trip Creation** -- `maintenanceStart <= tripDepartureAt < maintenanceEnd` blocks trip creation. Enforced in `lib/trips/createTrip.ts` and `lib/trips/reassignBus.ts` inside `$transaction` with `SELECT FOR UPDATE` on Bus. Returns 409 `MAINTENANCE_OVERLAP`.

4. **Maintenance Window Overlap -- Search** -- Trips overlapping `[maintenanceStart, maintenanceEnd]` are excluded from search using window-vs-window overlap: `maintenanceStart IS NULL OR maintenanceEnd < startUtc OR maintenanceStart > endUtc`. Enforced in `lib/trips/searchTrips.ts` (Mistake Log Issue 001 correction -- point-in-time check was wrong; must use window-vs-window overlap).

5. **License Plate Uniqueness** -- `@@unique([operatorId, licensePlate])` -- plate unique per operator, not globally. Returns 422 `PLATE_IN_USE` on duplicate.

6. **Pickup Area Deactivation (never delete)** -- `OperatorPickupArea` records are never physically deleted; `isActive = false` deactivates instead. Historical bookings reference these records via `Hold.pickupAreaId` and `Booking.pickupAreaId`.

7. **I1 (SELECT FOR UPDATE)** -- All capacity-affecting Bus writes use `$transaction` callback form + `SELECT FOR UPDATE` on the Bus row (array form prohibited -- no `tx` handle for raw SQL per ADR-009 D6).

8. **Tenant Isolation** -- `operatorId` derived from JWT claim ONLY, never from request body. All queries use `withOperatorScope` or manual `WHERE operatorId = <jwt.operatorId>`.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Bus List | `/op/buses` | Table with columns: Bien so xe, Suc chua, Loai xe (badge), Trang thai (badge), Bao tri | Card layout on mobile (<768px), compact table on tablet, full table on desktop |
| Bus Create/Edit Form | `/op/buses` (modal/panel) | Fields: Bien so xe (required), Suc chua (required), Loai xe dropdown (required), optional maintenance window (Tu/Den datetime + Ly do) | Full-width single column on mobile |
| Pickup Area Management | `/op/pickup-areas` (implied) | CRUD for OperatorPickupArea with GSO province/district/ward selection | API endpoints exist but standalone UI wireframe not explicitly designed in FD-022 |

### Bus Type Badge Mapping

| Enum | Vietnamese | Badge Color |
|------|-----------|-------------|
| `coach` | Xe khach | Gray |
| `sleeper` | Giuong nam | Blue |
| `limousine` | Limousine | Gold/amber |

### Error Messages

| Error | Vietnamese Message | HTTP |
|-------|-------------------|------|
| `plate_in_use` | Bien so xe da duoc su dung | 422 |
| `capacity_reduction_blocked` | Khong the giam suc chua duoi so hanh khach da dat | 422 |
| `future_trips_assigned` | Co chuyen xe sap toi, khong the ngung hoat dong | 422 |
| `maintenance_overlap` | Xe dang trong lich bao tri | 409 |

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| Transport licensing (Giay phep kinh doanh van tai) | Platform must verify each operator holds valid license from provincial Dept of Transport. 5-7 year validity, renewable. | `Operator.transportLicenseNumber` column; `KybDocument` records; 60-day expiry alert cron (`operatorLicenseAlert`) |
| Vehicle inspection (dang kiem) | Periodic inspection mandatory. Valid registration required. | Platform should verify at onboarding |
| Decree 03/2021 (amended by Decree 67/2023) | Mandatory passenger insurance per vehicle | Operator's responsibility; `Operator.insurancePolicyRef` verification at onboarding |
| Passenger manifests (BGTVT) | Some routes require manifests submitted to authorities | `GET /api/op/trips/:id/manifest` produces inspection-ready manifest |
| Pickup/dropoff points | Official bus stations (ben xe) are regulated; operator-designated pickup points are gray area but widely accepted (ThanhBuoi, PhuongTrang, VeXeRe precedent) | `OperatorPickupArea.kind` = `station` vs `pickup` reflects distinction; platform lists only what operator already offers |
| Platform classification risk | Adding fleet management features could trigger reclassification from "technology platform" to "transport business" (49-51% foreign ownership cap, transport license required) | Current scope (operator self-managed fleet data) is within safe "technology platform" classification per VeXeRe precedent |

## Testing Strategy

### Unit Tests

- Error code logic and validation rules for bus CRUD
- Plate format parsing and validation
- PickupPlaceKind enum validation

### Integration Tests

- Bus CRUD with real PostgreSQL
- **Plate uniqueness:** Create two buses with same plate for same operator -> 422 `PLATE_IN_USE`; different operators with same plate -> allowed
- **Capacity reduction guard (TOCTOU):** Concurrent `PATCH capacity` + `POST hold` on same bus's trip -> exactly one must succeed (concurrent-write integration test with `Promise.all`)
- **Capacity reduction guard (basic):** Reduce capacity below count of paid bookings -> 422; reduce to exactly count of paid bookings -> allowed
- **Deactivation guard:** Deactivate bus with future assigned trip -> 422 `FUTURE_TRIPS_ASSIGNED`; deactivate after cancelling trips -> allowed
- **Maintenance overlap -- trip creation:** Create trip overlapping `[maintenanceStart, maintenanceEnd]` -> 409 `MAINTENANCE_OVERLAP`
- **Maintenance overlap -- search exclusion:** Verify window-vs-window logic, not point-in-time (Mistake Log Issue 001)
- **Pickup area deactivation:** Deactivate `OperatorPickupArea` and verify existing bookings still display area label (snapshot in `TripPickupArea.label`)

### E2E Tests

- Create bus -> create trip -> verify maintenance conflict warning
- NOT NULL grep checklist: before any migration adding NOT NULL Bus column, run `grep -r "prisma\.bus\.create"` across `e2e/**`, `prisma/seed.ts`, `**/__tests__/**`
- CHECK constraint validation: any new CHECK constraint on Bus must be validated against every `prisma.bus.create` call site (Mistake Log Issue 020)

## Cross-References

- **Architecture Decisions:** [ADR-004](../../architecture-decisions/ADR-004-multi-tenancy/README.md) (D6 shared DB + withOperatorScope, D13 global Place + operator pickup areas), [ADR-009](../../architecture-decisions/ADR-009-concurrency-seat-holding/README.md) (D1 SELECT FOR UPDATE, D6 $transaction callback form), [ADR-016](../../architecture-decisions/ADR-016-module-boundaries/README.md) (D3 client barrel restriction), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md) (D3 $transaction + SELECT FOR UPDATE, D4 timestamp + status together)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (sections 2.4, 6.1, 11.1, 11.4), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (sections 7.2, 7.6, 14.5)
- **Frontend Design:** [FD-022](../../frontend-design/FD-022-operator-fleet-trips/README.md) (Section 2 -- Bus Management)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md) (Section 2), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md), [event-flows.md](../../business/domain-model/event-flows.md) (Flow 2)
- **Regulatory:** [transport.md](../../business/regulatory/transport.md) (Sections 1, 4, 5, 6)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md) (Sections 2, 3, 5, 6)

## Known Gaps & Open Questions

- **MEDIUM -- Maintenance window model duplication** -- Two places maintenance is stored: `Bus.maintenanceStart`/`Bus.maintenanceEnd` (single current window) AND `BusMaintenance` records (historical log). Whether `PATCH /api/op/buses/:id/maintenance` also creates a `BusMaintenance` row is not specified in DS-003.
- **MEDIUM -- Pickup area management UI path** -- FD-022 covers route's pickup area assignment (Section 3.3) but the standalone `/op/pickup-areas` management page (CRUD for `OperatorPickupArea`) is not explicitly designed in FD-022. API endpoints exist but admin page wireframe is not documented.
- **LOW -- wardName/districtName source** -- `OperatorPickupArea` stores denormalized `wardName` and `districtName`. No documented GSO code lookup table or validation for province/district/ward codes.
- **LOW -- Bus list pagination** -- DS-003 Section 7.2 lists endpoints but does not specify a `GET /api/op/buses` list endpoint explicitly with query parameters or pagination shape.
- **LOW -- BusMaintenance API endpoint** -- No documented API endpoint for creating/editing `BusMaintenance` records directly. `PATCH /api/op/buses/:id/maintenance` sets Bus-level columns but whether it creates `BusMaintenance` history rows is unspecified.
