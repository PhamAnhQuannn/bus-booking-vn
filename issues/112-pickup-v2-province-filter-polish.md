---
depends-on: [110-pickup-v2-station-as-kind, 111-pickup-v2-custom-request]
type: FEATURE
labels: [pickup-areas, operator, customer, ux]
---

## Parent PRD

`issues/prd-pickup-areas.md` · design `docs/design/pickup-points-v2.md` §3.2, §6, §7 P3

## What to build

Design phase **P3 — province filter** plus the traveler/operator convenience gaps the QA surfaced. Pure UX —
no schema change. Lands last because the pickers it touches are finalized by 110/111.

- **Province filter** (`listProvinces()` from `lib/geo`) in the operator per-trip picker (`NewTripClient`,
  `TripDetailClient`) + the places page (`PickupAreasClient.tsx`): narrows the list client-side by
  `provinceCode`. Pure UX aid — selection still writes the chosen `pickupAreaIds`.
- **Count-gate it (operator P3.2)**: render the filter only when the menu spans >1 province — a single-province
  operator doesn't need the dropdown.

### QA convenience fixes folded in

- **Per-route pickup memory (operator P1.3 — the real tedium-killer)**: a new trip starts from a blank
  checklist every time (`trips/new/page.tsx:50` builds `{id,label}` with no per-route memory). Default a new
  trip's pickup set from the most recent trip on the same `routeId` (or the route's template) + a "dùng lại
  điểm đón chuyến trước" button. Province filter alone does NOT address this.
- **Empty-state + swallowed fetch error (traveler P1.3)**: `CustomerForm.tsx` `.catch(() => {})` collapses both
  "operator enabled zero areas" and "fetch failed" to a silent station-only picker. Distinguish loading /
  loaded-empty / error: show "Chuyến này chỉ đón tại bến xe" when genuinely empty; show a retry on error.
- **Mobile long-list (traveler P2.2)**: a single-direction trip can legitimately enable 10–15 points. Add a
  client-side text filter inside the customer picker for >~6 areas; cap-test a 15-item trip at 360px viewport.
- **Detail-note copy (traveler P3.2)**: reframe the optional point note as "Ghi chú cho tài xế (số nhà, gọi
  trước...)" to encourage useful detail.
- **Post-booking edit hint (traveler P2.3)**: pickup is locked at hold; no self-serve edit exists. At minimum
  surface "Cần đổi điểm đón? Gọi nhà xe: [phone]" on confirmation.
- **Deactivate-then-book decision (edge P2-4)**: the holds validation has no `isActive` join — a deactivated
  area is still bookable on a scheduled trip. Decide + document: if blocking is intended, join
  `OperatorPickupArea.isActive = true` in the route's trip-area query and exclude it from the customer picker.

## Acceptance criteria

- [ ] Province filter narrows the operator per-trip picker + places page client-side; only rendered when the menu spans >1 province.
- [ ] A new trip on a route with prior trips defaults its pickup set from the latest trip/template on that `routeId`, with a "reuse last" affordance.
- [ ] Customer picker distinguishes loading vs loaded-empty vs fetch-error; empty shows "chỉ đón tại bến xe", error shows retry (no silent station-only collapse).
- [ ] Customer picker shows a text filter when >6 areas; usable on a 360px viewport with 15 areas (responsive check).
- [ ] Optional point note relabeled for the driver; confirmation shows a "change pickup → call operator" hint with the operator phone.
- [ ] Deactivate-then-book behavior is decided + documented; if blocking, `isActive` filter applied in holds validation + customer picker (with test).
- [ ] `pnpm tsc --noEmit` + `pnpm test` green; responsive smoke per `/responsive-test` or smoke-test.

## Blocked by

- Blocked by `issues/110-pickup-v2-station-as-kind.md` (grouped pickers the filter sits on).
- Blocked by `issues/111-pickup-v2-custom-request.md` (custom-specific confirmation/edit copy).

## QA provenance

2026-06-09 4-agent QA of `docs/design/pickup-points-v2.md`: operator P1.3/P3.2, traveler P1.3/P2.2/P2.3/P3.2, edge P2-4.
