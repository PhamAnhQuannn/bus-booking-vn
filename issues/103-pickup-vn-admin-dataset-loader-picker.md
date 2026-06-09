---
depends-on: []
labels: [pickup-areas, foundation]
---

## Parent PRD

`issues/prd-pickup-areas.md`

## What to build

The foundation for the Personal Pickup Destinations feature: a vendored, version-pinned **3-tier VN administrative dataset** (Tỉnh → Huyện → Xã, official codes + names) and the two consumers everything else builds on — a pure **loader module** and a shared **cascading picker component**.

- Vendor a static JSON dataset under `lib/data/vnAdmin/` (no runtime fetch; document provenance + version in-repo).
- Deep loader `lib/geo/vnAdmin.ts` with a small stable interface: `listProvinces()`, `listDistricts(provinceCode)`, `listWards(districtCode)`, `resolveLabel({provinceCode,districtCode,wardCode})`.
- Shared `components/geo/AdminUnitPicker.tsx` — cascading province→huyện→xã selector, optionally defaulted to a given province; emits the selected code triple + resolved label.

No schema, no API, no wiring into other screens yet — those land in later slices. This slice is verifiable in isolation via unit tests + a throwaway render.

See PRD §"VN admin dataset" and deep-module #1.

## Acceptance criteria

- [ ] Dataset JSON committed under `lib/data/vnAdmin/` with documented provenance + pinned version note.
- [ ] `vnAdmin` loader returns correct districts for a known province and wards for a known district.
- [ ] `resolveLabel` of a valid triple returns the human label; unknown codes return a typed miss (not a throw).
- [ ] Loader is pure (reads bundled JSON only; no network/db).
- [ ] `AdminUnitPicker` renders the cascade, defaults to a passed-in province, and emits `{provinceCode, districtCode, wardCode, label}` on full selection.
- [ ] Unit tests cover loader list/resolve happy + miss paths (prior art: `lib/**/__tests__`).
- [ ] `pnpm tsc --noEmit` + `pnpm test` green.

## Blocked by

None - can start immediately.

## User stories addressed

Foundation for user stories 1, 2, 4, 5, 10, 12 (no story fully delivered alone).
