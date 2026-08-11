---
name: 2026-08-08-overture-landmark-catchall-refine
description: "Overture's landmark_and_historical_building (and arts_and_entertainment) is a catch-all, not a specific type — mapping it to a specific experience label mislabeled waterfalls/parks/theme-parks; a source category that is itself generic must not drive a specific-label decision, and the mandatory diff review is what caught it."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-08-08
  source: tourism-kb
  refs: ["2026-07-30-unfalsifiable-count-check-toponym", "2026-07-30-proximity-not-identity"]
---

# Overture `landmark_and_historical_building` is a catch-all — mapping it to a specific label mislabeled thác/công viên/theme-park

Building the tầng-2 refine (`enrich_trai_nghiem.py`): match each ambiguous-category điểm đến to the
nearest Overture attraction POI (name-fold + token, ≤300 m), then map the Overture `category` to a
finer experience label (`ngắm cảnh` / `tâm linh` / `lịch sử`…). First run: **113 labels changed across
31 provinces**, and the mandatory diff review showed a systematic false-positive pattern —
`landmark_and_historical_building` was swallowing **Thác Voi, Thác Prenn, thác Thăng thiên** (waterfalls
→ "Tham quan lịch sử / kiến trúc"), **Suối Tiên, Công viên Thủ Lệ, VinWonders** (theme-park/park →
historic), and `arts_and_entertainment` mislabeled **Hồ Cá Trí Nguyên** (an aquarium → "nghệ thuật").

The name match was usually to the *right* entity — the defect was upstream: `landmark_and_historical_building`
is Overture's **catch-all for "notable place," not a claim of "historic building,"** so mapping it to a
specific label manufactured a fact the source never asserted. Same for `arts_and_entertainment`. Removing
just those two generic categories from `OVT_EXP` (keeping only specific ones: temple, church, museum,
waterfall, lake, park, beach, bridge, market, amusement_park, zoo…) dropped false positives to a clean
**70 refines / 22 provinces (~95% precision)**, and the non-matches safely keep the tầng-1 label.

**Rule: a third-party category that is itself a catch-all/generic bucket must NOT be mapped onto a
specific downstream label — the specificity you emit cannot exceed the specificity the source asserts.
Before trusting a source's taxonomy to DRIVE a decision, enumerate its buckets and quarantine the
generic ones (grep for `landmark`, `attractions_and_activities`, `tourist_attraction`,
`arts_and_entertainment`, `point_of_interest`).** Corollary paid for again here: the refine was
ADDITIVE + conservative (no-match ⇒ keep the safe base) and every changed label was dumped to a diff
file for human eyeball — that mandatory review, not the code, is what surfaced the pattern. Greppable
smell: a `{source_category: specific_label}` map that includes a bucket whose own name contains
"landmark", "attraction", "entertainment", or "poi".
