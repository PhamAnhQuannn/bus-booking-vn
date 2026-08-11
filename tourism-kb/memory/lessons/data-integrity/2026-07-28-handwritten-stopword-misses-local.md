---
name: 2026-07-28-handwritten-stopword-misses-local
description: "A hand-written stopword list for name matching always misses the local filler words (province/city names inside hundreds of business names); derive stopwords from corpus token frequency."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# a hand-written stopword list for name matching always misses the LOCAL filler words — derive stopwords from the data

Building the curated 36-place Đà Lạt guide, the catalogue's precision-biased merge (150 m + name containment) under-merged badly: 8 duplicate pairs in 36 rows — Datanla, Prenn, Thác Voi, Bảo tàng Lâm Đồng, Hồ Tuyền Lâm, Hồ Xuân Hương, and Nhà thờ Con Gà vs Nhà thờ Chính Tòa Đà Lạt (the same cathedral under two unrelated names). Invisible at 1,361 rows, glaring at 36. Adding a keyword-overlap rule (≥2 shared tokens) then over-merged in the other direction because my hand-written `HEAD_WORDS` stoplist covered category nouns (`chùa`, `thác`, `hồ`) but not the *place-name filler that saturates this specific city*: **`lâm`, `đồng`, `viên`, `lạt`**. Result: `Thiền Viện Trúc LÂM` swallowed `Quảng trường LÂM VIÊN` (shared {lâm, viên}), and `Bảo tàng LÂM ĐỒNG` swallowed `Vườn Lan Lâm Đồng`, `Gạo ruộng Lâm Đồng` and `Da Lat City, Lam Dong` (shared {lâm, đồng}) — a headline destination silently deleted from the output and three unrelated businesses fused into a museum. Fix: compute document frequency over all 1,361 normalised names and treat any token appearing in >1% of them as a stopword, on top of the hand list; also tighten the weakest rule (keyword overlap) to a 2 km radius while exact-name matches get 5 km — or unlimited when the name is ≥12 chars, since a lake's centroid legitimately differs by kilometres between sources. **Rule: any name-matching heuristic that ignores "common" tokens MUST derive that list from token frequency in the actual corpus, never from a hand-written list — the words that carry no discriminating power are dataset-specific (here, the province and city name appear inside hundreds of business names) and a human will always enumerate the category nouns and forget the toponyms. Greppable smell: a `STOPWORDS`/`COMMON_WORDS` set literal used by a fuzzy-match or dedup function.** Corollary on validation: false merges are only visible by reading the merged rows' alt-name lists — a count of "N rows merged" looks like progress whether the merges were right or wrong, so print the alt-name list and eyeball it before trusting the number.
