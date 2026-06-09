---
depends-on: [issue-103]
labels: [pickup-areas, schema, migration, refactor]
---

## Parent PRD

`issues/prd-pickup-areas.md`

## What to build

The data-model spine + the teardown of the legacy pickup feature, in one greenfield migration (pre-launch, no prod data).

**Add** (Prisma):
- `Operator.provinceCode` / `provinceName`.
- `OperatorPickupArea` (operator-scoped menu), `TripPickupArea` (per-trip subset), `TemplatePickupArea` (recurring-template subset) — shapes per PRD §"Data model".
- `pickupKind` enum (`station | area`); Hold + Booking gain `pickupKind`, `pickupAreaId` (nullable FK → `OperatorPickupArea`), `pickupAreaLabel` (snapshot), `pickupDetail`.

**Remove** the legacy route-scoped `PickupPoint` and all touchpoints (PRD §"Removal of legacy PickupPoint"): model + `Route.pickupPoints` relation + `Booking.pickupPointId`/`pickupNote`; its service layer, API routes, console panel, validation schemas, redaction-list entries; repoint the booking-display chain to the new fields (display only — read-only behavior detailed in 108); replace seed data.

**Migration**: one new forward migration — create new tables/columns/enum, default existing rows to `pickupKind='station'`, then drop `PickupPoint` + old columns. Reseed. Declare non-partial indices in BOTH `schema.prisma` and SQL (Issue 007 rule).

This slice keeps the app compiling + tests green after the sweep; new UI/flows arrive in 105–108.

## Acceptance criteria

- [ ] New models + Operator province fields + Hold/Booking pickup fields + `pickupKind` enum in `schema.prisma`.
- [ ] `withOperatorScope` used for `OperatorPickupArea` reads/writes.
- [ ] One greenfield migration; `pnpm prisma migrate dev` clean (no drift prompt); index parity schema↔SQL.
- [ ] `PickupPoint` model + service/API/panel/validation deleted; booking-display chain repointed to `pickupAreaLabel`/`pickupDetail`.
- [ ] Redaction lists (`lib/logger.ts`, `lib/observability/sentry.ts`) use `pickupDetail`, not `pickupNote`.
- [ ] `prisma/seed.ts` seeds `OperatorPickupArea` + `TripPickupArea` from the dataset (issue-103).
- [ ] Deleted-model tests removed; remaining suites green.
- [ ] Grep `PickupPoint|pickupPointId|pickupNote` over `app/ lib/ prisma/schema.prisma` returns zero.
- [ ] `pnpm tsc --noEmit` + `pnpm test` green.

## Blocked by

- Blocked by `issues/103-pickup-vn-admin-dataset-loader-picker.md` (seed + label snapshots use the dataset/loader).

## User stories addressed

- User story 16
- User story 17
- User story 18
