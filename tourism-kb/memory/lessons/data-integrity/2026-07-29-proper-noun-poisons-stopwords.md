---
name: 2026-07-29-proper-noun-poisons-stopwords
description: "A proper noun (Che he, a shop) harvested into the dish-token stopword set silently deleted the very entity it named from the matching dictionary."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-29
  source: tourism-kb
  refs: []
---

# a label that is a PROPER NOUN poisoned the generic-token set and deleted the very entity it named

`mon_an_dalat.json` lists `Chè hé` among 30 dishes. It is not a dish; it is a specific long-standing dessert shop in Đà Lạt, and that was my error at Phase T. Measured consequence: the token `he` entered `MON_TU` (the dish-word set deciding whether a business name carries anything distinctive), so `Quán Chè Hé` reduced to `{quan, che, he}` = all dish-or-generic tokens, `co_ten_rieng()` returned **False**, and the shop was dropped from the matching dictionary **before any comparison ran**. One of the most famous entries on the list was erased by its own label. Exact inverse of the trap the filter was built for: there, a name equal to a dish name matched every vlog about that dish; here, a dish name equal to a shop name kills the shop. Both arise from one string being simultaneously a category and a proper noun. **Rule: before harvesting tokens from a label set into a stopword/generic set, check whether any label is itself a proper noun — a single such entry silently removes every entity whose name it is. Greppable smell: a `STOPWORDS`/`GENERIC`/`*_TU` set built by iterating a human-curated label list authored for a different purpose (display grouping) than the one it now serves (discrimination).** Sibling of the 2026-07-28 derived-stopwords entry, with the scoping lesson inverted again: there a hand-written list missed local filler words; here an auto-derived list absorbed a name it should never have held. Follow-up owed: `Chè hé` belongs as a *shop* under the `Chè` group in `sweep_monan.py`, not as a label.

Related: [[2026-07-28-handwritten-stopword-misses-local]]
