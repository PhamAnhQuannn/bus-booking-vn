---
name: 2026-07-28-facebook-default-hours-noise
description: "12/35 Facebook opening-hours values were platform defaults (10x 'always open' on ticketed attractions) — a high fill-rate on a default-valued field is not coverage; inspect the distribution."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# the field that looked most valuable was entirely noise, and 12 rows of it would have looked like progress

Same crawl. Facebook returned an opening-hours value for 12 of 35 places, which on the tally looked like the best yield of the pass. Reading them: **10 are `Luôn mở cửa` ("Always open")** — including Crazy House, Thác Prenn, Đồi Mộng Mơ and Khu Di Tích Dinh Bảo Đại, all **ticketed attractions that certainly close at night**. It is Facebook's default when the owner never sets hours: an empty field rendered as a positive claim. The other 2 are `Đang mở cửa` — the status *at fetch time*, not a schedule. So the pass yielded **zero** usable opening hours, and writing all 12 would have replaced "unknown" with "wrong" on the single most consequential field in a trip guide. Recorded as an explicit negative in the script's own docstring instead. Two sibling filters applied for the same reason: `% recommend` is gated at ≥50 reviews (`100% / 6 đánh giá` is not a signal) and kept in its own `ty_le_gioi_thieu` field, never mapped to `Đánh giá của khách` — different scale, different distribution; and the Facebook address was dropped wholesale because it carries **pre-merger ward names** (`Phường 4`, `Phường 8`), owner-entered once and never revised, where Pass 9's Nominatim addresses already use the post-Nghị-quyết-202/2025/QH15 names. **Rule: a high fill-rate on a field whose default value is indistinguishable from a real one is not coverage — inspect the value distribution before emitting, and if one constant dominates, suspect it is the platform's placeholder rather than the world's answer. Greppable smell: an enrichment pass reporting a field count without ever printing the field's most common values.**
