---
depends-on: [109-pickup-v2-schema-migration]
type: FEATURE
labels: [pickup-areas, operator, customer]
---

## Parent PRD

`issues/prd-pickup-areas.md` · design `docs/design/pickup-points-v2.md` §2.1–§2.2, §3, §4 (groups), §7 P1

## What to build

Design phase **P1 — station as a kind**. A station and a door-to-door point are the same
`OperatorPickupArea` table distinguished by `kind`; surface that everywhere a place is created, picked,
grouped, or snapshotted. No `custom` request here (that's 111) — this issue is purely the station/point
distinction end-to-end.

- **Operator places menu** (`PickupAreasClient.tsx`, `lib/catalog/createOperatorPickupArea.ts`,
  `updateOperatorPickupArea.ts`, validator `lib/core/validation/pickupArea.ts` `pointFields`): create + edit
  gain a **kind** selector "Bến xe" (`station`) / "Đón tận nơi" (`pickup`) + a list **badge**. Dedup stays
  `(wardCode, name)` active. Default the selector to `station` (most VN menu entries are bến xe — QA P3.1).
- **Per-trip / template pickers grouped by kind** (`trips/new/page.tsx`, `TripDetailClient.tsx`
  `PickupMenuItem`, `trip-templates/page.tsx`): the server-component area maps currently emit `{id,label}`
  only — add `kind` to all three (+ the `PickupMenuItem` interface) or grouping silently no-ops (QA operator P3.3).
- **Snapshot kind** in the four writers: `createTrip.ts`, `setTripPickupAreas.ts`, `createTemplate`,
  `generateFromTemplate.ts`. First three select from `OperatorPickupArea` (add `kind: true` + `kind: a.kind`).
  **generateFromTemplate copies the `TemplatePickupArea` snapshot, not a fresh place select** — add `kind:true`
  to the `template.pickupAreas` select (~`:67`) + `kind: a.kind` to the createMany (~`:176`) (QA consistency P2).
- **Customer + operator API returns kind**: extend `GET /api/trips/[id]/pickup-areas` response to include
  `kind` (currently selects `{operatorPickupAreaId, label}` only).
- **Grouped customer picker** (`CustomerForm.tsx`): Bến xe group / Đón tận nơi group via `SelectGroup`/`SelectLabel`.

### QA fixes folded in (must land in this issue)

- **Enum mapping footgun (edge P3-5)**: `PickupPlaceKind{station,pickup}` ≠ `PickupKind{station,point,custom}`
  — operator picks `pickup`, traveler's booking is `point`. Add an explicit `pickupPlaceKindToPickupKind`
  helper (`pickup→point`, `station→station`). **Never `as`-cast between the two enums.**
- **Legacy re-tag (operator P1.1/P1.4)**: migration defaulted every existing area to `pickup`, mislabeling
  real stations. Ship the kind-edit control in THIS release; add a heuristic to the migration-A `UPDATE`
  (`name ~* 'Bến xe|^BX'` → `station`) OR a one-time post-migration banner on `/op/pickup-areas`
  ("X điểm chưa phân loại Bến xe/Đón tận nơi") with inline per-row kind toggles.
- **Kind-edit drift (operator P1.2)**: flipping a place's kind does NOT re-snapshot already-enabled
  `TripPickupArea`/`TemplatePickupArea`. Pick one and implement: (a) block kind edit while referenced by any
  non-departed `TripPickupArea` (return `kind_locked`), or (b) on edit offer "cập nhật N chuyến sắp tới"
  re-snapshot. Silent drift is not acceptable — document the chosen behavior inline.

## Acceptance criteria

- [ ] Operator create + edit set `kind`; list shows a kind badge; validator `pointFields` includes `kind` (covers create+update).
- [ ] All four snapshot writers persist `kind`; `generateFromTemplate` propagates it from the template snapshot (integration test).
- [ ] `GET /api/trips/[id]/pickup-areas` returns `kind` per area.
- [ ] Customer picker renders two groups (Bến xe / Đón tận nơi); operator per-trip + template pickers group by kind.
- [ ] `pickupPlaceKindToPickupKind` helper exists + unit-tested; grep confirms no `as`-cast between the two enums.
- [ ] Legacy areas are re-taggable (heuristic in migration OR banner+toggle); a default-`pickup` station can be corrected without a DB edit.
- [ ] Kind-edit drift handled (lock OR re-snapshot) with an inline-documented decision + test.
- [ ] `pnpm tsc --noEmit` + `pnpm test` green; `pickupSelection.test.ts` / `createTrip.test.ts` / `operatorPickupArea.test.ts` fixtures carry `kind`.

## Blocked by

- Blocked by `issues/109-pickup-v2-schema-migration.md` (the `PickupPlaceKind` enum + `kind` columns).

## QA provenance

2026-06-09 4-agent QA of `docs/design/pickup-points-v2.md`: operator P1.1/P1.2/P3.1/P3.3, consistency P2/Claim-4, edge P3-5.
