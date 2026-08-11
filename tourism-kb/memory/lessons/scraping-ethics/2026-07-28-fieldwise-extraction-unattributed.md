---
name: 2026-07-28-fieldwise-extraction-unattributed
description: "A per-field regex over a whole listing page returns an unattributable bag of values; name the record first, segment into N blocks, then read fields — kept only names and a per-operator range."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# field-wise extraction across a whole page produces a BAG of values with nothing tying them together — and it looks exactly like data

Reading 14 Đà Lạt tour-operator websites for the three empty fields in the activity layer (duration, pickup time, price). The extractor ran one regex per FIELD over the whole page. A listing page with 8 tours therefore returned 8 durations and 12 prices **in one undifferentiated pool**, with nothing saying which price belongs to which tour: `DV-27 → 350.000đ … 1.620.000đ` across 3 tours, `DV-08 → 280.000đ, 500.000đ, 1.000.000đ, 2.000.000đ, 5.000.000đ`. Worse, the fields cross-contaminated — `"11 giờ 30"` is a *duration* that landed in the *pickup-time* column, and `"3 h"`, `"3:"`, `"3\nTr"` (broken across a line) were extracted as values at all. Attaching one of those numbers to a named tour in the guide would have been a fabricated fact wearing a source URL. **The entity being extracted was never the page — it was the tour card, and a page-level regex cannot see card boundaries.** Kept only what survives the question *"which record does this value belong to?"*: tour **names** (clean and checkable) and a per-**operator** price *range* explicitly named `khoang_gia_don_vi`, never `gia_tour`. Dropped pickup time and duration entirely. **Rule: before extracting a field, name the RECORD it is a field of. If one page contains N records, extraction must first segment into N blocks and only then read fields within a block — a per-field sweep over the page yields a bag whose members are unattributable, and unattributable values are indistinguishable from invented ones once they reach a document. Greppable smell: an extractor returning `string[]` per field from a whole-document `innerText`, with no per-item container.** Two collateral findings worth keeping: **7 of 14 operator domains did not resolve at all** (`canyoningdalat.com`, `dalatjeep.com`, `toursanmaydalat.com`…), matching Phase F's 3-of-8 dead-domain rate — small Vietnamese tour operators live on Facebook, not on websites, so a web-first strategy for this segment is wrong on the merits; and **0 of 14 sites stated a season**, so the seasonal gap (cỏ hồng, mai anh đào, dã quỳ) stays open and must not be filled from recall.
