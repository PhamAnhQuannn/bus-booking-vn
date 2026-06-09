---
depends-on: [issue-103, issue-104]
labels: [pickup-areas, operator]
---

## Parent PRD

`issues/prd-pickup-areas.md`

## What to build

The operator-facing setup: capture the operator's **province on the public application**, and a post-approval **console pickup-area menu** CRUD.

- Application (`app/op/register`, its route + `lib/onboarding/registerOperator.ts` + validation): add a **province picker only** (uses `AdminUnitPicker` at province level) → persist `Operator.provinceCode`/`provinceName`. No area entry pre-approval.
- Console (post-approval): new `app/op/(console)/pickup-areas/` page + client, `app/api/op/pickup-areas/**` CRUD, and `lib/catalog/*OperatorPickupArea*` services mirroring existing catalog services (`createRoute.ts` pattern + `withOperatorScope`). Add / edit / **deactivate** menu entries; the picker defaults to the operator's province. Deactivation is a soft flag (`isActive=false`) so historical bookings keep their snapshot.

See PRD §"Operator surfaces".

## Acceptance criteria

- [ ] Application form collects + persists province; rejected applications carry no area rows.
- [ ] Console menu lists the operator's areas, ordered; create/edit/deactivate work and are tenant-scoped (cannot touch another operator's areas).
- [ ] Each area entry stores province/district/ward codes + names + denormalized `label`.
- [ ] Picker defaults to the operator's province.
- [ ] Deactivate sets `isActive=false` (no hard delete).
- [ ] API validates input (zod) + `requireOperatorAuth`; unit tests on the service layer (prior art: `lib/catalog/__tests__`).
- [ ] `pnpm tsc --noEmit` + `pnpm test` green.

## Blocked by

- Blocked by `issues/103-pickup-vn-admin-dataset-loader-picker.md` (picker + loader).
- Blocked by `issues/104-pickup-schema-migration-pickuppoint-removal.md` (`OperatorPickupArea` model + Operator province fields).

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 4
