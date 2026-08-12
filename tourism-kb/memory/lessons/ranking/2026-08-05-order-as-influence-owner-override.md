# Owner overrode the "order ≡ number, equal risk" doctrine: customer output now sorted by internal VQS influence, numbers still never printed

**Date:** 2026-08-05
**Domain:** ranking

## What happened
The project doctrine (`xep_hang_song.py:16-19`, README "Ranh giới đã chốt") held that in a
shipped/frozen artifact, storing the letter grade "A" and storing the ROW ORDER carry **equal**
risk — a frozen ranking goes stale silently either way — so customer output was ordered by
DISTANCE, explicitly "KHÔNG theo chất lượng." The product owner decided the opposite: customer
output (`export/<slug>/nha-hang.json`, `khach-san.json` + nhà hàng docx) is now **sorted by the
internal VQS influence order** (from gitignored `noi-bo/rank_*`), while **no score/★/count/grade
is ever printed** — the ORDER is the only signal. Staff read the order to advise; the AI planner
(`plan.ts`) consumes it top-down.

## Why it matters
This is a deliberate doctrine reversal by the owner, not a bug. Two tradeoffs were surfaced and
accepted: (1) the shipped order is a frozen ranking that ages like any printed one; (2) the order
is derived from Google rating (ToS treats derived data with no persistence exception) — so a
shipped file now carries a Google-derived sort. Mitigations kept: numbers never ship, the rank
file stays gitignored (only its ORDER flows into export), rating stays live via `place_id`.

## How to apply
- A hard doctrine can be overridden by the product owner — record it as a DECISION with the
  tradeoff and a dated `## Thứ tự ảnh hưởng` / `SPEC CONFLICT` note at each reversed site
  (`export_planner.py`, `build_nha_hang_docx.py`, `plan.ts`), not a silent edit.
- Mechanism: `anh_huong.py` joins record↔rank by `place_id` then `fold(ten)`; unranked records
  keep prior relative order (stable sort, sink to bottom).
- **Coverage caveat:** the ranked set (place_id → VQS) is usually a different population than the
  curated export, so reordering only meaningfully sorts the overlap — DL restaurants ~30/250,
  hotels ~57/221. Reordering ≠ re-selecting membership; the top-VQS items may not be in the export
  at all (GoGi/Fungi/KFC ranked 1-4 but absent from curated 250). To deepen, rank more of the
  exported set (resolve their place_id) — see [[2026-07-31-youtube-lodging-sweep-wasted]] for the
  join-axis caution.
- The deterministic planner must be changed too or the order is inert: `plan.ts` re-sorts by
  distance/score and ignored incoming array order — now `chonNhaHang` prefers influence order
  within a geographic cap, `pickHotel` takes influence #1.
