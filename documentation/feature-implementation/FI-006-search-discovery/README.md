# FI-006: Search & Discovery (Tim kiem chuyen xe)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-009, ADR-011, DS-001, DS-003, FD-013

## Overview

FI-006 covers the customer-facing trip search surface: the mechanism by which a customer specifies origin, destination, date, and ticket count and receives a ranked, filtered list of available trips from approved operators. The search surface is SSR via React Server Components so results are SEO-indexable HTML. The canonical URL pattern is `/tuyen/{origin-slug}/{destination-slug}/{date}` (Vietnamese "tuyen" = route). The underlying API endpoint is `GET /api/trips/search`, implemented in `app/api/trips/search/route.ts` -> `lib/trips/searchTrips.ts`. Search is a read-only bounded context; it consumes data from the Fleet/Catalog context (Operator, Bus, Trip, Route, Place) and produces availability-enriched trip results.

## Scope & Boundaries

### In Scope

- `GET /api/trips/search` query parameters, response shape, visibility gates
- Place normalization (unaccent, alias matching, slug-based SEO URLs)
- Trip result card UI (FD-013 / DS-030)
- Availability formula and its three-component calculation
- Sort and client-side filter capabilities
- Maintenance window overlap exclusion logic
- Operator approval gate (search visibility)

### Out of Scope

- Hold creation -> [FI-007](../FI-007-booking-flow/README.md)
- Recurring template auto-generation -> [FI-005](../FI-005-trip-management/README.md) (operator-side)
- Admin moderation (sets `moderatedAt` gate) -> [FI-012](../FI-012-admin-console/README.md)
- Charter request search -> separate surface
- Operator dashboard trip listing -> [FI-009](../FI-009-operator-console/README.md)

### Bounded Context(s)

**Search/Availability Context** -- read-only consumer of Fleet/Catalog context entities. Produces availability-enriched trip results for customer consumption.

**Upstream dependencies:**
- `Operator.status = 'APPROVED'` gate (from Onboarding/KYB context)
- `Trip.moderatedAt IS NULL` gate (from Admin/Moderation context)
- `Bus.maintenanceStart`/`Bus.maintenanceEnd` (from Fleet context)

**Downstream consumers:**
- [FI-007](../FI-007-booking-flow/README.md) Booking Flow (customer selects a trip from results and creates a hold)
- Analytics (`FunnelEvent(search_performed)`)

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Trip | `id` (CUID), `routeId` (FK), `busId` (FK), `operatorId` (FK), `departureAt` (DateTime), `price` (Int VND), `status` (TripStatus), `salesClosed` (Boolean), `blockedSeats` (Int), `moderatedAt` (DateTime?) | `@@index([status, departureAt])`, `@@index([routeId, departureAt])` | Search requires: `status = 'scheduled'`, `salesClosed = false`, `moderatedAt IS NULL`, `departureAt > NOW()` |
| Bus | `capacity` (Int), `busType` (BusType: coach/sleeper/limousine), `maintenanceStart` (DateTime?), `maintenanceEnd` (DateTime?) | -- | Capacity for availability formula; maintenance for overlap exclusion; busType for filter |
| Operator | `status` (OperatorStatus), `brandName` (String), `disabledAt` (DateTime?) | -- | Must be `APPROVED`; `disabledAt` must be null |
| Route | `origin` (String), `destination` (String), `originPlaceId` (FK Place?), `destPlaceId` (FK Place?), `durationMinutes` (Int) | GIN index: `trip_route_unaccent_idx` | Diacritics-insensitive search via `unaccent_immutable(lower(origin))` |
| Place | `canonicalName` (String), `aliases` (String[]), `slug` (String @unique) | `@@index([canonicalName])` | Global registry; SEO URL slugs; alias-aware matching |
| Hold | `tripId` (FK), `status` (HoldStatus), `expiresAt` (DateTime), `ticketCount` (Int) | -- | `active` holds with `expiresAt > NOW()` counted in availability |
| Booking | `tripId` (FK), `status` (BookingStatus), `createdAt` (DateTime), `ticketCount` (Int) | -- | `paid` always counted; `awaiting_payment` counted within PSP window (20 min) |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| GET | `/api/trips/search` | Public | Search available trips by origin, destination, date, ticketCount | 200, 400 (missing params), 422 (invalid ticketCount or date) |

### Query Parameters

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `origin` | string | Yes | Place name or alias; diacritics-normalized |
| `destination` | string | Yes | Place name or alias; diacritics-normalized |
| `date` | string (YYYY-MM-DD) | Yes | Interpreted in `Asia/Ho_Chi_Minh` timezone |
| `ticketCount` | integer | Yes | Used for post-calculation availability filter |

### Six Visibility Gates

1. `Trip.status = 'scheduled'`
2. `Trip.salesClosed = false`
3. `Trip.moderatedAt IS NULL`
4. `Operator.status = 'APPROVED'`
5. `Trip.departureAt > NOW()`
6. No maintenance overlap: `maintenanceStart IS NULL OR maintenanceEnd < startUtc OR maintenanceStart > endUtc`

Gate 6 uses window-vs-window logic (Mistake Log Issue 001 correction -- the original point-in-time bug compared `new Date()` vs window instead of trip-window vs maintenance-window).

### Availability Formula

```
available = Bus.capacity
           - Trip.blockedSeats
           - SUM(Hold.ticketCount WHERE status = 'active' AND expiresAt > NOW())
           - SUM(Booking.ticketCount WHERE status = 'paid')
           - SUM(Booking.ticketCount WHERE status = 'awaiting_payment'
                 AND createdAt >= NOW() - PSP_WINDOW_MINUTES)
```

`PSP_WINDOW_MINUTES = 20`

Post-formula filter: only trips where `available >= ticketCount` are returned.

**`searchResultSelect` whitelist** contains only UI-contract fields. `salesClosed` and `status` are `where`-clause-only; removed from select to prevent leaking internal state (Mistake Log Issue 001).

### Response Shape (200)

```json
[{
  "id": "string",
  "departureAt": "ISO timestamp",
  "price": 350000,
  "availableSeats": 12,
  "route": {
    "fromPlace": { "canonicalName": "...", "slug": "..." },
    "toPlace": { "canonicalName": "...", "slug": "..." },
    "durationMinutes": 360
  },
  "bus": { "busType": "sleeper", "amenities": [...] },
  "operator": { "brandName": "Phuong Trang (FUTA)", "isVerified": true },
  "pickupAreas": [...]
}]
```

**Side effect:** `FunnelEvent(search_performed)` tracked via `lib/analytics/track.ts`.

## State Machine

This feature does not have a dedicated state machine. Search is a read-only operation. The entities it gates on have states that directly affect search visibility:

### Trip States Affecting Search

| Trip.status | Visible in search? | Notes |
|-------------|-------------------|-------|
| `scheduled` | Yes (if other gates pass) | Only bookable state |
| `departed` | No | `departureAt > NOW()` fails |
| `completed` | No | `departureAt > NOW()` fails |
| `cancelled` | No | `status = 'scheduled'` fails |

### Operator States Affecting Search

| Operator.status | Visible? |
|----------------|----------|
| `PENDING_REVIEW` | No |
| `UNDER_REVIEW` | No |
| `APPROVED` | Yes |
| `REJECTED` | No |
| `SUSPENDED` | No |

Only `APPROVED` operators appear in search. `SEARCH_VISIBLE_STATUSES = ['APPROVED']`.

### salesClosed Flag (orthogonal to Trip.status)

- `false` -> visible in search and accepts holds
- `true` -> excluded from search, hold conditional INSERT blocked
- Set automatically by `markDeparted` to `true`
- Can be manually toggled by operator

## Business Rules & Invariants

1. **BR-S1: Maintenance window exclusion uses window-vs-window overlap** -- Correct form: `maintenanceStart IS NULL OR maintenanceEnd < tripStart OR maintenanceStart > tripEnd`. This is the complement-of-overlap form. The original bug compared `new Date()` (wall-clock now) rather than trip window bounds (Mistake Log Issue 001).

2. **BR-S2: PSP window occupies capacity** -- `awaiting_payment` bookings created within `PSP_WINDOW_MINUTES = 20` of `NOW()` count against available seats. Bookings older than 20 minutes that have not received a PSP webhook are excluded from seat count, allowing slot reclamation.

3. **BR-S3: blockedSeats reduces effective capacity** -- `Trip.blockedSeats` is an operator-controlled integer that reduces calculated available seats below `Bus.capacity`. Supports reserving seats for groups, VIPs, or operational purposes.

4. **I7 -- No client-originated price** -- The `price` field in search results is `Trip.price` from the database. Search does not accept any price parameter. Price on the search card is the authoritative trip price used verbatim at booking creation (`totalVnd = Trip.price * ticketCount`).

5. **BR-S5: Place alias matching** -- `Place.aliases` array contains alternative names. Search performs `unaccent_immutable ILIKE` matching against both `canonicalName` and each alias to normalize Vietnamese diacritics (e.g., "Da Lat" matches "Da Lat").

6. **BR-S6: Operator bookable gate applied at hold creation too** -- Operator `APPROVED` check fires at search time AND at hold creation time (conditional INSERT joins Trip -> Operator). Closes the suspend-after-search race.

7. **BR-S7: Date filter is in Asia/Ho_Chi_Minh timezone** -- The `date` parameter is interpreted in UTC+7. Window: `${date}T00:00:00+07:00` to `${date}T23:59:59+07:00`. Using `.toISOString().slice(0, 10)` to derive test dates produces UTC dates, not Vietnam-local dates, causing intermittent test failures (Mistake Log Issue 014).

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Search Form | `/` (homepage) or `/tuyen/...` | `PlaceCombobox` (origin/destination), `DatePicker` (VN timezone), ticket stepper, submit CTA | Diacritics-tolerant combobox; alias-aware; Vietnamese month/day labels |
| Search Results | `/tuyen/{origin-slug}/{destination-slug}/{date}` | Trip result cards (SSR), sort/filter controls | SEO-indexable RSC HTML; "tuyen" = Vietnamese for "route" |

### Trip Result Card Elements

| Element | Source | Display Rule |
|---------|--------|-------------|
| Operator name | `operator.brandName` | Full brand name |
| Verified badge | `operator.isVerified` | Shield icon |
| Departure time | `Trip.departureAt` | `HH:mm` in `Asia/Ho_Chi_Minh` |
| Arrival time | `departureAt + route.durationMinutes` | `HH:mm` |
| Duration | `Route.durationMinutes` | "{h}h {m}m" |
| Route | `fromPlace.canonicalName -> toPlace.canonicalName` | Vietnamese with diacritics |
| Bus type badge | `Bus.busType` | coach/sleeper/limousine |
| Amenities | `Bus.amenities` | WiFi, USB, blanket, etc. |
| Pickup type | `Trip.pickupAreas` | station/point/custom |
| Price | `Trip.price` | VND: "350.000 d" (dot separator, no decimals) |
| Available seats | Computed `availableSeats` | Color-coded (see below) |
| CTA | -- | "Dat ve" (opens hold creation) |

### Available Seats Color Rules

| Seats Available | Display |
|----------------|---------|
| > 10 | Green count |
| 4-10 | Amber count |
| 1-3 | Red bold count |
| 0 | Grey "Het cho" (sold out), CTA disabled |

### Sort & Filter

| Capability | Side | Default |
|-----------|------|---------|
| Sort by departure time | Server-side (ORDER BY) | ASC (default) |
| Sort by price | Client-side re-sort | Off by default |
| Filter: bus type | Client-side checkbox | None selected |
| Filter: departure time range | Client-side radio | None selected |
| Filter: operator | Client-side checkbox | None selected |

### Empty/Error States

| State | Heading | CTA |
|-------|---------|-----|
| No trips found | "Khong co chuyen xe nao" | None |
| Network error | "Khong the tai ket qua" | Retry |

### Accessibility

- Trip cards: `role="article"`, `aria-label="{route} - {date} - {operator}"`
- Results region: `aria-live="polite"` during loading
- Available seats: screen-reader announces count + status (e.g., "3 cho con lai -- it cho")

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| CPL 2023 (Price transparency) | Total price shown upfront before payment commitment; no hidden fees at checkout | `Trip.price` displayed on card; commission absorbed by operator, not surfaced to customer |
| Currency law | Prices in VND only for Vietnamese consumers | All prices in VND integer; "d" suffix |
| CPL 2023 Art. 37-39 | Operator identity verification required | KYB approval gate (`Operator.status = 'APPROVED'`) before search visibility |
| Transport regulations | Transport license verification | `Operator.transportLicense` verified at onboarding |
| CPL 2023 (Customer protection) | Accurate bus type display -- no generic category substitution | `Bus.busType` from actual vehicle, not generic category |
| Tax law | VAT-inclusive pricing | VND prices are VAT-inclusive |
| Law on Pricing 2023 | Tet exception: government caps at 40-60% above normal | Not enforced at API level currently |

## Testing Strategy

### Unit Tests

- Availability formula computation correctness (given mocked hold/booking counts)
- Date range construction from `date` parameter + `Asia/Ho_Chi_Minh` timezone
- Place alias normalization logic
- `searchResultSelect` whitelist does NOT include `salesClosed` or `status` (Mistake Log Issue 001 regression prevention)

### Integration Tests

- Six visibility gates each individually toggled (each gate independently excludes results)
- Maintenance window overlap: window-vs-window logic excludes trips correctly; point-in-time would not
- Availability formula with mixed hold/booking/awaiting_payment states
- `PSP_WINDOW_MINUTES` boundary: booking older than 20 min NOT counted; within 20 min IS counted
- `blockedSeats` reduces available count
- Place alias matching returns results for both canonical name and alias
- Date interpreted in VN timezone: test seeding must use offset math `new Date(ms + 7 * 3600_000).toISOString().slice(0, 10)`
- Operator `SUSPENDED` status -> trip excluded from results
- `salesClosed = true` -> trip excluded

### E2E Tests

- Navigate to `/tuyen/{origin-slug}/{destination-slug}/{date}` URL directly (bypass form per SI-005 section 4.1)
- Search results page renders RSC HTML (SEO)
- Trip card elements present: price, seats, operator name, bus type, CTA
- Sold-out trip shows "Het cho" with disabled CTA

## Cross-References

- **Architecture Decisions:** [ADR-009](../../architecture-decisions/ADR-009-concurrency-seat-holding/README.md) (three-layer capacity guard, PSP_WINDOW_MINUTES), [ADR-011](../../architecture-decisions/ADR-011-search-availability/README.md) (7 search decisions, availability formula, blockedSeats)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (Trip, Hold, Booking, Place schemas), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (section 3 search contract)
- **Frontend Design:** [FD-013](../../frontend-design/FD-013-search-results/README.md) (SearchForm, trip card, available seats, sort/filter, SEO URL, accessibility)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [event-flows.md](../../business/domain-model/event-flows.md) (Flow 1 Step 1), [invariants-catalog.md](../../business/domain-model/invariants-catalog.md) (I7, salesClosed gate, maintenance overlap)
- **Regulatory:** [consumer-protection.md](../../business/regulatory/consumer-protection.md) (CPL 2023 price transparency)
- **Personas:** [customer-personas.md](../../business/personas/customer-personas.md) (hold duration comparison, bait-and-switch trust factor, price sensitivity)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md) (section 3.3 VN timezone dates, section 4.1 URL-driven E2E)

## Known Gaps & Open Questions

- **MEDIUM -- HOLD_SWEEPER_MODE dry-run override** -- `HOLD_SWEEPER_MODE` defaults to `'update'` (active sweep). Verify production env does not override to `'count'` (dry-run).
- **MEDIUM -- blockedSeats status contradiction** -- ADR-011 states "blockedSeats retired from formula" but DS-001 still lists it as a Trip column. Reconcile before go-live.
- **MEDIUM -- No load test for Tet-surge concurrent search** -- SI-005 known gap; no owner; 3.6x demand spike expected.
- **MEDIUM -- No waitlist/notification for sold-out trips** -- Persona research identifies this as high-value for Tet; not implemented.
- **MEDIUM -- ZaloPay payment missing** -- Customer-personas.md payment table: missing, P2 priority.
- **MEDIUM -- HOLD_SWEEPER_MODE integration test gap** -- No integration test validates live sweep path end-to-end.
- **LOW -- International tourist English UI missing** -- Persona 4 "Marco" needs full English UI; not implemented.
- **LOW -- searchResultSelect field list not formally tested** -- Should assert whitelist does not include `salesClosed`/`status` (Mistake Log Issue 001 prevention).
