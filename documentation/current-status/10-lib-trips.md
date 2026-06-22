# 10 - lib/trips/ Domain Module

The `lib/trips/` directory implements the Trip lifecycle domain: creation, scheduling, departure, completion, cancellation, bus reassignment, sales control, public search, recurring template generation, and pickup-area management. All mutation functions enforce operator tenant isolation via `operatorId` scoping and use `$transaction` with `SELECT ... FOR UPDATE` to serialise concurrent writes (TOCTOU guard).

**Dependency flow:** `app/` and `components/` -> `lib/trips/` -> `lib/core/`, `lib/ledger/`, `lib/catalog/`, `lib/onboarding/`, `lib/logger/`

---

## Directory Structure

```
lib/trips/
  index.ts                    Barrel (public API)
  errors.ts                   TripServiceError tagged union
  tripDto.ts                  TripDto, TemplateDto type definitions
  toTripDto.ts                Prisma row -> TripDto mapper
  tripRef.ts                  Human-friendly trip display code
  schemas.ts                  Zod request body schemas
  createTrip.ts               Trip creation with bus validation
  cancelTrip.ts               Atomic cancel with booking/hold cascade + refunds
  markDeparted.ts             Mark departed + close sales
  markCompleted.ts            Mark completed + trigger payout job
  completeTripCore.ts         Shared in-tx completion logic (manual + auto)
  reassignBus.ts              Bus change with overlap/capacity guards
  salesToggle.ts              Open/close bookings flag
  searchTrips.ts              Public search with cursor pagination
  generateFromTemplate.ts     Recurring trip generation (cron) + template CRUD
  getTrip.ts                  Single trip + list queries (operator)
  getTripDetails.ts           Public trip detail for booking page
  listUpcomingForOperator.ts  Today's upcoming trips for operator dashboard
  busOverlap.ts               Bus availability window-vs-window overlap check
  snapshotPickupAreas.ts      Validate + snapshot pickup areas for trips/templates
  setTripPickupAreas.ts       Replace a trip's pickup-area subset
  __tests__/                  Unit + integration tests (see Test Files below)
```

---

## File Details

### errors.ts

**Purpose:** Typed error class for trip lifecycle operations (Issue 013). Error codes sourced verbatim from AC.

| Export | Kind | Description |
|--------|------|-------------|
| `TripErrorCode` | Type alias (union) | `'bus_in_maintenance' \| 'capacity_too_small' \| 'bus_deactivated' \| 'bus_overlap' \| 'bus_overlap_with_outbound' \| 'already_cancelled' \| 'trip_cancelled' \| 'trip_not_departed' \| 'invalid_pickup_area' \| 'not_found'` |
| `TripServiceErrorMeta` | Interface | `{ required?: number; provided?: number }` -- capacity mismatch metadata |
| `TripServiceError` | Class (extends Error) | Constructor `(code: TripErrorCode, meta?: TripServiceErrorMeta)`. Properties: `code`, `meta`, `name = 'TripServiceError'` |

---

### tripDto.ts

**Purpose:** Canonical DTO shapes returned by every GET trip response and template response.

| Export | Kind | Description |
|--------|------|-------------|
| `TripDto` | Interface | `{ id, routeId, busId, operatorId, departureAt (ISO), price, status ('scheduled'\|'departed'\|'cancelled'\|'completed'), salesClosed, capacity, holdsCount, bookingsCount, availableSeats, recurringTemplateId, pairedTripId, cancelReason, cancelledAt, routeOrigin?, routeDestination?, busLicensePlate? }` |
| `TemplateDto` | Interface | `{ id, operatorId, routeId, busId, departureLocalTime (HH:MM), daysOfMask, price, validFrom (YYYY-MM-DD), validUntil (YYYY-MM-DD), deactivatedAt }` |

---

### toTripDto.ts

**Purpose:** Converts a Prisma Trip row (with bus/route/count includes) to `TripDto`. Centralises field mapping to avoid drift between route handlers. `availableSeats = max(0, capacity - holdsCount - bookingsCount)`.

| Export | Kind | Description |
|--------|------|-------------|
| `toTripDto` | Function | `(row: TripRow) => TripDto` -- maps Prisma row with `bus`, `route?`, `_count` includes to the canonical DTO |

Internal type `TripRow` defines the expected shape: `{ id, routeId, busId, operatorId, departureAt (Date), price, status, salesClosed, recurringTemplateId, pairedTripId, cancelReason, cancelledAt, bus: { capacity, licensePlate? }, route?: { origin, destination }, _count: { holds, bookings } }`.

---

### tripRef.ts

**Purpose:** Human-friendly trip display code derived from the CUID (display-only, no DB field).

| Export | Kind | Description |
|--------|------|-------------|
| `tripRef` | Function | `(id: string) => string` -- returns `CHUYEN-<last 6 chars uppercased>` |

---

### schemas.ts

**Purpose:** Zod request body schemas for operator trip mutation routes (Issue 014). Depart and complete have no body.

| Export | Kind | Description |
|--------|------|-------------|
| `DepartTripSchema` | Zod schema | `z.object({}).strict()` -- empty strict body for depart action |
| `CompleteTripSchema` | Zod schema | `z.object({}).strict()` -- empty strict body for complete action |

---

### createTrip.ts

**Purpose:** Create a one-off operator trip (Issue 013 AC1). Validates bus ownership, active status, maintenance window overlap, and bus double-booking (window-vs-window). Runs inside `$transaction` with `SELECT ... FOR UPDATE` on the bus row. Optionally snapshots per-trip pickup areas (Issue 106).

| Export | Kind | Description |
|--------|------|-------------|
| `CreateTripInput` | Interface | `{ operatorId, routeId, busId, departureAt (Date), price, blockedSeats?, recurringTemplateId?, pairedTripId?, pickupAreaIds? }` |
| `createTrip` | Async function | `(input: CreateTripInput) => Promise<TripDto>` |

**Throws:** `TripServiceError` with codes `not_found`, `bus_deactivated`, `bus_in_maintenance`, `bus_overlap`, `invalid_pickup_area`.

**Transaction flow:**
1. Fetch route (operator-scoped) for duration -> compute candidate window end
2. `SELECT ... FOR UPDATE` on Bus row (serialise concurrent create/reassign)
3. Check deactivated, maintenance overlap, bus overlap via `busHasOverlappingTrip`
4. `trip.create` with status `scheduled`, `salesClosed: false`
5. If `pickupAreaIds` provided: `resolveOwnedAreas` + `tripPickupArea.createMany`

---

### cancelTrip.ts

**Purpose:** Atomically cancel a trip and cascade to bookings/holds/notifications (Issue 013 AC4). Uses discriminated result (not thrown error) for idempotent re-cancel (AC3). Post-commit refunds for paid bookings via `refundOut` (Issue 051).

| Export | Kind | Description |
|--------|------|-------------|
| `CancelTripResult` | Interface | `{ trip: TripDto, alreadyCancelled: boolean, cancelledBookings: number, cancelledHolds: number, notificationsEnqueued: number }` |
| `cancelTrip` | Async function | `(operatorId, tripId, cancelReason) => Promise<CancelTripResult>` |

**Throws:** `TripServiceError('not_found')` only.

**Transaction flow (single `$transaction` callback):**
1. `SELECT FOR UPDATE` Trip row
2. If already cancelled: return early with `alreadyCancelled: true` (idempotent)
3. Update Trip: `status='cancelled'`, `cancelledAt=now`, `cancelReason`
4. Fetch affected bookings (for notification payload)
5. Capture paid bookings for post-commit refund
6. Bulk-update bookings to `trip_cancelled`
7. Bulk-update active holds to `cancelled_trip`
8. Insert `NotificationLog` rows (template `trip_cancelled`) per affected booking

**Post-commit:** Iterates paid bookings and calls `refundOut` with idempotency key `cancel:<tripId>:<bookingId>`. Failures are logged but do not undo the cancellation.

---

### markDeparted.ts

**Purpose:** Operator marks trip as departed (Issue 014 AC5). Sets `departedAt` + `status='departed'` + `salesClosed=true` in the same `tx.trip.update` call. Discriminated result with idempotent re-depart.

| Export | Kind | Description |
|--------|------|-------------|
| `MarkDepartedResult` | Interface | `{ ok: true, alreadyDeparted: boolean, trip: TripDto }` |
| `markDeparted` | Async function | `(operatorId, tripId) => Promise<MarkDepartedResult>` |

**Throws:** `TripServiceError` with codes `not_found`, `trip_cancelled`.

**Transaction flow:**
1. `SELECT FOR UPDATE` on Trip row
2. If cancelled: throw `trip_cancelled`
3. If already departed: return `alreadyDeparted: true`
4. Update: `departedAt=now`, `status='departed'`, `salesClosed=true`

---

### markCompleted.ts

**Purpose:** Operator marks trip as completed (Issue 014 AC5). Thin `$transaction` wrapper over `completeTripCore`. Triggers payout job creation.

| Export | Kind | Description |
|--------|------|-------------|
| `MarkCompletedResult` | Interface | `{ ok: true, alreadyCompleted: boolean, trip: TripDto, payoutJobsEnqueued: number }` |
| `markCompleted` | Async function | `(operatorId, tripId) => Promise<MarkCompletedResult>` |

Delegates to `completeTripCore` inside a `$transaction`, then maps the result to `MarkCompletedResult` with `toTripDto`.

---

### completeTripCore.ts

**Purpose:** The in-transaction core of trip completion (Issue 014 + Issue 019). Shared by `markCompleted` (operator-initiated) and the `autoCompleteTrips` cron job (sweeps departed trips past their duration). Handles idempotency, status/completedAt write, payout_scheduled audit NotificationLog rows, and aggregate Payout row creation.

| Export | Kind | Description |
|--------|------|-------------|
| `CompletedTripRow` | Type | Prisma TripGetPayload with bus capacity + hold/booking counts |
| `CompleteTripCoreResult` | Interface | `{ alreadyCompleted: boolean, trip: CompletedTripRow, paidBookingCount: number, payoutCreated: boolean }` |
| `completeTripCore` | Async function | `(tx: TransactionClient, input: { tripId, operatorId, now? }) => Promise<CompleteTripCoreResult>` |

**Throws:** `TripServiceError` with codes `not_found`, `trip_cancelled`, `trip_not_departed`.

**Constants:**
- `PAYOUT_ELIGIBLE_STATUSES` = `['paid', 'completed']`
- `ONE_DAY_MS` = 86400000 (T+1 settlement delay, S15#5)

**Transaction flow (runs inside caller's tx):**
1. `SELECT FOR UPDATE` on Trip row
2. If cancelled: throw `trip_cancelled`
3. If not departed: throw `trip_not_departed`
4. If already completed: return `alreadyCompleted: true`
5. Update: `completedAt=now`, `status='completed'`
6. Fetch paid bookings -> create `payout_scheduled` NotificationLog rows with `scheduledFor` (top-level column, not JSON payload)
7. Create aggregate Payout row: `gross`, `platformFee`, `net` via `calcPayout`, status `requested`, `scheduledAt = completedAt + 1 day`

---

### reassignBus.ts

**Purpose:** Assign a different bus to a scheduled trip (Issue 013 AC3). Validates deactivated, maintenance, capacity, and bus overlap. Also handles ticket PDF invalidation and bus-reassigned notification (Issue 075).

| Export | Kind | Description |
|--------|------|-------------|
| `reassignBus` | Async function | `(operatorId, tripId, newBusId) => Promise<TripDto>` |

**Throws:** `TripServiceError` with codes `not_found`, `bus_deactivated`, `bus_in_maintenance`, `capacity_too_small` (with `{ required, provided }` meta), `bus_overlap_with_outbound`.

**Constants:**
- `PAID_TICKET_STATUSES` = `['paid', 'completed', 'no_show']`

**Transaction flow:**
1. `SELECT FOR UPDATE OF t` on Trip (join Route for duration/origin/destination)
2. Validate new bus: ownership, active, maintenance, capacity (activeHolds + confirmedBookings + blockedSeats <= capacity)
3. Bus overlap check via `busHasOverlappingTrip` (excludes current trip)
4. `trip.update` with new `busId`
5. Invalidate `ticketPdfKey`/`ticketPdfGeneratedAt` for affected paid bookings (re-arms 074 cron)
6. Upsert `busReassigned` NotificationLog per affected booking (compound unique `bookingId_template`)

---

### salesToggle.ts

**Purpose:** Flip `salesClosed` on a trip (Issue 013 AC7). Does not touch bookings or holds.

| Export | Kind | Description |
|--------|------|-------------|
| `salesToggle` | Async function | `(operatorId, tripId, salesClosed: boolean) => Promise<TripDto>` |

**Throws:** `TripServiceError('not_found')`.

Uses `SELECT FOR UPDATE` to serialise concurrent writes. Cross-operator guard via `withOperatorScope`.

---

### searchTrips.ts

**Purpose:** Server-side trip search for the public `/search` page and API route. Cursor/seek pagination (Issue 097) with stable `(departureAt, id)` order. Availability computed as `capacity - activeHolds - paidBookings` (never raw capacity). Diacritic-insensitive route matching via `unaccent_immutable ILIKE`.

| Export | Kind | Description |
|--------|------|-------------|
| `SEARCH_PAGE_LIMIT` | Constant | `20` -- default page size |
| `TripSearchInput` | Interface | `{ origin, destination, date (YYYY-MM-DD VN wall-clock), ticketCount, limit?, cursor? }` |
| `TripSearchPage` | Interface | `{ trips: TripResult[], nextCursor: string \| null }` |
| `TripResult` | Interface | `{ tripId, departureAt (ISO), price, availableSeats, operatorLegalName, operatorId, busType, durationMinutes, routeOrigin, routeDestination }` |
| `searchTrips` | Async function | `(input: TripSearchInput) => Promise<TripSearchPage>` |
| `encodeCursor` | Re-export | From `@/lib/core/db/searchCursor` |
| `decodeCursor` | Re-export | From `@/lib/core/db/searchCursor` |

**Query flow (3 bounded queries, no N+1):**
1. Route-id lookup: `unaccent_immutable ILIKE` on origin + destination, excluding deactivated/moderated routes
2. Trip rows: Prisma `findMany` with filters (scheduled, not salesClosed, not moderated, approved operator, bus capacity >= ticketCount, maintenance window exclusion)
3. Hold sums + booking sums: two raw SQL aggregates grouped by tripId

**Post-query in-memory:**
- Compute available seats per trip, filter by ticketCount
- Apply compound seek predicate `(departureAt, id) > cursor`
- Slice to limit + 1 for next-page detection

**Date handling:** Converts VN wall-clock date (Asia/Ho_Chi_Minh) to UTC range. Floors lower bound at `now` so already-departed same-day trips are excluded.

---

### generateFromTemplate.ts

**Purpose:** Cron worker that generates Trip rows from `RecurringTripTemplate` records over a 14-day horizon (Issue 013 AC5). Also contains template CRUD helpers. Idempotent via `findFirst` check on `(recurringTemplateId, departureAt)`. Skip reasons logged to `RecurringGenerationLog`.

| Export | Kind | Description |
|--------|------|-------------|
| `GenerateResult` | Interface | `{ generated: number, skipped: number, failed: number }` |
| `generateTripsFromTemplates` | Async function | `(referenceDate?: Date) => Promise<GenerateResult>` -- cron entrypoint |
| `toTemplateDto` | Function | `(t: {...}) => TemplateDto` -- maps Prisma row to TemplateDto |
| `createTemplate` | Async function | `(operatorId, input) => Promise<TemplateDto>` |
| `getTemplate` | Async function | `(operatorId, templateId) => Promise<TemplateDto \| null>` |
| `listTemplates` | Async function | `(operatorId) => Promise<TemplateDto[]>` |
| `patchTemplate` | Async function | `(operatorId, templateId, patch) => Promise<TemplateDto \| null>` |

**Constants:**
- `TZ` = `'Asia/Ho_Chi_Minh'`
- `HORIZON_DAYS` = `14`
- `WEEKDAY_BIT` = ISO weekday -> bitmask (Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64)

**Generation flow (per template, per day in horizon):**
1. Check `validFrom`/`validUntil` bounds
2. Check `daysOfMask` bitmask against ISO weekday
3. Compute departure UTC from local `HH:MM` via `fromZonedTime`
4. Check bus availability (deactivated / maintenance overlap)
5. Skip logging to `RecurringGenerationLog` if bus unavailable
6. Inside `$transaction`: check for existing trip (idempotent), create trip + pickup areas, log generation

**Template CRUD:**
- `createTemplate`: creates template + snapshots pickup areas (Issue 106)
- `getTemplate`: operator-scoped `findFirst`
- `listTemplates`: operator-scoped `findMany`, ordered by `createdAt`
- `patchTemplate`: operator-scoped update with atomic `{ id, operatorId }` write (TOCTOU guard)

---

### getTrip.ts

**Purpose:** Fetch trip(s) belonging to an operator (I2: cross-op returns null).

| Export | Kind | Description |
|--------|------|-------------|
| `getTrip` | Async function | `(operatorId, tripId) => Promise<TripDto \| null>` -- single trip with route origin/destination and bus license plate |
| `listTrips` | Async function | `(operatorId, opts?: { routeId?, fromDate?, toDate?, status? }) => Promise<TripDto[]>` -- filtered list, ordered by departureAt ASC |

Both include bus capacity, hold/booking counts for availability computation via `toTripDto`.

---

### getTripDetails.ts

**Purpose:** Full trip detail for the public `/trips/[id]` page. Returns null when trip is not bookable (not scheduled, salesClosed, already departed, moderated, or non-approved operator) so the page can render `notFound()`.

| Export | Kind | Description |
|--------|------|-------------|
| `TripDetails` | Interface | `{ tripId, departureAt (ISO), price, availableSeats, capacity, busType, durationMinutes, routeOrigin, routeDestination, operatorLegalName, operatorContactPhone, pickupAreas: { label }[] }` |
| `getTripDetails` | Async function | `(id: string) => Promise<TripDetails \| null>` |

**Gates (returns null):**
- Trip not found
- Operator not search-visible (Issue 046 approval gate via `isSearchVisible`)
- Trip or route moderated (Issue 069)
- Not `scheduled` or `salesClosed`
- `departureAt <= now` (already departed)

**Availability:** `capacity - activeHolds - paidBookings` via parallel aggregates on Hold and Booking.

---

### listUpcomingForOperator.ts

**Purpose:** Paginated upcoming trips for operator dashboard (Issue 014). Sorted by `departureAt ASC`. Tenant-isolated. Excludes cancelled trips.

| Export | Kind | Description |
|--------|------|-------------|
| `ListUpcomingParamsSchema` | Zod schema | `{ routeId?: string, limit: number (1-100, default 50), cursor?: string }` |
| `ListUpcomingParams` | Type | `z.input<typeof ListUpcomingParamsSchema>` |
| `ListUpcomingResult` | Interface | `{ trips: TripDto[], nextCursor: string \| null }` |
| `listUpcomingForOperator` | Async function | `(operatorId, params?) => Promise<ListUpcomingResult>` |

Filters: `status in ['scheduled', 'departed']`, `departureAt >= now`, optional `routeId`. Pagination via `take = limit + 1` with cursor-based id comparison.

---

### busOverlap.ts

**Purpose:** Shared window-vs-window overlap check for bus double-booking guard. A trip occupies its bus for `[departureAt, departureAt + routeDuration + buffer]`. Must be called inside a `$transaction` that holds a `FOR UPDATE` lock on the bus row.

| Export | Kind | Description |
|--------|------|-------------|
| `TRIP_OVERLAP_BUFFER_MINUTES` | Constant | `60` -- turnaround time buffer in minutes |
| `BusOverlapParams` | Interface | `{ busId, candidateStart (Date), candidateEnd (Date), excludeTripId? }` |
| `busHasOverlappingTrip` | Async function | `(tx: TransactionClient, params: BusOverlapParams) => Promise<boolean>` -- raw SQL window overlap check |
| `tripWindowEnd` | Function | `(departureAt: Date, routeDurationMinutes: number) => Date` -- computes occupancy window end |

**SQL overlap predicate:** `candidateStart <= existingEnd AND candidateEnd >= existingStart` where existing end = `departureAt + (durationMinutes + 60) * interval '1 minute'`. Only checks non-cancelled trips (`status IN ('scheduled', 'departed')`).

---

### snapshotPickupAreas.ts

**Purpose:** Shared owned-area validation + snapshot helpers for the three per-trip/per-template pickup-area write paths (`createTrip`, `setTripPickupAreas`, `generateFromTemplate`). Extracted to avoid logic drift (Issue 110/112).

| Export | Kind | Description |
|--------|------|-------------|
| `OwnedPickupArea` | Interface | `{ id, name, addressLine: string \| null, kind: 'station' \| 'pickup' }` |
| `resolveOwnedAreas` | Async function | `(tx, operatorId, areaIds, routeId?) => Promise<OwnedPickupArea[]>` -- validates all ids are operator-owned, active, optionally route-scoped. Throws `TripServiceError('invalid_pickup_area')` on mismatch |
| `PickupAreaSnapshotRow` | Interface | `{ operatorPickupAreaId, label, kind, displayOrder }` |
| `toPickupAreaRows` | Function | `(owned: OwnedPickupArea[]) => PickupAreaSnapshotRow[]` -- maps areas to createMany row shape, snapshots label + kind |

---

### setTripPickupAreas.ts

**Purpose:** Replace a trip's enabled pickup-area subset (operator edit). Validates ownership and re-snapshots current area labels. Runs in `$transaction`.

| Export | Kind | Description |
|--------|------|-------------|
| `TripPickupAreaItem` | Interface | `{ areaId: string, label: string }` |
| `setTripPickupAreas` | Async function | `(input: { operatorId, tripId, pickupAreaIds }) => Promise<TripPickupAreaItem[]>` |

**Throws:** `TripServiceError('not_found')` if trip does not belong to operator, `TripServiceError('invalid_pickup_area')` via `resolveOwnedAreas`.

**Flow:** Clear existing `TripPickupArea` rows -> create fresh snapshots -> return the new set.

---

## Barrel (index.ts)

All public exports from the barrel:

| Symbol | Source File |
|--------|-------------|
| `generateTripsFromTemplates` | `generateFromTemplate.ts` |
| `cancelTrip` | `cancelTrip.ts` |
| `completeTripCore` | `completeTripCore.ts` |
| `createTrip` | `createTrip.ts` |
| `TripServiceError` | `errors.ts` |
| `createTemplate` | `generateFromTemplate.ts` |
| `getTemplate` | `generateFromTemplate.ts` |
| `listTemplates` | `generateFromTemplate.ts` |
| `patchTemplate` | `generateFromTemplate.ts` |
| `getTrip` | `getTrip.ts` |
| `listTrips` | `getTrip.ts` |
| `getTripDetails` | `getTripDetails.ts` |
| `listUpcomingForOperator` | `listUpcomingForOperator.ts` |
| `ListUpcomingParamsSchema` | `listUpcomingForOperator.ts` |
| `markCompleted` | `markCompleted.ts` |
| `markDeparted` | `markDeparted.ts` |
| `reassignBus` | `reassignBus.ts` |
| `salesToggle` | `salesToggle.ts` |
| `setTripPickupAreas` | `setTripPickupAreas.ts` |
| `TripPickupAreaItem` (type) | `setTripPickupAreas.ts` |
| `searchTrips` | `searchTrips.ts` |
| `SEARCH_PAGE_LIMIT` | `searchTrips.ts` |
| `TripResult` (type) | `searchTrips.ts` |
| `toTripDto` | `toTripDto.ts` |
| `TripDto` (type) | `tripDto.ts` |
| `TemplateDto` (type) | `tripDto.ts` |
| `tripRef` | `tripRef.ts` |

**Not exported from barrel** (internal): `busHasOverlappingTrip`, `tripWindowEnd`, `TRIP_OVERLAP_BUFFER_MINUTES`, `BusOverlapParams`, `resolveOwnedAreas`, `toPickupAreaRows`, `OwnedPickupArea`, `PickupAreaSnapshotRow`, `CreateTripInput`, `CancelTripResult`, `MarkDepartedResult`, `MarkCompletedResult`, `CompleteTripCoreResult`, `CompletedTripRow`, `TripSearchInput`, `TripSearchPage`, `GenerateResult`, `toTemplateDto`, `TripDetails`, `ListUpcomingResult`, `ListUpcomingParams`, `DepartTripSchema`, `CompleteTripSchema`, `encodeCursor`, `decodeCursor`.

---

## Test Files

| File | Type | Coverage |
|------|------|----------|
| `__tests__/createTrip.test.ts` | Unit | Trip creation, bus validation, maintenance, overlap |
| `__tests__/createTrip.int.test.ts` | Integration | Trip creation against live DB |
| `__tests__/cancelTrip.test.ts` | Unit | Atomic cancel, idempotent re-cancel, refund cascade |
| `__tests__/reassignBus.test.ts` | Unit | Bus reassignment, capacity guard, overlap guard |
| `__tests__/reassignBus.int.test.ts` | Integration | Bus reassignment against live DB |
| `__tests__/salesToggle.test.ts` | Unit | Sales open/close toggle |
| `__tests__/recurringGenerator.test.ts` | Unit | Template-based trip generation, horizon, day mask, idempotency |
| `__tests__/searchTrips.int.test.ts` | Integration | Public search, availability, route matching |
| `__tests__/searchTrips.pagination.int.test.ts` | Integration | Cursor/seek pagination (Issue 097) |
| `__tests__/tripLifecycle.int.test.ts` | Integration | Full lifecycle: create -> depart -> complete, payout creation |

---

## Key Design Patterns

1. **Discriminated results over thrown errors for idempotent operations** -- `cancelTrip`, `markDeparted`, `markCompleted` return `{ alreadyCancelled/alreadyDeparted/alreadyCompleted: boolean }` instead of throwing on re-invocation (per AC specs for 200 + discriminator).

2. **$transaction callback form + SELECT FOR UPDATE** -- Every mutation uses `prisma.$transaction(async (tx) => ...)` with a leading `SELECT ... FOR UPDATE` on the gating row to serialise concurrent writes. Never uses the array form.

3. **Timestamp + status in same update** -- State transitions write both the timestamp column (`departedAt`, `completedAt`, `cancelledAt`) and the `status` enum in the same `tx.model.update` call (Mistake Log rule).

4. **Post-commit side effects** -- `cancelTrip` runs refunds AFTER the cancel transaction commits (refundOut opens its own transaction). Failed refunds are logged but do not undo the cancellation.

5. **Tagged error propagation** -- Inside transactions, errors are thrown as `Object.assign(new Error(code), { _trip: code })` and re-caught + re-thrown as `TripServiceError` after the transaction boundary (Prisma wraps transaction errors, so the tag survives).

6. **Operator tenant isolation** -- All queries use `withOperatorScope(operatorId)` or explicit `operatorId` WHERE clauses. Cross-operator access returns `not_found`.

7. **Pickup area snapshot** -- Labels and kinds are snapshotted at trip/template creation time via `snapshotPickupAreas.ts` so later renames do not retroactively change existing records.
