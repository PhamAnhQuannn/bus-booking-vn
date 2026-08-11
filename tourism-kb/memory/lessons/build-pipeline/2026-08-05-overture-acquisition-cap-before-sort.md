# Overture-only acquisition for registry-less cities, and the cap-before-sort trap that makes a place_id resolver miss the export window

**Date:** 2026-08-05
**Domain:** build-pipeline

## What happened
Completed Nha Trang + Đà Nẵng nhà hàng + khách sạn the way Đà Lạt was done, but **Overture-only**
(no state CSDL registry): `sweep_luu_tru_overture.py` bulk-lists ALL lodging categories from
`overture_dalat.json` → `luu_tru.json` (minimal fields ten/lat/lon/dia_chi/dien_thoai/facebook/loai;
gia/tham_dinh/so_phong stay null), which `export_planner.py` then populates into `khach-san.json`
(NT 1616, DN 2975). Restaurants got a VQS influence rank via `resolve_quan_overture.py` →
`place_id_quan.json` → `rank_noi_bo_nha_hang.py`.

The load-bearing design decision: `export_planner.py` selects restaurants by `cand.sort(tin_cay desc)`
then **`cand[:250]` BEFORE `anh_huong.sap_xep` reorders**. So the place_id resolver had to resolve the
**exact same top-250-by-confidence set** the export will slice — NOT "N nearest to city center" (the
hotel resolver's pattern). Targeting nearest-center would have reproduced Đà Lạt's ~30/250 coverage
failure at worse scale (250/6097). Result after targeting: export top-3 == rank top-3 for both cities.

## Why it matters
Two bugs also surfaced and were fixed in `export_planner.py`, both specific to Overture-sourced hotels:
- **Provenance mislabel:** `tham_dinh=None` fell to the `SRC_TD` "Tự đăng ký" branch → claimed
  self-registration that never happened. Fixed with a 3-way branch + new `SRC_OT` "Overture aggregate,
  chưa xác minh". A value that reaches the record is a claim — unknown-source must say unknown.
- **place_id not merged:** `PID_MAP` only read `place_id.json`; NT/DN hotels/quán resolved into
  `place_id_luu_tru.json`/`place_id_quan.json` → merged so `identity.place_id` populates (stronger rank
  join than fold(ten), honest "rating live via google_place_id" claim).

## How to apply
- **New city without a state registry:** restaurants already come from `sweep_nha_hang.py` (pure Overture);
  hotels need `sweep_luu_tru_overture.py` (bulk, $0) — do NOT try to reuse `sweep_luu_tru.py` (CSDL/Lâm
  Đồng-locked). Rank needs a `resolve_*_overture.py` (Google place_id) per entity class.
- **Resolver must target the export's own selection, not an independent geographic cap** — replicate the
  export's sort+truncate exactly, or the ranked set and the shipped set diverge and the Google spend is
  wasted outside the export window. Cross-reference the two files' cap in a comment ([[order-as-influence-owner-override]]
  is the reordering half; this is the coverage half).
- **Minimal fields, but not fewer than the consumer needs:** check `ks_rec`/`export_planner` for the
  required keys (ten+lat+lon = map pin) before trimming; null-safe optional fields are fine, a missing
  required key is a KeyError.
- **Overture is dirty:** ~100% lat/lon but addresses are partial/rác and categories mis-tag (a food
  listing tagged `hotel`); accept the noise (no calibrated confidence cutoff exists) but let influence
  order sink it — see [[2026-07-31-youtube-lodging-sweep-wasted]] for the join-axis caution.
- **AI-system reality:** populating export ≠ user-visible. The trip-planner product surfaces
  (`parseIntent.ts` system prompt, wizard/header slug) are hardcoded Đà Lạt — a separate frontend track
  gates whether NT/DN data ever reaches a user. `golden-trip.ts` was parameterized by slug to test them.
