---
name: 2026-07-27-category-crosswalk-one-label
description: "A category crosswalk reading one merged label mislabels every merged row — accumulate a kinds set through the merge and classify over the union, not the surviving representative."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-27
  source: tourism-kb
  refs: []
---

# a category crosswalk that reads one merged label mislabels every merged row

After merging places across OSM/Overture/Foursquare/Wikidata, the merged record kept a single `kind` — whichever source happened to land first — and the Vietnamese category crosswalk ran on that one string. Result: **Thung lũng Tình yêu** (a lake-and-park valley) came out as *Dinh thự / Di tích* because Overture tags it `landmark_and_historical_building`, and **Đồi Mộng Mơ** (a theme park) came out as *Lưu trú* because one contributing row was `TTC Resort - Đồi Mộng Mơ`. Both are headline destinations, so the error was visible in the first four rows of the first area — a spot-check caught it, not a test. The same place carried 8 different Overture categories (`park`, `travel`, `active_life`, `landmark_and_historical_building`, `holiday_rental_home`…). Fix: accumulate a `kinds` **set** through the merge and crosswalk over the union, with the crosswalk list's order as explicit priority; emit the runners-up as a sub-label so nothing is dropped. Priority also had to be tuned against the data, not against intuition — `Công viên` now outranks `Dinh thự` because Overture labels parks as historical landmarks far more often than it labels palaces as parks. **Rule: when records from N sources are merged, every classified attribute must be derived from the union of all N source values, never from the surviving representative. The merge picks a winner for display fields; it must not silently pick a winner for fields a downstream classifier reads.** Greppable smell: a merge that does `hit[k] = hit.get(k) or r[k]` for a field that is later fed to a mapper/classifier.
