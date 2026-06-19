# Pickup Points v2 — per-trip places (stations + points + custom requests)

Status: DESIGN → DECOMPOSED · Author: design session 2026-06-09 · Supersedes issues 105–108 surface
QA: 4-agent review 2026-06-09 (traveler / operator / edge-case / consistency lenses) + Opus synthesis.
Decomposed into issues **109** (schema/migration), **110** (station-as-kind, §7 P1), **111** (custom request,
§7 P2 — carries the P0 §8-grep + silent-drop fixes), **112** (province filter + UX polish, §7 P3).
Build order: 109 → (110 ‖ 111) → 112. QA fixes are folded into each issue's ACs, not tracked separately.

## 1. Problem & goals

Operators run trips in both directions; the boarding side differs per direction (Thanh Hóa→SG boards
in Thanh Hóa, SG→Thanh Hóa boards in SG). They want to offer travelers a **choice of pickup place per
trip**, including their **station(s)** and **door-to-door points**, and to handle travelers who need a
**location not on the list** by being told to contact that traveler.

What already exists (issues 105–108 + the named-points work shipped 2026-06-09):

- `OperatorPickupArea` — operator's reusable menu of **named points** (name + optional addressLine +
  GSO province/district/ward + denormalized `label`). Create / edit / soft-deactivate.
- `TripPickupArea` / `TemplatePickupArea` — per-trip / per-template **enabled subset** with a
  snapshotted `label`. Operator picks which points apply when creating/editing a trip or template
  (`lib/trips/createTrip.ts`, `lib/trips/setTripPickupAreas.ts`, `lib/trips/generateFromTemplate.ts`).
- Customer picks `station` or `area` + optional free-text `pickupDetail`
  (`app/(customer)/booking/customer/CustomerForm.tsx`, `lib/booking/pickupSelection.ts`,
  `app/api/holds/route.ts`). Snapshotted onto Hold → Booking; shown on review, manifest, booking detail.

**Directional selection already works** — each direction is a distinct `Trip`, so the operator enables
different points per direction. This design only adds the three missing pieces.

### Decisions (locked with product)
1. **Station = a typed place** (not a location-less flag).
2. **Custom request** = booking flag + manifest highlight + **operator notification**.
3. **Origin help** = manual selection + a **province filter** (no auto-match; `Route.origin` is free
   text with no province code — `Route.origin: String` + `Route.originPlaceId → Place.canonicalName`,
   neither carries a GSO code).

## 2. Data model

### 2.1 `OperatorPickupArea` — add a kind
```prisma
enum PickupPlaceKind {
  station   /// Bến xe — a terminal/depot boarding place.
  pickup    /// Đón tận nơi — a door-to-door pickup place.
}

model OperatorPickupArea {
  // ...existing: name, addressLine, provinceCode/districtCode/wardCode + names, label, isActive...
  kind  PickupPlaceKind @default(pickup)
}
```
A station and a pickup point are the **same table**, distinguished by `kind`. All existing CRUD
(`lib/catalog/createOperatorPickupArea.ts`, `updateOperatorPickupArea.ts`, DTO `areaSelect`) just
gains the `kind` field. Dedup stays `(wardCode, name)` active.

### 2.2 `TripPickupArea` / `TemplatePickupArea` — snapshot kind
Add `kind PickupPlaceKind` next to the existing `label` snapshot so the customer picker and manifest
can group station-vs-point without joining back to `OperatorPickupArea`. Written by
`createTrip` / `setTripPickupAreas` / `createTemplate` / `generateFromTemplate` (all already select the
place and snapshot — add `kind` to the select + the `createMany` data).

### 2.3 `Hold` / `Booking` — three-way pickup + custom flag
```prisma
enum PickupKind {
  station   // chose a station place
  point     // chose a door-to-door place  (RENAMED from `area`)
  custom    // free-text request not in the list  (NEW)
}

model Booking {            // and Hold, identically
  pickupKind            PickupKind @default(station)
  pickupAreaId          String?     // set for station|point; null for custom
  pickupAreaLabel       String?     // snapshot of the chosen place (name — address)
  pickupDetail          String?     // point: optional note; custom: REQUIRED requested location
  customPickupRequested Boolean     @default(false)  // true ⇔ pickupKind = custom
  // existing relation pickupArea OperatorPickupArea? (onDelete: SetNull)
}
```
`customPickupRequested` is redundant with `pickupKind='custom'` but is kept as an **indexed boolean**
for cheap manifest filtering + as the notification trigger. Index: `@@index([tripId, customPickupRequested])`.

### 2.4 Migration
```sql
-- new enum
CREATE TYPE "PickupPlaceKind" AS ENUM ('station', 'pickup');
ALTER TABLE "OperatorPickupArea" ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';
ALTER TABLE "TripPickupArea"     ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';
ALTER TABLE "TemplatePickupArea" ADD COLUMN "kind" "PickupPlaceKind" NOT NULL DEFAULT 'pickup';

-- booking/hold pickup-kind evolution (two statements; ADD VALUE cannot run in same tx as use)
ALTER TYPE "PickupKind" RENAME VALUE 'area' TO 'point';
ALTER TYPE "PickupKind" ADD VALUE 'custom';

ALTER TABLE "Booking" ADD COLUMN "customPickupRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Hold"    ADD COLUMN "customPickupRequested" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Booking_tripId_customPickupRequested_idx" ON "Booking" ("tripId", "customPickupRequested");
```
Declare the plain columns + index in `schema.prisma` too (Mistake-Log Issue 007 rule). `ADD VALUE`
must be its own migration step from any use of the value (Postgres restriction).

## 3. Operator UX

### 3.1 Places menu — `/op/pickup-areas` (`PickupAreasClient.tsx`)
- Create + edit forms gain a **kind** selector: "Bến xe" (`station`) / "Đón tận nơi" (`pickup`).
- List shows a kind **badge** beside the name.
- Validation schema (`lib/core/validation/pickupArea.ts`) gains `kind` on create + update.

### 3.2 Per-trip selection (directional)
`NewTripClient`, `TripDetailClient` (pickup card), `TemplatesClient` checklists:
- **Group** the operator's places by kind (Bến xe / Đón tận nơi).
- Add a **province filter** dropdown (`listProvinces()` from `lib/geo`) that narrows the list client-side
  by `provinceCode`. Pure UX aid — selection still writes the chosen `pickupAreaIds`.
- The operator enables the origin-side places for that specific trip (directionality is inherent).

## 4. Customer UX (`CustomerForm.tsx`)

Grouped picker built from `GET /api/trips/[id]/pickup-areas` (extend its response to include `kind`):
- **Bến xe** — station places.
- **Đón tận nơi** — pickup places.
- **Điểm đón khác (ghi rõ)** — custom: reveals a **required** free-text input.

Rules (`lib/booking/pickupSelection.ts`, now 3-way):
- `station` / `point` → `areaId` must be in the trip's enabled set; `point` note optional.
- `custom` → free text required (min 5 chars, trimmed); no `areaId`.

`PickupCheck` becomes `{station|point|custom}`; the holds route maps `custom` to
`pickupKind='custom', customPickupRequested=true, pickupDetail=<text>, pickupAreaId=null`.

## 5. Custom-request surfacing

1. **Flag** — `Booking.customPickupRequested = true` (carried from Hold).
2. **Manifest** (`lib/booking/getManifest.ts` `ManifestRow` + `ManifestRefresh.tsx`): add
   `customPickupRequested` to the row; render custom rows with the existing **warning-row** treatment
   used for `escalatedAt` (highlighted background + "Cần liên hệ" marker) and show the requested text.
3. **Notification** — at the booking-paid enqueue site (`lib/payment/processWebhook.ts`, where
   `operatorNewBooking` is created via `createNotificationLog`), when `customPickupRequested` also
   enqueue `operatorCustomPickupRequest`:
   - `channel`: operator default (sms/email), `recipient`: operator notification phone/email,
   - `payload`: rendered with bookingRef + requested location + traveler name/phone,
   - new template in the renderer; add the requested-text field to the logger redaction list if it
     counts as PII (location).
   - Dispatched by the existing `lib/jobs/dispatchNotifications.ts` worker (retry/backoff for free).
4. **Acknowledge** — out of scope; the contact-status mutation was removed (Issue 039, online-only).
   Operator reads the manifest/notification and phones the traveler. A future "mark contacted" can
   re-introduce a contactStatus write.

## 6. Origin / direction

Manual + province filter (§3.2). No auto-match: origin is a free-text `Place.canonicalName` with no GSO
code, so any parse would be unreliable. Directionality needs no special handling — each direction is its
own `Trip` with its own `TripPickupArea` set.

## 7. Build phasing (for a later implementation round)

- **P1 — station as a kind.** `PickupPlaceKind` enum + `kind` columns (OperatorPickupArea +
  Trip/Template snapshots) + operator create/edit kind + grouped customer picker + `/api/trips/[id]/pickup-areas`
  returns `kind`.
- **P2 — custom request.** `PickupKind` `area`→`point` rename + `custom` value +
  `customPickupRequested` flag + holds/validator 3-way + manifest highlight + operator notification.
- **P3 — province filter** in the operator per-trip picker + places page.

## 8. Compatibility / grep checklist

`area`→`point` rename touches every reader of `pickupKind === 'area'`:
`app/(customer)/booking/customer/CustomerForm.tsx`, `lib/booking/pickupSelection.ts`,
`app/api/holds/route.ts`, `lib/booking/getManifest.ts`,
`app/op/(console)/manifest/[tripId]/ManifestRefresh.tsx`,
`app/(customer)/booking/review/ReviewClient.tsx`,
`app/op/(console)/bookings/[id]/BookingDetailClient.tsx`,
`lib/booking/bookingDto.ts` + `toBookingDto.ts`, `lib/booking/getHoldDetails.ts`,
`lib/core/db/holdRepo.ts`, `lib/booking/bookingRepo.ts`. Grep `'area'` in pickup context + every
`pickupKind` literal before flipping the enum, and update unit tests (`pickupSelection.test.ts`,
`createTrip.test.ts`) in the same commit.

Back-compat: default `pickupKind` stays `station`; `customPickupRequested` defaults `false`; existing
`area` rows migrate to `point` in-place.
