---
depends-on: [038-scaffold-lib-core-tenant-helper-lint]
type: FEATURE
wave: 1
spec: [SYS03, S01, S02]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS03] / [S01] / [S02]

## What to build

The canonical **`Place`** entity (one-way door, foundational — feeds route creation +
search typeahead + later charter pickup/destinations). Today routes are free-text
`origin`/`destination` and typeahead UNIONs raw `Route` columns (`getSearchablePlaces.ts:11-18`)
— the "Ha Noi / Hanoi / HN" fragmentation the spec forbids (#13).

- Add `model Place(id, canonicalName, aliases String[], slug?, createdAt)` + migration.
- Add `originPlaceId` / `destPlaceId` FKs to `Route` (keep free-text columns for now as a
  back-compat shim; a backfill maps existing distinct origin/destination strings → seeded
  Place rows). Index `(originPlaceId, destPlaceId)`.
- Backfill migration: create Place rows from existing distinct route strings (best-effort
  alias merge for obvious dupes), set the FKs. Document any manual-merge follow-up.
- Replace typeahead source: `getSearchablePlaces` reads `Place` (canonicalName + aliases),
  not raw route columns.
- Route create/edit (`app/api/op/routes/**`, `lib/routes/**`) selects a Place (or creates
  one) instead of typing free text.
- `lib/catalog`/`lib/places` home for the Place repo (per SYS20 target; place under the
  scaffolded tree, tenant-helper N/A — Place is global, not operator-owned).

## Acceptance criteria

- [ ] `Place` model + migration (schema.prisma + SQL); `Route` has `originPlaceId`/`destPlaceId`.
- [ ] Backfill seeds Place rows from existing routes; existing routes resolve to a Place.
- [ ] Typeahead returns canonical Place names/aliases, not raw route strings.
- [ ] Route create/edit references a Place.
- [ ] Search still works against the place-linked routes (no regression in `searchTrips`).
- [ ] Index `(originPlaceId, destPlaceId)` present.

## Blocked by

- Blocked by `issues/038-scaffold-lib-core-tenant-helper-lint.md`

## User stories addressed

- [S02] typeahead backed by canonical Place; [SYS03] dedupe Ha Noi/Hanoi/HN (#13).
