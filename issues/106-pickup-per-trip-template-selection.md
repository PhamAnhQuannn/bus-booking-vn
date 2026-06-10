---
depends-on: [issue-104, issue-105]
labels: [pickup-areas, operator, trips]
---

## Parent PRD

`issues/prd-pickup-areas.md`

## What to build

Let operators choose which of their menu areas apply per departure — directly on a trip, and on recurring templates so generated trips inherit them.

- **Trip create/edit**: tick applicable `OperatorPickupArea` entries → write `TripPickupArea` (snapshot label). Touch `app/op/(console)/trips/TripsClient.tsx`, `lib/trips/createTrip.ts` (+ trip update), `app/api/op/trips/**`, trip validation schema.
- **Recurring template create/edit**: tick areas → write `TemplatePickupArea`. Touch the template CRUD in `lib/trips/generateFromTemplate.ts` (`createTemplate`/`patchTemplate`) + template UI/API.
- **Generation worker**: `generateFromTemplate.ts` copies the template's `TemplatePickupArea` rows into each new trip's `TripPickupArea` inside the existing `$transaction`.
- A trip with **zero** ticked areas remains valid (station-only).

See PRD §"Operator surfaces" + grilled decision #2.

## Acceptance criteria

- [ ] Trip create/edit persists the ticked subset to `TripPickupArea`; only the operator's own active areas are selectable (tenant-scoped).
- [ ] Template create/edit persists to `TemplatePickupArea`.
- [ ] Generated trips receive `TripPickupArea` rows matching their template's subset (asserted in generation integration test; prior art `lib/trips/__tests__/recurringGenerator.test.ts`).
- [ ] Editing/deactivating a menu area does not rewrite existing `TripPickupArea` snapshots.
- [ ] Trip with no ticked areas saves and is bookable (station-only).
- [ ] `pnpm tsc --noEmit` + `pnpm test` green.

## Blocked by

- Blocked by `issues/104-pickup-schema-migration-pickuppoint-removal.md` (`TripPickupArea`/`TemplatePickupArea` models).
- Blocked by `issues/105-pickup-operator-province-console-menu.md` (operator menu to select from).

## User stories addressed

- User story 5
- User story 6
- User story 7
