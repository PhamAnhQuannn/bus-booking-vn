# 09 — lib/catalog/ Domain Module

The `lib/catalog/` module owns the operator-facing catalog domain: buses, routes, and pickup areas. All write operations are tenant-scoped via `withOperatorScope` from `lib/core/db`. The module follows the project dependency flow (`app/` -> `lib/<domain>/` -> `lib/core/`) and exposes its public API through `index.ts`.

---

## Directory Layout

```
lib/catalog/
  index.ts                        Barrel (public API)
  createBus.ts                    Bus creation
  updateBus.ts                    Bus partial update
  deactivateBus.ts                Bus soft-delete
  listOperatorBuses.ts            Operator bus list
  getOperatorBus.ts               Single bus detail + maintenance windows
  getOperatorBusWithTrips.ts      Bus detail + active selling trips
  capacityGuard.ts                Pure capacity-reduction math
  getTripOccupancy.ts             Per-trip seat occupancy snapshot
  getMaintenanceConflicts.ts      Maintenance/trip overlap queries
  windowsOverlap.ts               Window-vs-window overlap predicate
  createRoute.ts                  Route creation (with Place resolution)
  updateRoute.ts                  Route partial update
  deactivateRoute.ts              Route soft-delete
  listRoutes.ts                   Operator route list
  getRouteById.ts                 Single route fetch
  createOperatorPickupArea.ts     Pickup area creation + label composition
  updateOperatorPickupArea.ts     Pickup area edit (name, addressLine, kind)
  deactivateOperatorPickupArea.ts Pickup area soft-delete
  listOperatorPickupAreas.ts      Operator pickup area menu
  setRoutePickupAreas.ts          Assign pickup areas to a route
  listRoutePickupAreas.ts         Pickup areas assigned to a route
  pickupPlaceKind.ts              PickupPlaceKind -> PickupKind mapper
  __tests__/                      Unit + integration tests
```

---

## Barrel Exports (index.ts)

All cross-domain imports go through this barrel per SYS20 rule 3.

| Export | Source File | Kind |
|--------|-----------|------|
| `canReduceCapacity` | `capacityGuard.ts` | function |
| `createBus` | `createBus.ts` | function |
| `BusServiceError` | `createBus.ts` | class |
| `createRoute` | `createRoute.ts` | function |
| `createOperatorPickupArea` | `createOperatorPickupArea.ts` | function |
| `composePickupLabel` | `createOperatorPickupArea.ts` | function |
| `PickupAreaServiceError` | `createOperatorPickupArea.ts` | class |
| `OperatorPickupAreaDto` | `createOperatorPickupArea.ts` | type |
| `listOperatorPickupAreas` | `listOperatorPickupAreas.ts` | function |
| `listRoutePickupAreas` | `listRoutePickupAreas.ts` | function |
| `setRoutePickupAreas` | `setRoutePickupAreas.ts` | function |
| `RoutePickupAreaServiceError` | `setRoutePickupAreas.ts` | class |
| `pickupPlaceKindToPickupKind` | `pickupPlaceKind.ts` | function |
| `deactivateOperatorPickupArea` | `deactivateOperatorPickupArea.ts` | function |
| `updateOperatorPickupArea` | `updateOperatorPickupArea.ts` | function |
| `deactivateBus` | `deactivateBus.ts` | function |
| `deactivateRoute` | `deactivateRoute.ts` | function |
| `findMaintenanceOverlaps` | `getMaintenanceConflicts.ts` | function |
| `findTripOverlaps` | `getMaintenanceConflicts.ts` | function |
| `getOperatorBus` | `getOperatorBus.ts` | function |
| `getOperatorBusWithTrips` | `getOperatorBusWithTrips.ts` | function |
| `BusActiveTrip` | `getOperatorBusWithTrips.ts` | type |
| `getRouteById` | `getRouteById.ts` | function |
| `listOperatorBuses` | `listOperatorBuses.ts` | function |
| `OperatorBusListItem` | `listOperatorBuses.ts` | type |
| `listRoutes` | `listRoutes.ts` | function |
| `updateBus` | `updateBus.ts` | function |
| `UpdateBusInput` | `updateBus.ts` | type |
| `updateRoute` | `updateRoute.ts` | function |
| `RouteServiceError` | `updateRoute.ts` | class |

**Not exported through barrel** (internal / consumed only within the domain):

| Symbol | File | Reason |
|--------|------|--------|
| `getTripOccupancy` | `getTripOccupancy.ts` | Called by route handlers directly |
| `windowsOverlap` | `windowsOverlap.ts` | Pure utility; consumed within domain |
| `areaSelect` | `createOperatorPickupArea.ts` | Prisma select constant shared internally |
| `CreateBusInput`, `CreatedBus` | `createBus.ts` | Used by route handlers via deep import |
| `UpdatedBus` | `updateBus.ts` | Used by route handlers via deep import |
| `DeactivateResult` | `deactivateBus.ts` | Used by route handlers via deep import |

---

## File-by-File Reference

### Bus Subdomain

#### `createBus.ts`

Creates a bus scoped to an operator. Maps Prisma P2002 uniqueness violation to typed `BusServiceError('plate_in_use')`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `CreateBusInput` | `interface { operatorId: string; licensePlate: string; capacity: number; busType: 'coach' \| 'sleeper' \| 'limousine' }` | Input shape for bus creation |
| `CreatedBus` | `interface { id, operatorId, licensePlate, capacity, busType }` | Return shape after creation |
| `BusServiceError` | `class extends Error { code: 'plate_in_use' }` | Typed error for duplicate plate within operator |
| `createBus` | `(input: CreateBusInput) => Promise<CreatedBus>` | Insert bus row; throws `BusServiceError` on plate collision |

**Dependencies:** `@/lib/core/db/client`, `@prisma/client`

---

#### `updateBus.ts`

Partial update of bus fields. Confirms operator ownership before writing. Returns `null` for cross-operator access (route handler maps to 404). Capacity reduction guard and deactivation check are caller responsibilities.

| Export | Signature | Description |
|--------|-----------|-------------|
| `UpdateBusInput` | `interface { licensePlate?: string; capacity?: number; busType?: 'coach' \| 'sleeper' \| 'limousine' }` | Partial patch fields |
| `UpdatedBus` | `interface { id, operatorId, licensePlate, capacity, busType }` | Return shape |
| `updateBus` | `(operatorId: string, busId: string, patch: UpdateBusInput) => Promise<UpdatedBus \| null>` | Patch bus; throws `BusServiceError('plate_in_use')` on collision |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`), `@prisma/client`, `./createBus` (`BusServiceError`)

---

#### `deactivateBus.ts`

Soft-deletes a bus by setting `deactivatedAt = now`. Returns discriminated result (not thrown error). Re-activation is not supported.

| Export | Signature | Description |
|--------|-----------|-------------|
| `DeactivateResult` | `{ ok: true; deactivatedAt: Date } \| { ok: false; reason: 'not_found' \| 'already_deactivated' }` | Discriminated union result |
| `deactivateBus` | `(operatorId: string, busId: string) => Promise<DeactivateResult>` | Soft-delete; pre-condition (no future trips) checked by caller |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`)

---

#### `listOperatorBuses.ts`

Lists buses for an operator. Supports `activeOnly` filter (excludes soft-deleted). Sorted by `id DESC` (CUID is time-sortable) as proxy for `createdAt`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `OperatorBusListItem` | `interface { id, licensePlate, capacity, busType, deactivatedAt }` | List item shape |
| `listOperatorBuses` | `(operatorId: string, opts: { activeOnly: boolean }) => Promise<OperatorBusListItem[]>` | Tenant-scoped bus list |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`)

---

#### `getOperatorBus.ts`

Fetches a single bus with its maintenance windows. Returns `null` for cross-operator or missing bus.

| Export | Signature | Description |
|--------|-----------|-------------|
| `MaintenanceWindow` | `interface { id, startAt, endAt, reason }` | Maintenance window shape |
| `OperatorBusDetail` | `interface { id, operatorId, licensePlate, capacity, busType, deactivatedAt, maintenances: MaintenanceWindow[] }` | Full bus detail with maintenance |
| `getOperatorBus` | `(operatorId: string, busId: string) => Promise<OperatorBusDetail \| null>` | Single bus detail query |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`)

---

#### `getOperatorBusWithTrips.ts`

Bus detail enriched with currently-selling trips and per-trip seat counts. "Currently selling" means `status='scheduled' AND salesClosed=false AND departureAt >= now`. Sold seats count only PAID statuses (`paid`, `completed`).

| Export | Signature | Description |
|--------|-----------|-------------|
| `BusActiveTrip` | `interface { id, routeId, origin, destination, departureAt (ISO), price, capacity, soldSeats, availableSeats, salesClosed }` | Active trip with occupancy |
| `BusWithActiveTrips` | `interface { id, licensePlate, capacity, busType, deactivatedAt, maintenanceWindows[], activeTrips: BusActiveTrip[] }` | Full bus + trips response |
| `getOperatorBusWithTrips` | `(operatorId: string, busId: string) => Promise<BusWithActiveTrips \| null>` | Bus detail + selling trips |

**Dependencies:** `@prisma/client` (`BookingStatus`), `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`)

---

#### `capacityGuard.ts`

Pure function (no DB access). Validates that a proposed capacity reduction does not drop below the maximum occupancy of any future trip. Caller provides the occupancy snapshot via `getTripOccupancy`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `TripOccupancy` | `interface { tripId, heldSeats, bookedSeats }` | Per-trip occupancy input |
| `ViolatingTrip` | `interface { tripId, occupancy }` | Trip that would exceed new capacity |
| `CapacityGuardResult` | `{ ok: true } \| { ok: false; violatingTrips: ViolatingTrip[] }` | Discriminated result |
| `canReduceCapacity` | `(newCapacity: number, trips: TripOccupancy[]) => CapacityGuardResult` | Pure capacity check |

**Dependencies:** None (pure function)

---

#### `getTripOccupancy.ts`

Queries per-future-trip seat occupancy for a bus. Feeds `canReduceCapacity`. Active holds = `status='active' AND expiresAt > now`. Paid bookings = `paid` or `completed` status.

| Export | Signature | Description |
|--------|-----------|-------------|
| `getTripOccupancy` | `(busId: string) => Promise<TripOccupancy[]>` | Snapshot occupancy for all future trips on a bus |

**Dependencies:** `@/lib/core/db/client`, `@prisma/client` (`BookingStatus`), `./capacityGuard` (`TripOccupancy` type)

---

#### `getMaintenanceConflicts.ts`

Query helpers for maintenance-window scheduling. Two conflict classes: maintenance-vs-maintenance (hard block) and maintenance-vs-trip (soft warning). Uses window-vs-window overlap per Issue 001 Mistake Log.

| Export | Signature | Description |
|--------|-----------|-------------|
| `FindConflictsInput` | `interface { busId, startAt, endAt, excludeMaintenanceId? }` | Conflict query input |
| `findMaintenanceOverlaps` | `(input: FindConflictsInput) => Promise<{ id, startAt, endAt }[]>` | Maintenance windows overlapping the given range |
| `ConflictingTrip` | `interface { tripId, departureAt }` | Trip that falls within a maintenance window |
| `findTripOverlaps` | `(input: Omit<FindConflictsInput, 'excludeMaintenanceId'>) => Promise<ConflictingTrip[]>` | Trips with departure inside the maintenance window |

**Dependencies:** `@/lib/core/db/client`

---

#### `windowsOverlap.ts`

Pure predicate for time-window collision. Implements Issue 001 Mistake Log rule: `aStart <= bEnd AND aEnd >= bStart`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `Window` | `interface { start: Date; end: Date }` | Time window shape |
| `windowsOverlap` | `(a: Window, b: Window) => boolean` | True if intervals overlap (inclusive) |

**Dependencies:** None (pure function)

---

### Route Subdomain

#### `createRoute.ts`

Creates a route scoped to an operator. Resolves or creates canonical Place records for origin and destination via `lib/places` (Issue 044). Free-text origin/destination columns are still written as back-compat shim.

| Export | Signature | Description |
|--------|-----------|-------------|
| `CreatedRoute` | `interface { id, operatorId, origin, destination, durationMinutes, originPlaceId, destPlaceId, deactivatedAt, createdAt, updatedAt }` | Return shape |
| `createRoute` | `({ operatorId, data }: { operatorId: string; data: RouteCreateInput }) => Promise<CreatedRoute>` | Insert route + resolve Places |

**Dependencies:** `@/lib/core/db/client`, `@/lib/places` (`resolveOrCreatePlace`), `@/lib/core/validation/route` (`RouteCreateInput`)

---

#### `updateRoute.ts`

Partial update of route fields. Rejects edits on deactivated routes. Re-resolves Place FKs when origin/destination text changes.

| Export | Signature | Description |
|--------|-----------|-------------|
| `RouteServiceError` | `class extends Error { code: 'not_found' \| 'reactivation_not_supported' \| 'already_deactivated' }` | Typed error |
| `updateRoute` | `({ operatorId, routeId, data }) => Promise<Route>` | Patch route; throws `RouteServiceError` |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`), `@/lib/places` (`resolveOrCreatePlace`), `@/lib/core/validation/route` (`RoutePatchInput`)

---

#### `deactivateRoute.ts`

Soft-deletes a route by setting `deactivatedAt = now`. Throws `RouteServiceError('not_found')` or `RouteServiceError('already_deactivated')`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `deactivateRoute` | `({ operatorId, routeId }) => Promise<Route>` | Soft-delete route; throws `RouteServiceError` |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`), `./updateRoute` (`RouteServiceError`)

---

#### `listRoutes.ts`

Lists all routes (active + deactivated) for an operator, ordered by `createdAt DESC`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `listRoutes` | `({ operatorId }) => Promise<Route[]>` | Tenant-scoped route list |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`)

---

#### `getRouteById.ts`

Fetches a single route. Returns `null` for cross-operator or missing route. No pickup point includes (removed Issue 104).

| Export | Signature | Description |
|--------|-----------|-------------|
| `getRouteById` | `({ operatorId, routeId }) => Promise<Route \| null>` | Single route query |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`)

---

### Pickup Area Subdomain

#### `createOperatorPickupArea.ts`

Creates a reusable pickup area entry in the operator's menu (Issue 105). Server resolves names and label from `lib/geo` using GSO code triple. Dedupes against active areas with the same name in the same ward. Auto-increments `displayOrder`.

| Export | Signature | Description |
|--------|-----------|-------------|
| `PickupAreaServiceError` | `class extends Error { code: 'invalid_area' \| 'duplicate_area' \| 'not_found' \| 'already_inactive' }` | Typed error for all pickup area operations |
| `OperatorPickupAreaDto` | `interface { id, provinceCode, districtCode, districtName, wardCode, wardName, name, addressLine, label, kind, isActive, displayOrder }` | Pickup area DTO (shared across all pickup area functions) |
| `areaSelect` | `const { id, provinceCode, districtCode, ... }` | Prisma select constant (internal, shared within domain) |
| `composePickupLabel` | `(p: { name: string; addressLine?: string \| null }) => string` | Customer-facing display label: "Name -- addressLine" or just "Name" |
| `createOperatorPickupArea` | `({ operatorId, data }) => Promise<OperatorPickupAreaDto>` | Insert pickup area; throws `PickupAreaServiceError` |

**Dependencies:** `@prisma/client` (`PickupPlaceKind`), `@/lib/core/db/client`, `@/lib/geo` (GSO resolution), `@/lib/core/validation/pickupArea` (`OperatorPickupAreaCreateInput`)

---

#### `updateOperatorPickupArea.ts`

Edits a pickup area's identity (name, addressLine, kind). Ward is not editable (deactivate + recreate instead). When `kind` changes, cascades to all TripPickupArea and TemplatePickupArea rows in the same transaction (kind is a display-grouping, not historical-accuracy field).

| Export | Signature | Description |
|--------|-----------|-------------|
| `updateOperatorPickupArea` | `({ operatorId, areaId, data }) => Promise<OperatorPickupAreaDto>` | Edit pickup area; cascades kind changes; throws `PickupAreaServiceError` |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`), `./createOperatorPickupArea` (`PickupAreaServiceError`, `areaSelect`, `OperatorPickupAreaDto`), `@/lib/core/validation/pickupArea` (`OperatorPickupAreaUpdateInput`)

---

#### `deactivateOperatorPickupArea.ts`

Soft-deletes a pickup area (`isActive = false`). Historical bookings and existing TripPickupArea rows are preserved. Deactivation only removes the area from the new-trip setup menu; trips that already enabled it keep it bookable (Issue 112 decision).

| Export | Signature | Description |
|--------|-----------|-------------|
| `deactivateOperatorPickupArea` | `({ operatorId, areaId }) => Promise<OperatorPickupAreaDto>` | Soft-delete; throws `PickupAreaServiceError('not_found' \| 'already_inactive')` |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`), `./createOperatorPickupArea` (`PickupAreaServiceError`, `areaSelect`, `OperatorPickupAreaDto`)

---

#### `listOperatorPickupAreas.ts`

Returns all pickup areas (active + deactivated) for an operator, ordered by `displayOrder ASC`. Client handles filtering/labeling.

| Export | Signature | Description |
|--------|-----------|-------------|
| `listOperatorPickupAreas` | `({ operatorId }) => Promise<OperatorPickupAreaDto[]>` | Tenant-scoped area menu |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`), `./createOperatorPickupArea` (`areaSelect`, `OperatorPickupAreaDto`)

---

#### `setRoutePickupAreas.ts`

Full-replace assignment of pickup areas to a route (Issue 113). Deletes existing RoutePickupArea rows and re-inserts in a `$transaction`. Validates all area IDs belong to the operator and are active.

| Export | Signature | Description |
|--------|-----------|-------------|
| `RoutePickupAreaServiceError` | `class extends Error { code: 'not_found' \| 'invalid_pickup_area' }` | Typed error |
| `setRoutePickupAreas` | `({ operatorId, routeId, areaIds }) => Promise<{ assigned: number }>` | Replace route's pickup areas; throws `RoutePickupAreaServiceError` |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`)

---

#### `listRoutePickupAreas.ts`

Returns the subset of active pickup areas assigned to a route, ordered by `displayOrder ASC`. Reuses `OperatorPickupAreaDto` shape. Returns empty array for cross-operator access.

| Export | Signature | Description |
|--------|-----------|-------------|
| `listRoutePickupAreas` | `({ operatorId, routeId }) => Promise<OperatorPickupAreaDto[]>` | Pickup areas for a route |

**Dependencies:** `@/lib/core/db/client`, `@/lib/core/db` (`withOperatorScope`), `./createOperatorPickupArea` (`areaSelect`, `OperatorPickupAreaDto`)

---

### Utility

#### `pickupPlaceKind.ts`

Maps between the two pickup enums: `PickupPlaceKind` (operator's place taxonomy) and `PickupKind` (traveler boarding type on Hold/Booking). They share `station` but diverge on door-to-door: place `pickup` becomes booking `point`. This explicit mapping is the only sanctioned conversion -- never `as`-cast between them.

| Export | Signature | Description |
|--------|-----------|-------------|
| `pickupPlaceKindToPickupKind` | `(k: 'station' \| 'pickup') => 'station' \| 'point'` | `station -> station`, `pickup -> point` |

**Dependencies:** None (pure function)

---

## Error Classes

| Class | File | Codes | Used By |
|-------|------|-------|---------|
| `BusServiceError` | `createBus.ts` | `plate_in_use` | `createBus`, `updateBus` |
| `RouteServiceError` | `updateRoute.ts` | `not_found`, `reactivation_not_supported`, `already_deactivated` | `updateRoute`, `deactivateRoute` |
| `PickupAreaServiceError` | `createOperatorPickupArea.ts` | `invalid_area`, `duplicate_area`, `not_found`, `already_inactive` | `createOperatorPickupArea`, `updateOperatorPickupArea`, `deactivateOperatorPickupArea` |
| `RoutePickupAreaServiceError` | `setRoutePickupAreas.ts` | `not_found`, `invalid_pickup_area` | `setRoutePickupAreas` |

---

## Shared Types (cross-file within domain)

| Type | Defined In | Consumed By |
|------|-----------|-------------|
| `OperatorPickupAreaDto` | `createOperatorPickupArea.ts` | `listOperatorPickupAreas`, `listRoutePickupAreas`, `deactivateOperatorPickupArea`, `updateOperatorPickupArea` |
| `areaSelect` (Prisma select) | `createOperatorPickupArea.ts` | `listOperatorPickupAreas`, `listRoutePickupAreas`, `deactivateOperatorPickupArea`, `updateOperatorPickupArea` |
| `TripOccupancy` | `capacityGuard.ts` | `getTripOccupancy` |
| `BusServiceError` | `createBus.ts` | `updateBus` |
| `RouteServiceError` | `updateRoute.ts` | `deactivateRoute` |

---

## External Dependencies

| Import | Source | Used By |
|--------|--------|---------|
| `prisma` | `@/lib/core/db/client` | All files except pure functions |
| `withOperatorScope` | `@/lib/core/db` | `updateBus`, `listOperatorBuses`, `getOperatorBus`, `getOperatorBusWithTrips`, `deactivateBus`, `listRoutes`, `getRouteById`, `updateRoute`, `deactivateRoute`, `listOperatorPickupAreas`, `deactivateOperatorPickupArea`, `updateOperatorPickupArea`, `setRoutePickupAreas`, `listRoutePickupAreas` |
| `BookingStatus` | `@prisma/client` | `getOperatorBusWithTrips`, `getTripOccupancy` |
| `Prisma` | `@prisma/client` | `createBus`, `updateBus` (P2002 detection) |
| `PickupPlaceKind` | `@prisma/client` | `createOperatorPickupArea` (type import) |
| `resolveOrCreatePlace` | `@/lib/places` | `createRoute`, `updateRoute` |
| `RouteCreateInput` | `@/lib/core/validation/route` | `createRoute` |
| `RoutePatchInput` | `@/lib/core/validation/route` | `updateRoute` |
| `OperatorPickupAreaCreateInput` | `@/lib/core/validation/pickupArea` | `createOperatorPickupArea` |
| `OperatorPickupAreaUpdateInput` | `@/lib/core/validation/pickupArea` | `updateOperatorPickupArea` |
| `getProvince`, `getDistrict`, `getWard`, `isValidSelection`, `resolveLabel` | `@/lib/geo` | `createOperatorPickupArea` |

---

## Test Files

| Test File | Type | Covers |
|-----------|------|--------|
| `__tests__/capacityGuard.test.ts` | Unit | `canReduceCapacity` pure logic |
| `__tests__/capacityGuard.int.test.ts` | Integration | Capacity guard with live DB |
| `__tests__/createRoute.test.ts` | Unit | `createRoute` |
| `__tests__/updateRoute.test.ts` | Unit | `updateRoute` |
| `__tests__/deactivateRoute.test.ts` | Unit | `deactivateRoute` |
| `__tests__/getOperatorBus.int.test.ts` | Integration | `getOperatorBus` with live DB |
| `__tests__/listOperatorBuses.int.test.ts` | Integration | `listOperatorBuses` with live DB |
| `__tests__/windowsOverlap.test.ts` | Unit | `windowsOverlap` predicate |
| `__tests__/operatorPickupArea.test.ts` | Unit | Pickup area CRUD |
| `__tests__/pickupPlaceKind.test.ts` | Unit | `pickupPlaceKindToPickupKind` mapping |
| `__tests__/setRoutePickupAreas.test.ts` | Unit | `setRoutePickupAreas` |

---

## Design Patterns

1. **Tenant scoping** -- All queries use `withOperatorScope(operatorId, ...)` from `lib/core/db` to enforce operator isolation. This is the "one-way door" for operator-owned reads/writes (SYS20 rule 5).

2. **Discriminated results vs thrown errors** -- `deactivateBus` returns `{ ok: true/false, reason }` (discriminated result for idempotent-style operations). `createBus`/`updateBus`/routes/pickup areas throw typed error classes with `code` fields that route handlers map to HTTP status codes.

3. **Soft-delete pattern** -- Buses use `deactivatedAt: Date | null`. Routes use `deactivatedAt: Date | null`. Pickup areas use `isActive: boolean`. No hard deletes; historical references preserved.

4. **Pure vs DB functions** -- `canReduceCapacity`, `windowsOverlap`, and `pickupPlaceKindToPickupKind` are pure functions with no DB access. `getTripOccupancy` provides the DB snapshot that feeds `canReduceCapacity`.

5. **Shared select constants** -- `areaSelect` is defined once in `createOperatorPickupArea.ts` and reused by all pickup area query functions to keep the DTO shape consistent.

6. **Place resolution** -- Route creation/update resolves free-text origin/destination strings to canonical Place records via `lib/places`, storing both the text (back-compat) and the FK (`originPlaceId`, `destPlaceId`).

7. **Kind cascade** -- `updateOperatorPickupArea` cascades `kind` changes to TripPickupArea and TemplatePickupArea in the same `$transaction`, since kind is a display-grouping field rather than a historical-accuracy field.
