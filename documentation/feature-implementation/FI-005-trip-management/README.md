# FI-005: Trip Management (Quan ly chuyen xe)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-009, ADR-019, DS-001, DS-003, FD-022

## Overview

FI-005 covers the full lifecycle of individual trips -- the bookable unit of the platform. A Trip is a specific scheduled departure on a Route by a Bus at a fixed VND price. It is the entity that customers search for, hold seats on, and book. Operators (Nha Xe) create trips (one-off or via recurring templates), manage their status lifecycle (scheduled -> departed -> completed, or cancelled), view the passenger manifest, and trigger the payout pipeline at completion. The Trip state machine is one of eight canonical state machines in the platform, and its transitions carry direct financial consequences (refunds on cancel, payouts on complete).

## Scope & Boundaries

### In Scope

- CRUD for `Trip` records (one-off trip creation)
- Recurring trip template CRUD (`RecurringTripTemplate`)
- Automatic trip generation from templates via daily cron (`generateFromTemplate`)
- Trip lifecycle transitions: scheduled -> departed, scheduled/departed -> cancelled, departed -> completed
- `salesClosed` toggle (orthogonal to status)
- Bus reassignment for scheduled trips
- Paired return trip creation (`pairedTripId`)
- Passenger manifest view (`GET /api/op/trips/:id/manifest`)
- Booking operations on a trip: check-in, no-show, cash payment confirmation, contact status update
- Payout creation on trip completion (T+1 settlement)
- Staff assignment to trips (`StaffTripAssignment`)
- Trip cancellation cascade (bookings -> `trip_cancelled`, holds -> `cancelled_trip`, refunds enqueued)
- `RecurringGenerationLog` deduplication

### Out of Scope

- Customer-facing trip search -> [FI-006](../FI-006-search-discovery/README.md)
- Hold creation -> [FI-007](../FI-007-booking-flow/README.md) (Booking Context)
- Payment processing -> [FI-008](../FI-008-payment-integration/README.md) (Payment Context)
- Payout settlement mechanics -> [FI-010](../FI-010-payout-system/README.md) (Finance/Ledger Context)
- Bus/Route definition -> [FI-003](../FI-003-fleet-management/README.md) and [FI-004](../FI-004-route-management/README.md)

### Bounded Context(s)

- **Fleet/Catalog Context** (Section 2) -- Trip definition, scheduling, lifecycle management
- **Booking Context** (Section 3) -- Hold/booking consumption of trip capacity
- **Finance/Ledger Context** (Section 5) -- Payout creation on completion

**Dependencies:**
- [FI-003](../FI-003-fleet-management/README.md): requires Bus records (capacity, busType, maintenanceStart/End for overlap guard)
- [FI-004](../FI-004-route-management/README.md): requires Route records (origin/destination, durationMinutes for overlap window)
- [FI-003](../FI-003-fleet-management/README.md) OperatorPickupArea records linked via TripPickupArea at trip creation (snapshot)
- Finance/Ledger Context reads Trip.completedAt for T+1 settlement eligibility

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Trip | `id` (CUID PK), `routeId` (FK->Route, NOT NULL), `busId` (FK->Bus, NOT NULL), `operatorId` (FK->Operator, NOT NULL -- denormalized from Route), `departureAt` (DateTime, NOT NULL), `price` (Int, NOT NULL -- VND integer; I7-exempt for `/api/op/**`), `status` (TripStatus: scheduled/departed/completed/cancelled, `@default(scheduled)`), `salesClosed` (Boolean, NOT NULL, `@default(false)`), `blockedSeats` (Int, NOT NULL, `@default(0)`), `cancelReason` (String, nullable), `cancelledAt` (DateTime, nullable), `moderatedAt` (DateTime, nullable -- admin kill switch), `departedAt` (DateTime, nullable), `completedAt` (DateTime, nullable), `recurringTemplateId` (FK->RecurringTripTemplate, nullable), `pairedTripId` (self-ref FK->Trip, nullable), `cancellationPolicyId` (FK->CancellationPolicy, onDelete: SetNull, nullable), `updatedAt` | `@@index([status, departureAt])`, `@@index([routeId, departureAt])`, `@@index([operatorId])`, `@@index([recurringTemplateId])`, `@@index([pairedTripId])`; SQL-only partial unique: `(recurringTemplateId, departureAt) WHERE recurringTemplateId IS NOT NULL` | `operatorId` denormalized for tenant scoping without join. `salesClosed` orthogonal to `status`. Timestamp columns must ALWAYS be written with corresponding `status` change (ADR-019 D4). `price` is mutable; price at booking captured in `Booking.totalVnd`. |
| RecurringTripTemplate | `id` (CUID PK), `operatorId` (FK->Operator, NOT NULL), `routeId` (FK->Route, NOT NULL), `busId` (FK->Bus, NOT NULL), `price` (Int, NOT NULL -- VND), `departureLocalTime` (String, NOT NULL -- HH:MM in Asia/Ho_Chi_Minh), `daysOfMask` (Int, NOT NULL -- bitmask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64; range 1-127), `validFrom` (DateTime, NOT NULL, `@db.Date`), `validUntil` (DateTime, NOT NULL, `@db.Date`), `deactivatedAt` (DateTime, nullable), `createdAt`, `updatedAt` | `@@index([operatorId])`, `@@index([routeId])`, `@@index([busId])` | Tenant-scoped via `operatorId`. `departureLocalTime` stored as HH:MM string; daily cron interprets in Asia/Ho_Chi_Minh timezone. |
| RecurringGenerationLog | `id` (CUID PK), `templateId` (FK->RecurringTripTemplate, onDelete: Cascade), `tripId` (FK->Trip, onDelete: SetNull, nullable), `date` (DateTime, NOT NULL, `@db.Date`), `status` (String: 'generated'/'skipped'/'failed', `@default("generated")`), `skipReason` (String, nullable), `createdAt` | `@@index([templateId])`, `@@index([date])` | Deduplication log for `generateFromTemplate` cron. Combined with SQL-only partial unique on Trip to prevent double-generation. |
| StaffTripAssignment | `id` (CUID PK), `operatorUserId` (FK->OperatorUser, onDelete: Cascade), `tripId` (FK->Trip, onDelete: Cascade), `assignedAt` (DateTime, `@default(now())`), `role` (String, nullable -- 'driver'/'conductor'/'checker') | `@@unique([operatorUserId, tripId])`, `@@index([tripId])`, `@@index([operatorUserId])` | Operator-scoped via OperatorUser.operatorId. Supports multi-trip and multi-role assignment. |
| CancellationPolicy | `id` (CUID PK), `operatorId` (FK->Operator, NOT NULL), `name` (String, NOT NULL), `rules` (Json, NOT NULL -- array of `{ hoursBeforeDeparture, refundPercentage }`), `isDefault` (Boolean, NOT NULL, `@default(false)` -- at most one per operator), `effectiveFrom` (DateTime, NOT NULL), `createdAt` | `@@index([operatorId])` | CPL 2023 compliance. Displayed to customer at booking time. `rules` validated at API boundary via Zod. |
<!-- Phase 2: TripPickupArea deferred to post-launch (trigger: 4 operators). Phase 1 = station-only. -->
| TripPickupArea | `id` (CUID PK), `tripId` (FK->Trip, onDelete: Cascade), `operatorPickupAreaId` (FK->OperatorPickupArea, onDelete: Cascade), `label` (String, NOT NULL -- snapshot), `kind` (PickupPlaceKind -- snapshot), `displayOrder` (Int) | `@@unique([tripId, operatorPickupAreaId])`, `@@index([tripId, displayOrder])` | Snapshot taken at trip creation (survives menu edits). |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/op/trips` | Operator JWT | Create one-off trip. Body: `{ routeId, busId, departureAt, price, blockedSeats?, cancellationPolicyId? }`. I7-exempt. Guards: bus overlap + maintenance overlap inside `$transaction`. | 201, 409 `MAINTENANCE_OVERLAP`, 409 `BUS_OVERLAP`, 404 |
| POST | `/api/op/trips/:id/paired-return` | Operator JWT | Create paired return trip. Links via `pairedTripId`. | 201, 422 `BUS_OVERLAP_WITH_OUTBOUND` (SPEC CONFLICT: 422 here, 409 in reassignBus), 404 |
| POST | `/api/op/trips/:id/cancel` | Operator JWT | Cancel trip. Idempotent. Cascade: holds -> `cancelled_trip`, bookings -> `trip_cancelled`, refunds enqueued. | 200 `{ trip, alreadyCancelled, cancelledBookings }`, 404 |
| POST | `/api/op/trips/:id/close-sales` | Operator JWT | Toggle `salesClosed` flag. | 200, 404 |
| POST | `/api/op/trips/:id/depart` | Operator JWT | Mark departed. Sets `salesClosed = true`, `departedAt = now()`, `status = 'departed'`. | 200, 422 `INVALID_STATE_TRANSITION`, 404 |
| POST | `/api/op/trips/:id/complete` | Operator JWT | Mark completed. Creates Payout. Enqueues `payout_scheduled` NotificationLog with `scheduledFor` top-level column. | 200, 422 `INVALID_STATE_TRANSITION`, 404 |
| PATCH | `/api/op/trips/:id/reassign-bus` | Operator JWT | Reassign bus. Bus overlap check. | 200, 409 `BUS_OVERLAP`, 404 |
| GET | `/api/op/bookings` | Operator JWT | List bookings. Filters: `serviceDate` (UTC+7), `status`, `contactStatus`, `cursor`, `limit`. | 200 `{ items, nextCursor }` |
| POST | `/api/op/bookings/:id/check-in` | Operator JWT | Boarding confirmation. SET-ONCE via atomic `UPDATE WHERE checkedInAt IS NULL`. | 200, 422, 404 |
| POST | `/api/op/bookings/:id/no-show` | Operator JWT | Mark no-show. Guard: `checkedInAt IS NULL`. | 200, 422, 404 |
| PATCH | `/api/op/bookings/:id/contact-status` | Operator JWT | Update call-queue tracking. Body: `{ contactStatus: 'pending'\|'reached'\|'no_answer'\|'callback' }` | 200, 404 |
| POST | `/api/op/bookings/:id/confirm-cash` | Operator JWT | Confirm cash payment. Transitions `awaiting_payment -> paid`. | 200, 422 `INVALID_STATE_TRANSITION`, 404 |
| GET | `/api/op/trips/:id/manifest` | Operator JWT | Passenger manifest for BGTVT inspection. | 200, 404 |
| POST | `/api/op/trips/:id/assign-staff` | Operator JWT | Assign staff to trip. Body: `{ operatorUserId, role? }` | 201, 404 |
| POST | `/api/op/recurring-templates` | Operator JWT | Create recurring template. Body: `{ routeId, busId, price, departureLocalTime, daysOfMask, validFrom, validUntil }` | 201, 400 |
| POST | `/api/op/cancellation-policies` | Operator JWT | Create cancellation policy. Body: `{ name, rules, isDefault?, effectiveFrom }` | 201, 400 |

### Cron Jobs

| Route | Job | Schedule | Description |
|-------|-----|----------|-------------|
| `/api/cron/generate-from-template` | generateFromTemplate | Daily | Generates Trip rows for 14-day rolling horizon from active templates. Dedup via RecurringGenerationLog + partial unique index. |
| `/api/cron/auto-complete-trips` | autoCompleteTrips | Every 15 min | Transitions `departed` trips past arrival window to `completed`. |
| `/api/cron/expire-holds` | expireHolds | Every 1 min | Batch-expires active holds with `expiresAt < NOW()` (500/batch, `FOR UPDATE SKIP LOCKED`). |

## State Machine

### Trip Status

**States:** `scheduled` | `departed` | `completed` | `cancelled`

**Additional flag:** `salesClosed` (boolean, orthogonal to status -- can be toggled independently)

| From | To | Trigger | Guard |
|------|----|---------|-------|
| `scheduled` | `departed` | `markDeparted` (operator action) | Not cancelled. `SELECT FOR UPDATE` on Trip. |
| `departed` | `completed` | `completeTripCore` (operator action or `autoCompleteTrips` cron) | `departedAt IS NOT NULL`. Not cancelled. `SELECT FOR UPDATE` on Trip. |
| `scheduled` | `cancelled` | `cancelTrip` (operator action) | `SELECT FOR UPDATE` on Trip. |
| `departed` | `cancelled` | `cancelTrip` (operator action) | `SELECT FOR UPDATE` on Trip. |
| `completed` | `cancelled` | `cancelTrip` (operator action) | `SELECT FOR UPDATE` on Trip. |

### Side Effects

| Transition | Side Effects |
|------------|-------------|
| -> `departed` | Sets `departedAt = NOW()`, `salesClosed = true`. |
| -> `completed` | Sets `completedAt = NOW()`. Creates Payout row (`status = 'requested'`, `scheduledAt = completedAt + 1d`). Enqueues `payout_scheduled` NotificationLog per paid booking with `scheduledFor` as top-level column. |
| -> `cancelled` | Sets `cancelledAt = NOW()`, `cancelReason`. Cascades: bulk-update Bookings to `trip_cancelled`, Holds to `cancelled_trip`. Enqueues `trip_cancelled` SMS per affected booking. Post-commit: `refundOut` per paid booking. |

### Idempotency

- `markDeparted`: if `departedAt IS NOT NULL`, returns `{ alreadyDeparted: true }` without modification.
- `completeTripCore`: if `completedAt IS NOT NULL`, returns `{ alreadyCompleted: true }` without modification.
- `cancelTrip`: if `status === 'cancelled'`, returns `{ alreadyCancelled: true, cancelledBookings: 0 }` (HTTP 200, discriminated result -- no throw).

### salesClosed Toggle

`salesClosed` can be toggled independently via `lib/trips/salesToggle.ts` (under `SELECT FOR UPDATE`). `markDeparted` forces `salesClosed = true` as a side effect. A `scheduled` trip can have `salesClosed = true` (operator manually closes early).

## Business Rules & Invariants

1. **Bus Overlap Guard** -- Same bus cannot serve two trips with overlapping time windows `[departureAt, departureAt + route.durationMinutes + 60 min buffer]`. Enforced in `lib/trips/busOverlap.ts`, called from `createTrip`, `reassignBus`, and `pairedReturn`. Runs inside the Bus row's `FOR UPDATE` transaction. Error codes: 409 `BUS_OVERLAP` (reassignBus), 422 `BUS_OVERLAP_WITH_OUTBOUND` (pairedReturn -- SPEC CONFLICT, deferred).

2. **Maintenance Window Overlap** -- Trip window must not overlap bus maintenance `[maintenanceStart, maintenanceEnd]`. Enforced in `createTrip` and `reassignBus` inside `$transaction`. Returns 409 `MAINTENANCE_OVERLAP`. Search exclusion uses window-vs-window overlap (Mistake Log Issue 001).

3. **salesClosed Gate** -- `salesClosed = true` blocks new holds (conditional INSERT requires `salesClosed = false`). Enforced in `lib/trips/searchTrips.ts`, `lib/core/db/holdRepo.ts`, `lib/trips/markDeparted.ts`, `lib/trips/salesToggle.ts`.

4. **I7 -- No Client-Originated Price** -- Customer-facing endpoints NEVER accept `price` from request body. `totalVnd = Trip.price * ticketCount` at booking time. Exception: `/api/op/trips` POST is I7-exempt (operator IS price authority). Each I7-exempt site carries `// I7-exempt:` inline comment.

5. **I1 -- SELECT FOR UPDATE** -- All Trip status transitions run inside `$transaction(async (tx) => { ... })` callback form + `SELECT FOR UPDATE` on Trip row. Concurrent transition attempts serialized.

6. **ADR-019 D4 -- Timestamp + Status Written Together** -- `departedAt` must write `status: 'departed'` in same update call. `completedAt` must write `status: 'completed'`. `cancelledAt` must write `status: 'cancelled'`. Failure leaves Trip in inconsistent state (Mistake Log Issue 014).

7. **ADR-019 D6 -- Idempotent Transitions Use Discriminated Result** -- `cancelTrip` returns `{ trip, alreadyCancelled: true }` at HTTP 200 when already cancelled. Never throw sentinel error for idempotent transitions. Idempotency check inside existing `$transaction`.

8. **Payout Creation on Completion (I11 -- T+1 Settlement)** -- `completeTripCore` creates `Payout(requested, scheduledAt = completedAt + 1 day)`. `payout_scheduled` NotificationLog must use `scheduledFor` as top-level column (NOT in JSON payload) with `@@index([template, scheduledFor])` (Mistake Log Issue 014).

9. **Three-Layer Capacity Guard (ADR-009 D7)** -- L1 at Hold creation: conditional INSERT checks capacity formula. Advisory locks: phone-first then trip. L2 at payment webhook: `SELECT FOR UPDATE` on Trip + recount; overflow -> `status = 'refunded'`. L3: per-phone hold cap via phone-level advisory lock.

10. **Recurring Trip Deduplication** -- SQL-only partial unique index on Trip `(recurringTemplateId, departureAt) WHERE recurringTemplateId IS NOT NULL` plus `RecurringGenerationLog` per template+date.

11. **Operator Bookable Gate** -- Every hold creation re-verifies `operator.status IN ['APPROVED']` (not just at search time). Closes suspend-after-search race.

12. **Booking Check-In Mutual Exclusivity** -- `checkedInAt` is SET-ONCE via `WHERE "checkedInAt" IS NULL` atomic conditional UPDATE. `checkedInAt` and `noShowAt` are mutually exclusive.

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Trip List | `/op/trips` | Table: Ngay, Tuyen, Xe, Gio di, Cho (booked/capacity), Gia ("350.000 d"), Trang thai badge | Filters: date range, route, status, bus. Card layout on mobile. |
| Trip Create Form | `/op/trips` (modal/panel) | Tuyen dropdown, Xe dropdown, Ngay di, Gio di (HH:MM "Gio Viet Nam, UTC+7"), Gia ve (VND integer), pickup checkboxes | VND input: raw integer on focus, formatted on blur with dot separator |
| Paired Return | `/op/trips` (from trip action) | Pre-fills reversed route + same bus; bus overlap warning | "Xe [plate] co the chua hoan thanh chuyen di (du kien den [datetime])" |
| Recurring Templates | `/op/trip-templates` | Table: Tuyen, Xe, Gio di, Ngay trong tuan (T2-CN badges), Gia | Day-of-week badges: T2/T3/T4/T5/T6/T7/CN. Active=filled, inactive=muted. |
| 14-Day Preview | `/op/trip-templates` (post-create) | Calendar showing generated trips per day for 14-day horizon | Conflicts with bus maintenance/overlap highlighted with warning icon |
| Passenger Manifest | `/op/manifest/[tripId]` | Table: Ma ve, Ho ten, SDT (last 4), Don tai, TT (payment badge), Thao tac (check-in/no-show) | "Lam moi" refresh, "Tai PDF" download (A4 landscape, QR code). Sticky header on mobile. |

### Status Badge Mapping

| Status | Vietnamese | Badge Color |
|--------|-----------|-------------|
| `scheduled` | Da len lich | Blue |
| `departed` | Da khoi hanh | Green |
| `completed` | Hoan thanh | Gray |
| `cancelled` | Da huy | Red |

### Trip Actions Per State

| Status | Available Actions |
|--------|-----------------|
| `scheduled` | Chinh sua (Edit), Huy chuyen (Cancel), Danh dau khoi hanh (Mark Departed) |
| `departed` | Danh dau hoan thanh (Mark Completed), Xem bang ke (View Manifest) |
| `completed` | Xem bang ke (View Manifest), Xem dat ve (View Bookings) |
| `cancelled` | Xem chi tiet (View, read-only) |

### VND Price Input Behavior

| Behavior | Detail |
|----------|--------|
| Input type | `number` (no decimals) |
| On focus | Show raw integer (e.g., `350000`) |
| On blur | Format with thousands separator (e.g., `350.000`) |
| Suffix | "d" label outside the input field |
| Validation | Must be > 0; integer only |
| Keyboard | Numeric keyboard on mobile (`inputmode="numeric"`) |

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| Passenger manifests (BGTVT) | `GET /api/op/trips/:id/manifest` must produce manifest suitable for inspection. Phone numbers masked to last 4. | Manifest view + PDF export |
| Transport license verification | Only BGTVT-licensed operators can list trips. KYB verification at onboarding. 60-day license expiry alert cron. | `operatorLicenseAlert` cron job |
| Tet pricing cap (Law on Pricing 2023) | Government guidance caps Tet increases at 40-60% above normal. `Trip.price` is operator-set. | Guardrails for Tet pricing compliance not yet enforced at API level |
| CPL 2023 Art. 29 | 3-day remote cancellation right. Legal opinion pending on "service already performed" exception. | No `paid -> cancelled` customer-initiated transition exists -- GAP |
| CPL 2023 Art. 8-12 (Price transparency) | Total price inclusive of all fees. Cancellation policy displayed at booking time. | `CancellationPolicy.rules` displayed via `Trip.cancellationPolicyId` |
| Decree 70/2025 (E-Invoice) | Transport invoice fields (`vehiclePlateNumber`, `departureCityCode`, `destinationCityCode`, operator MST) required. Issuance within 24h of completion. 10-year retention. | DS-003 marks transport e-invoice fields as OVERDUE |

## Testing Strategy

### Unit Tests

- TripDto status union completeness (all four states)
- Error code taxonomy validation
- `daysOfMask` bitmask logic (Mon=1 through Sun=64)
- VND price formatting (dot separator, no decimals)

### Integration Tests

- **All status transitions:** scheduled->departed (sets `departedAt` AND `status='departed'` together), departed->completed, scheduled->cancelled, all idempotent re-calls return discriminated results at HTTP 200
- **Timestamp + status together (Mistake Log Issue 014):** Assert `departedAt IS NOT NULL` AND `status = 'departed'` in same row after `markDeparted`
- **Bus-overlap guard (concurrent):** Fire two trips with overlapping windows on same bus via `Promise.all`. Exactly one succeeds, other returns 409.
- **Maintenance-overlap (window-vs-window):** Partially overlapping maintenance window -> still blocked (Mistake Log Issue 001)
- **Cancellation cascade:** Cancel trip with paid bookings -> all bookings to `trip_cancelled`, holds to `cancelled_trip`, refunds enqueued, SMS notifications created
- **Idempotent cancel:** Second cancel returns `{ alreadyCancelled: true, cancelledBookings: 0 }` HTTP 200
- **payout_scheduled scheduledFor column (Mistake Log Issue 014):** Assert `scheduledFor` as top-level column = `completedAt + 1 day` AND NOT in `payload` JSON
- **Recurring template deduplication:** Generate for date with existing trip -> `RecurringGenerationLog.status = 'skipped'`
- **Three-layer capacity guard:** L1 concurrent holds, L2 concurrent payment webhooks, L3 phone hold cap
- **serviceDate filter timezone (Mistake Log Issue 014):** Derive date using VN-local shift (`+7h`) not `.toISOString().slice(0,10)`

### E2E Tests

- Create trip -> hold -> book -> depart -> complete full lifecycle
- Cancel trip -> verify cascade
- Manifest check-in flow with optimistic UI
- CSRF threading: all POST/PATCH/DELETE via `primeCsrf()` from `e2e/helpers/csrf.ts`
- RSC render purity: trip list and manifest pages must not call `Date.now()` in RSC render body
- BigInt arithmetic for payout calculation: `calcPayout` must use BigInt domain (Mistake Log Issue 016)

## Cross-References

- **Architecture Decisions:** [ADR-004](../../architecture-decisions/ADR-004-multi-tenancy/README.md) (D6, D12), [ADR-009](../../architecture-decisions/ADR-009-concurrency-seat-holding/README.md) (D1-D7), [ADR-016](../../architecture-decisions/ADR-016-module-boundaries/README.md) (D3), [ADR-019](../../architecture-decisions/ADR-019-state-machines/README.md) (D1-D7)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (sections 2.4, 3, 7.1, 11, 12), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (sections 7.4, 7.5, 7.7, 7.12, 10, 12.1, 12.2, 14)
- **Frontend Design:** [FD-022](../../frontend-design/FD-022-operator-fleet-trips/README.md) (Sections 4, 5, 6)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md) (Sections 2, 3, 5), [state-machines.md](../../business/domain-model/state-machines.md) (Section 1), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md), [event-flows.md](../../business/domain-model/event-flows.md) (Flows 2, 3, 4)
- **Regulatory:** [transport.md](../../business/regulatory/transport.md) (Sections 1, 3, 5, 6)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md) (Sections 2, 3, 4, 5, 6, 8)

## Known Gaps & Open Questions

- **HIGH -- Customer-initiated cancellation (CPL 2023 Art. 29)** -- No `paid -> cancelled` customer-initiated Booking transition. state-machines.md notes the GAP. Event-flows.md says it is "now fully specified in DS-007" but implementation status must be verified. Pre-launch compliance blocker.
- **HIGH -- E-Invoice fields OVERDUE** -- DS-003 Section 14.4 marks transport-specific e-invoice fields (`vehiclePlateNumber`, `departureCityCode`, `destinationCityCode`) as OVERDUE. Required by Decree 70/2025. Pre-launch compliance blocker.
- **MEDIUM -- HOLD_SWEEPER_MODE defaults to dry-run** -- `HOLD_SWEEPER_MODE` defaults to `'count'` (dry-run) in production. Must be set to `'sweep'` for live expiry. Causes phantom capacity accumulation if not set.
- **MEDIUM -- autoCompleteTrips arrival window definition** -- DS-003 documents the cron but the exact "arrival window" definition (`departureAt + route.durationMinutes`) is not explicitly stated.
- **MEDIUM -- Recurring template conflict highlighting** -- FD-022 Section 5.4 shows conflict warnings in 14-day preview. API endpoint for preview data not documented in DS-003.
- **MEDIUM -- SPEC CONFLICT: bus overlap HTTP status** -- `BUS_OVERLAP_WITH_OUTBOUND` returns 422 in `pairedReturn` (AC6) but 409 in `reassignBus` (I3). Both carry `// SPEC CONFLICT:` comments. Deferred to follow-up.
- **LOW -- blockedSeats management** -- No PATCH endpoint for updating `blockedSeats` post-creation is specified in DS-003.
- **LOW -- Staff assignment full flow** -- Assignment API exists but removal of assignments and staff dashboard for checking assigned trips not explicitly specified.
