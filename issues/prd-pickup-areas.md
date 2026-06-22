# PRD: Personal Pickup Destinations

> Decisions below are already grilled — treat as settled.

## Problem Statement

Travelers can only board at the operator's bus **station**. Many customers — especially in rural huyện/xã — want to be picked up near home instead of traveling to the station. There is no way for a traveler to tell the operator *where* they want to be collected at booking time. The existing `PickupPoint` model is route-scoped, is not a structured administrative location, and is filled in by the operator **after** payment (call-queue), so the traveler never expresses a choice.

## Solution

Operators publish a structured menu of **pickup areas** (Vietnamese administrative units: Tỉnh → Huyện → Xã) and choose which apply to each trip. At booking, the traveler is **required** to pick either "Tại bến xe" (at the station) or one of that trip's pickup areas; choosing an area requires a free-text detail (street / thôn xóm / landmark). The operator sees the traveler's choice + detail (read-only) on the booking detail and manifest, so the driver knows exactly where to collect each passenger. The legacy route-scoped `PickupPoint` feature is removed entirely.

## User Stories

### Operator — onboarding & area menu
1. As an operator applying, I want to select my **province** on the application form, so my base region is recorded for later pickup-area setup.
2. As an approved operator, I want to build a reusable **pickup-area menu** in the console (each entry = province + huyện + xã chosen from a cascading dropdown), so I define areas once instead of per trip.
3. As an operator, I want to **deactivate** a pickup area in my menu, so I can retire an area without breaking historical bookings that referenced it.
4. As an operator, I want my menu's area picker to **default to my province**, so I don't scroll the whole country each time.

### Operator — per-trip & recurring selection
5. As an operator creating/editing a trip, I want to **tick which of my menu areas apply** to that trip, so each departure only offers areas I actually serve.
6. As an operator creating/editing a recurring template, I want to tick areas on the **template**, so every auto-generated trip inherits the same pickup areas without manual re-entry.
7. As an operator, I want a trip with **no ticked areas** to still be bookable (station-only), so areas remain optional per trip.

### Operator — visibility
8. As an operator viewing a booking, I want to see the passenger's chosen **pickup area + their detail text** (read-only), so I know where to collect them.
9. As an operator viewing a trip manifest, I want each passenger row to show pickup area + detail, so boarding/pickup is organized by location.

### Traveler — booking
10. As a traveler booking a trip, I want to **choose** between "Tại bến xe" and the trip's pickup areas, so my boarding point is explicit.
11. As a traveler, I want this choice to be **required** before continuing, so my booking is never ambiguous about where I board.
12. As a traveler choosing a pickup area, I want a **detail text box** (street / thôn xóm / landmark), so the driver finds my exact spot; it is required (≥5 chars) when an area is chosen.
13. As a traveler choosing "Tại bến xe", I want **no detail box**, so station boarding stays one tap.
14. As a traveler, I want my pickup choice + detail shown on the **review, confirmation, and ticket** screens, so I can verify before and after paying.
15. As a traveler, I want an invalid/foreign pickup area (not on this trip) to be **rejected by the server**, so tampering can't slip a bad pickup into a booking.

### System — data integrity & removal
16. As the platform, I want each booking to **snapshot the pickup area label**, so a later area edit/deactivation doesn't rewrite past bookings.
17. As the platform, I want the legacy route-scoped `PickupPoint` model and all its touchpoints removed, so there is one pickup concept, not two.
18. As the platform, I want `pickupDetail` treated as **PII** (location) and included in the snapshot-anonymization set, so retention/erasure stays correct.

## Implementation Decisions

### Model shape (two-level + template)
- **`OperatorPickupArea`** — operator-scoped reusable menu entry: province/district/ward codes + names, denormalized `label`, `isActive`, `displayOrder`. Tenant-scoped via the existing `withOperatorScope` helper.
- **`TripPickupArea`** — per-trip enabled subset: links a trip to an `OperatorPickupArea`, stores a `label` snapshot + `displayOrder`; cascade-deleted with the trip.
- **`TemplatePickupArea`** — recurring-template subset, same shape; the trip-generation worker copies these into `TripPickupArea` rows when it creates each trip (inside the existing generation transaction).
- **`Operator.provinceCode` / `provinceName`** — captured on the public application.
- **Hold + Booking pickup fields** (replacing `pickupPointId` / `pickupNote`): `pickupKind` enum (`station | area`), `pickupAreaId` (nullable FK → `OperatorPickupArea`), `pickupAreaLabel` (snapshot), `pickupDetail` (free text, required when kind = area).

### VN admin dataset
- A **vendored, version-pinned static JSON** dataset (3-tier Tỉnh → Huyện → Xã with official codes + names), no runtime fetch; provenance documented in-repo.
- A **deep loader module** (`lib/geo/vnAdmin`) exposing a small, stable interface: list provinces, list districts for a province, list wards for a district, resolve a `{province,district,ward}` code triple to a display label. Pure, no I/O beyond reading the bundled JSON.
- A shared **cascading picker component** consumed by operator registration, the console menu, and (rendering the trip's subset) the customer booking step.

### Booking flow
- Pickup selection happens in **booking Step 1** (the customer/buyer-info step), where `tripId` is already known. The trip's `TripPickupArea` list is fetched server-side (folded into the existing trip-details read or a dedicated read).
- The selection persists on the **Hold**; the **Booking** snapshots it at creation. The hold input schema gains the pickup fields.
- **Validation (deep, pure):** a single function validates a pickup selection against a trip — `station` needs no detail; `area` requires `pickupAreaId` to be in the trip's enabled set AND non-empty `pickupDetail` (≥5 chars). Enforced client-side (UX) and server-side (authoritative; reject with 422).

### Operator surfaces
- **Application** gains a province picker only (no area entry pre-approval).
- **Console** gains a pickup-area menu CRUD (page + API + service layer mirroring existing catalog services).
- **Trip create/edit** and **recurring-template create/edit** gain an area-ticking control.
- **Booking detail + manifest** show pickup **read-only**; the old post-payment pickup *assign/edit* mutation and its endpoint are removed.

### Legacy `PickupPoint` removal
- Drop the `PickupPoint` model, its `Route` relation, and `Booking.pickupPointId` / `pickupNote`.
- Delete its service layer, its API routes, and its console panel; repoint the booking-display chain and redaction lists to the new fields; replace its seed data with the new models.
- **Migration is greenfield** (pre-launch, no production data): create the new tables/columns/enum, default existing rows to `pickupKind = 'station'`, then drop the legacy table/columns; reseed. One new forward migration (committed migrations are never edited). Non-partial indices declared in BOTH the Prisma schema and the SQL.

### Deep modules to extract (testable in isolation)
1. **`vnAdmin` dataset loader** — stable list/resolve interface over the bundled JSON.
2. **pickup-selection validator** — `(trip enabled areas, selection) → ok | error`, pure.
3. **pickup snapshot mapper** — resolves codes → label and produces the Hold/Booking snapshot fields.

## Testing Decisions

Good tests assert **external behavior** through a module's public interface, not its internals — they survive refactors and document the contract.

- **`vnAdmin` loader** (unit): known province has expected districts; district has expected wards; `resolveLabel` of a valid triple returns the human label; unknown codes return empty/typed-miss. Prior art: existing pure-lib unit tests under `lib/**/__tests__`.
- **pickup-selection validator** (unit): station selection passes with no detail; area selection in the trip's set with ≥5-char detail passes; area not in the trip's set fails; area with empty/short detail fails. Mirror the existing validation-schema test style.
- **Hold → Booking snapshot** (integration): creating a hold+booking with an area persists `pickupKind`, `pickupAreaId`, `pickupAreaLabel`, `pickupDetail`; deactivating the source area afterward does NOT change the booking's snapshot. Prior art: existing booking/hold integration tests (`lib/booking/__tests__/*.int.test.ts`).
- **Recurring generation** (integration): a template with a pickup subset produces trips whose `TripPickupArea` rows match. Prior art: `lib/trips/__tests__/recurringGenerator.test.ts`.
- **Server-side rejection** (route/int): `POST /api/holds` (or initiate) with a foreign `pickupAreaId` or missing detail returns 422.
- **Removal regression**: deleted `PickupPoint` tests are removed; a repo grep for `PickupPoint|pickupPointId|pickupNote` over `app/ lib/ prisma/schema.prisma` returns zero.

Modules the user wants tests for: the three deep modules above + the snapshot integration + recurring inheritance. UI components (picker, forms) covered by e2e/smoke, not unit.

## Out of Scope

- Map/geocoding, distance pricing, or surcharge for personal pickup (pickup is informational; price unchanged).
- The 2025 2-tier (province → commune) admin reform — we ship 3-tier legacy by explicit decision; a future dataset swap is isolated behind the loader.
- Backfilling historical bookings (greenfield; no prod data).
- Operator editing a traveler's pickup after booking (now read-only).
- Per-area capacity limits or pickup time windows.

## Further Notes

- `pickupDetail` is personal location data — must join the booking snapshot-anonymization set (Issue 090) and the logger/Sentry redaction lists.
- A trip with zero ticked areas is valid (station-only); "required" is still satisfiable via the always-present station option.
- Suggested issue slices: **A** dataset+loader+picker · **B** schema+migration+PickupPoint removal · **C** registration province + console menu · **D** per-trip + template selection · **E** traveler booking flow · **F** manifest/booking-detail read-only display. Update `rebuild-plan.md` S06/S07 Status lines.
