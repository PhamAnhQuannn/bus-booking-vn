---
depends-on: [issue-104, issue-106]
labels: [pickup-areas, customer, booking]
---

## Parent PRD

`issues/prd-pickup-areas.md`

## What to build

The traveler's required pickup selection at booking, end-to-end through hold → booking → display.

- **Booking Step 1** (`app/(customer)/booking/customer/CustomerForm.tsx`): a **required** radio — "Tại bến xe" (always present) + the trip's `TripPickupArea` list (fetched server-side, folded into trip-details read or a dedicated read). Selecting an area reveals a **required detail textbox** (≥5 chars); station shows none.
- **Persist on Hold**: extend `holdInputSchema` (`lib/core/validation/hold.ts`) + `createHold` + `POST /api/holds`. Booking snapshots the pickup at creation (`lib/booking/bookingRepo.ts`): `pickupKind`, `pickupAreaId`, `pickupAreaLabel`, `pickupDetail`.
- **Deep validator** (pure): `(trip enabled areas, selection) → ok | error` — station needs no detail; area requires `pickupAreaId` ∈ trip set AND non-empty detail. Used client-side (UX) + server-side (authoritative, 422). PRD deep-module #2.
- **State + display**: extend `lib/state/bookingStore.ts` (`setPickup`); show selection on review (`ReviewClient.tsx`), confirmation, and ticket PDF (`lib/booking/getHoldDetails.ts` DTO + ticket gen).

See PRD §"Booking flow" + grilled decision #6.

## Acceptance criteria

- [ ] Traveler cannot continue Step 1 without choosing station or an area.
- [ ] Choosing an area requires detail ≥5 chars; station requires none.
- [ ] Selection persists on the hold and snapshots onto the booking (`pickupKind`/`pickupAreaId`/`pickupAreaLabel`/`pickupDetail`).
- [ ] Deactivating the source area after booking does NOT change the booking snapshot (integration test; prior art `lib/booking/__tests__/*.int.test.ts`).
- [ ] Server rejects a foreign `pickupAreaId` or missing/short detail with 422.
- [ ] Pickup choice + detail render on review, confirmation, and ticket.
- [ ] Validator unit tests cover station-ok, area-in-set-ok, area-not-in-set-fail, empty/short-detail-fail.
- [ ] `pnpm tsc --noEmit` + `pnpm test` green.

## Blocked by

- Blocked by `issues/104-pickup-schema-migration-pickuppoint-removal.md` (Hold/Booking pickup fields).
- Blocked by `issues/106-pickup-per-trip-template-selection.md` (trips must expose pickup areas to pick from).

## User stories addressed

- User story 10
- User story 11
- User story 12
- User story 13
- User story 14
- User story 15
