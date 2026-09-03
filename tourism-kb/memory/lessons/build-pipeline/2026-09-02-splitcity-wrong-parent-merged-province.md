# split_city carved Vũng Tàu from the wrong parent + a mis-placed center, filling a hot city with another province's records

**Date:** 2026-09-02
**Domain:** build-pipeline

## What happened
The live AI planner produced a Vũng Tàu itinerary full of obscure Đồng Nai churches
("Thánh thất Dầu Giây", "Chùa Long Giao"), with zero real Vũng Tàu icons. `export/vung-tau/diem-den.json`
held 21 records, **all with `tỉnh Đồng Nai` addresses** — not one Vũng Tàu point. The `areas.json`
hand-list (`signatureSpots: tượng chúa kitô / bãi sau / hải đăng…`) was correct, but there was nothing
in the data for the runtime marquee to pin, so the itinerary fell back to junk.

Root cause was a single line in `code/split_city.py` UNITS:
`("dong-nai", "vung-tau", "Vũng Tàu", 10.87, 107.10)`. Two independent errors compounded:
1. **Wrong parent.** Bà Rịa-Vũng Tàu merged into **ho-chi-minh** in the 2025 mergers
   (`parse_csdl_dest.py:52` maps `"ba ria - vung tau": "ho-chi-minh"`). The real 106 Vũng Tàu points
   (Cổng lên tượng Chúa Kito Vua, Mũi Nghinh Phong, Công viên Tao Phùng) live under
   `export/ho-chi-minh/`, never under `export/dong-nai/`.
2. **Wrong center.** 10.87N is ~55 km north of the real city (10.35N). The R_DD=22 km radius carve
   therefore captured Đồng Nai inland (Long Khánh / Cẩm Mỹ / Dầu Giây) instead of the coastal peninsula.

Fix: repoint the UNIT to `("ho-chi-minh", "vung-tau", "Vũng Tàu", 10.35, 107.08)`, re-run split_city
(21 → 97 records, place_id 91/97), dedup 2 same-place_id pairs → 95, sync meta count. Itinerary then
surfaced Bãi Sau / Tượng Chúa / Nghinh Phong / Bạch Dinh / Thích Ca. Committed `351edb02`, uploaded
`tourism/vung-tau/*` to R2 `bbvn-prod`, redeployed prod (store.ts cache is no-TTL so a redeploy is
mandatory for the fix to go live).

## Why the usual checks missed it
`split_city.near()` keeps only records within R_DD of the declared center, so **by construction the
records always cluster near the center** — a centroid-offset or radius audit reads "healthy" even when
the center sits in the wrong city. The distinguishing signal is the *record content*: the dominant
address province, and whether the named icons actually appear. An audit of all 20 UNITS on those
signals found vung-tau was the only wrong-parent case (post-merger province renames like
Hà Giang→Tuyên Quang for `dong-van` are expected, not bugs).

## The rule
For a split/carve UNIT of a **merged** province, the parent MUST be the post-2025 parent per
`parse_csdl_dest.py` (not the pre-merger neighbor), and the center MUST be the real town coordinate,
not an approximate one — a wrong center still passes every distance/radius check because the radius
filter guarantees proximity to whatever center you gave it. Verify a new/edited UNIT by the resulting
records' **address province** and by whether its `areas.json` signatureSpots actually resolve to
records, never by centroid offset alone.
