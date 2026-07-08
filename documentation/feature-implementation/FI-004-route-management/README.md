# FI-004: Route Management (Quan ly tuyen duong)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-004, ADR-011, DS-001, DS-003, FD-022

## Overview

FI-004 covers operator-facing tools for defining and managing bus routes -- the bidirectional lines that connect an origin to a destination. A Route is the fixed corridor definition; Trips ([FI-005](../FI-005-trip-management/README.md)) are specific scheduled departures on a Route by a Bus at a fixed price. Routes carry `durationMinutes` (used for bus-overlap window calculations), optional canonical `Place` FK links for diacritics-normalized cross-operator search, and pickup area associations via the `RoutePickupArea` join table. The global `Place` registry (admin-managed) underpins cross-operator trip search but is not operator-editable.

## Scope & Boundaries

### In Scope

- CRUD for `Route` records (origin, destination, durationMinutes, optional Place links)
- Route soft-deactivation by operator (`deactivatedAt`)
- Route soft-hide by admin (`moderatedAt`) -- platform-level kill switch
> **Phase 2 (deferred)**: Pickup area association + pickup API endpoints deferred to post-launch (trigger: 4 operators). Phase 1 = station-only.

- Associating `OperatorPickupArea` records to a Route via `RoutePickupArea` (live link, not snapshot)
- `Place` lookup (read-only from operator perspective -- Places are admin-managed global registry)
- Diacritics-insensitive route search (GIN index on `unaccent_immutable(lower(origin))` and `unaccent_immutable(lower(destination))`)

### Out of Scope

- `Place` creation/editing (admin-only) -> [FI-012](../FI-012-admin-console/README.md)
- Trip scheduling on routes -> [FI-005](../FI-005-trip-management/README.md)
- RecurringTripTemplate management -> [FI-005](../FI-005-trip-management/README.md)
- Fleet (Bus) management -> [FI-003](../FI-003-fleet-management/README.md)
- Customer-facing search -> [FI-006](../FI-006-search-discovery/README.md)
- Charter requests -> separate charter bounded context

### Bounded Context(s)

**Fleet/Catalog Context** (Section 2 of bounded-contexts.md) -- owns Route, Place (global registry), RoutePickupArea, and OperatorSettings.

**Dependencies:**
- [FI-003](../FI-003-fleet-management/README.md) provides `OperatorPickupArea` records that are linked to Routes via `RoutePickupArea`
- [FI-005](../FI-005-trip-management/README.md) (Trips) requires Route records to exist; inherits `durationMinutes` for bus-overlap window calculation (`departureAt + durationMinutes + 60 min buffer`)
- Admin Places registry provides canonical `Place` records that Routes optionally reference via `originPlaceId`/`destPlaceId`

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Route | `id` (CUID PK), `origin` (String, NOT NULL -- free-text back-compat shim), `destination` (String, NOT NULL -- free-text back-compat shim), `operatorId` (FK->Operator, onDelete: Restrict, NOT NULL), `durationMinutes` (Int, NOT NULL), `deactivatedAt` (DateTime, nullable -- operator soft-disable), `moderatedAt` (DateTime, nullable -- admin kill switch; non-null = hidden from search), `createdAt`, `updatedAt`, `originPlaceId` (String, FK->Place, onDelete: SetNull, nullable), `destPlaceId` (String, FK->Place, onDelete: SetNull, nullable) | `@@index([origin, destination])`, `@@index([operatorId])`, `@@index([originPlaceId, destPlaceId])` | Tenant-scoped via `operatorId`. `onDelete: Restrict` means operator cannot be deleted while routes exist. Two independent soft-disable axes: `deactivatedAt` (operator) and `moderatedAt` (admin). |
| Place | `id` (CUID PK), `canonicalName` (String, NOT NULL), `aliases` (String[], NOT NULL), `slug` (String, nullable, `@unique`), `createdAt` | `@@index([canonicalName])` | **Global** (NOT operator-scoped). Admin-managed. Supports alias merging and diacritics-normalized search via `unaccent_immutable ILIKE`. URL-friendly `slug` for SEO routes (`/search/{origin-slug}/{destination-slug}/{date}`). |
| RoutePickupArea | `id` (CUID PK), `routeId` (FK->Route, onDelete: Cascade), `operatorPickupAreaId` (FK->OperatorPickupArea, onDelete: Cascade), `displayOrder` (Int) | `@@unique([routeId, operatorPickupAreaId])`, `@@index([routeId, displayOrder])` | **Live link** (not a snapshot) -- label and kind are read from `OperatorPickupArea` at query time. Contrast with `TripPickupArea` which snapshots at trip-create time. |
| OperatorSettings | `id` (CUID PK), `operatorId` (String, `@unique`, FK->Operator, 1:1), `autoConfirmBookings` (Boolean, `@default(false)`), `notificationPreference` (String, `@default("sms")`), `bookingReminderHours` (Int, `@default(24)`), `customBrandingText` (String, nullable), `updatedAt` | `@@unique(operatorId)` | 1:1 with Operator. Includes `customBrandingText` for operator-branded tickets/notifications. |

### SQL-Only Functional Index

| Name | Table | SQL Definition | Purpose |
|------|-------|----------------|---------|
| `trip_route_unaccent_idx` | Route | `USING GIN (unaccent_immutable(lower(origin)) gin_trgm_ops, unaccent_immutable(lower(destination)) gin_trgm_ops)` | Vietnamese diacritic-insensitive route search. Requires `pg_trgm` + `unaccent` extensions and `unaccent_immutable(text)` IMMUTABLE wrapper function. |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/op/routes` | Operator JWT | Create route. Body: `{ origin, destination, durationMinutes, originPlaceId?, destPlaceId? }` | 201, 400 `VALIDATION_ERROR` |
| PATCH | `/api/op/routes/:id` | Operator JWT | Update route. `deactivatedAt` for soft-deactivation | 200, 404 |
| POST | `/api/op/pickup-areas` | Operator JWT | Create named pickup/station point for operator. Body: `{ provinceCode, districtCode, wardCode, name, kind, displayOrder }` | 201, 400 |
| PATCH | `/api/op/pickup-areas/:id` | Operator JWT | Update pickup area. Deactivate via `isActive = false` | 200, 404 |
| POST | `/api/admin/places` | Admin JWT | Create canonical Place (global registry, admin-only) | 201 |
| PATCH | `/api/admin/places/:id` | Admin JWT | Update Place (add aliases, change canonical name) | 200, 404 |

**Note:** DS-003 Section 7.3 defines only `POST /api/op/routes` and `PATCH /api/op/routes/:id` explicitly. A `GET /api/op/routes` list endpoint is implied by the UI but not explicitly documented. RoutePickupArea association is managed through the route create/update endpoints (implied; not documented as separate endpoint).

## State Machine

This feature does not have a dedicated state machine. Route has two independent soft-state columns:

- `deactivatedAt`: null = active, non-null = deactivated by operator
- `moderatedAt`: null = visible, non-null = hidden from search by admin

Neither follows a formal transition graph. Both are set/cleared via timestamp writes.

## Business Rules & Invariants

1. **Operator Scope Isolation** -- All Route queries require `WHERE operatorId = <jwt.operatorId>`. Operator FK uses `onDelete: Restrict` -- an operator cannot be deleted (physically) while they have routes. Admin gating (`Operator.status = 'APPROVED'`) is required before routes become search-visible. `operatorId` from JWT ONLY, never request body.

2. **Admin Moderation Kill Switch** -- `Route.moderatedAt IS NOT NULL` hides the route and all its trips from `GET /api/trips/search`. Independent of `deactivatedAt` (operator's own soft-disable). Admin sets this; operator cannot clear it.

3. **Route-to-Trip Relationship** -- `Route.durationMinutes` is used in the bus-overlap window calculation: `[departureAt, departureAt + durationMinutes + 60 min buffer]` (see Bus Overlap Guard in invariants-catalog.md). Operator cannot delete a Route that has scheduled/active trips (FK `onDelete: Restrict` on Trip.routeId would block at DB level).

4. **Place Registry (Global)** -- `Place` is NOT operator-scoped. Customer search uses `Place.slug` for SEO URLs (`/search/{origin-slug}/{destination-slug}/{date}`). `originPlaceId`/`destPlaceId` on Route are nullable FK->Place (onDelete: SetNull) -- a Place being deleted does not cascade-delete the Route. Diacritics-insensitive search: `unaccent_immutable(lower(origin)) ILIKE` ensures "Da Nang"/"Da Nang"/"TP. Da Nang" all match.

5. **RoutePickupArea is a Live Link** -- Unlike `TripPickupArea` (which snapshots label/kind at trip creation), `RoutePickupArea` reads from `OperatorPickupArea` at query time. Changes to `OperatorPickupArea.label`/`.kind` immediately affect route display. Deactivating an `OperatorPickupArea` (`isActive = false`) removes it from the active pickup menu for new trips but does not affect existing `TripPickupArea` snapshot rows.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Route List | `/op/routes` | Table with columns: Tuyen (origin -> destination), Thoi gian (X gio Y phut), Diem don (count), Trang thai (badge) | Card layout on mobile, compact table on tablet, full table on desktop |
| Route Create/Edit Form | `/op/routes` (modal/panel) | Noi di combobox, Noi den combobox, Thoi gian (gio/phut), Diem don checkboxes, "+ Them diem" button | Place combobox supports Vietnamese diacritics search via `unaccent_immutable ILIKE` |

### Place Combobox Behavior

Typing "Da Nang" or "Da Nang" both match. Shows `Place.canonicalName` with aliases. Supports diacritics-insensitive search via the GIN functional index.

### Responsive Behavior

| Viewport | List Views | Forms |
|----------|-----------|-------|
| Mobile (<768px) | Card layout (stacked), swipe for actions | Full-width, single column |
| Tablet (768-1024px) | Compact table | Centered, max 640px |
| Desktop (>1024px) | Full table with all columns | Side panel or modal |

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| Route-specific authorization (tuyen co dinh) | Fixed-route services need approval from provincial Dept of Transport; routes registered with departure/arrival terminals | `Route.origin`/`Route.destination` free-text fields should match operator's authorized corridor registration |
| Pickup/dropoff points (ben xe regulated) | Official bus stations regulated; operator-designated pickup points are gray area but widely accepted (ThanhBuoi, PhuongTrang, VeXeRe precedent) | `RoutePickupArea` -> `OperatorPickupArea` link (`kind = station` vs `pickup`) reflects distinction; admin moderation via `Route.moderatedAt` |
| Platform classification risk | Adding route optimization features beyond simple listing could trigger reclassification from "technology platform" to "transport business" | Current scope (operator self-manages route definition) within safe bounds per VeXeRe precedent |
| Law on Pricing 2023 | Bus ticket prices are market-determined; Tet exception: caps at 40-60% above normal; total price must be displayed upfront | Route pricing is not stored at Route level -- set per-Trip at Trip creation time ([FI-005](../FI-005-trip-management/README.md)) |

## Testing Strategy

### Unit Tests

- Duration formatting logic (minutes to "X gio Y phut")
- Route search normalization logic (diacritics handling)

### Integration Tests

- Route CRUD with real PostgreSQL
- **Diacritics-insensitive search:** Create route with "Da Nang" as origin; search with "da nang" (unaccented) -> must match; search with partial diacritics -> must match
- **Admin moderation kill switch:** Set `moderatedAt` on a Route; verify `GET /api/trips/search` returns no trips on that route
- **Operator deactivation:** Set `deactivatedAt` on a Route; verify excluded from trip creation dropdown and search
- **RoutePickupArea live link:** Update `OperatorPickupArea.label`; verify route display reflects updated label (contrast with TripPickupArea snapshot)
- **Place FK onDelete: SetNull:** Delete a Place; verify Route rows that referenced it now have `originPlaceId = null` but are not deleted
- **Operator scope:** Route created by operator A must not be visible to operator B; 404 returned when B tries to access A's route
- **durationMinutes accuracy:** Verify `Route.durationMinutes` is used correctly in bus-overlap calculation in [FI-005](../FI-005-trip-management/README.md) tests

### E2E Tests

- Create route -> verify in trip dropdown -> verify search returns results
- GIN index verification: after any migration, manually verify index exists (Prisma 7.x CLI flags changed per Mistake Log Issue 012)
- RSC render purity: route list page must not call `Date.now()` in RSC render body (Mistake Log Issue 016)
- Place combobox: test diacritics-normalized combobox via URL parameters, not form keystrokes, for non-form-interaction tests

## Cross-References

- **Architecture Decisions:** [ADR-004](../../architecture-decisions/ADR-004-multi-tenancy/README.md) (D6 shared DB + withOperatorScope, D13 global Place + operator pickup areas), [ADR-016](../../architecture-decisions/ADR-016-module-boundaries/README.md) (D3 client barrel restriction), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md) (D4 timestamp + status together)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (sections 2.4, 5.3, 9), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (sections 7.3, 7.6, 8.6, 14.5)
- **Frontend Design:** [FD-022](../../frontend-design/FD-022-operator-fleet-trips/README.md) (Section 3 -- Route Management)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md) (Section 2, Section 10), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md), [event-flows.md](../../business/domain-model/event-flows.md) (Flow 2)
- **Regulatory:** [transport.md](../../business/regulatory/transport.md) (Sections 1.2, 4)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md) (Sections 2, 3, 6)

## Known Gaps & Open Questions

- **HIGH -- origin/destination migration deferred** -- DS-001 Section 2.4 notes these free-text columns are "back-compat shims" with a target to migrate to required `originPlaceId`/`destPlaceId` (referenced as ADR-011). This migration has not been done. Search uses the free-text GIN index, not Place FKs. Any future migration adding NOT NULL constraint on `originPlaceId`/`destPlaceId` would require the full NOT NULL grep checklist.
- **MEDIUM -- No explicit GET /api/op/routes endpoint in DS-003** -- The route list page at `/op/routes` is specified in FD-022 but the list endpoint is not explicitly documented in DS-003. Query parameters (pagination, filters) are unspecified.
- **MEDIUM -- RoutePickupArea management in API** -- DS-003 documents OperatorPickupArea CRUD but the specific API for associating/dissociating OperatorPickupArea records with a Route (creating/deleting RoutePickupArea rows) is not explicitly documented. Presumably part of route create/update bodies.
- **LOW -- Place slugs for SEO** -- ADR-004 D13 references `Place.slug` for SEO URL pattern `/search/{origin-slug}/{destination-slug}/{date}`. The workflow for how Route.originPlaceId/destPlaceId gets linked to a Place when operators create routes is not fully specified.
- **LOW -- Admin moderation vs operator deactivation coordination** -- When admin sets `Route.moderatedAt`, the operator is not notified (no notification workflow documented for route-level moderation).
