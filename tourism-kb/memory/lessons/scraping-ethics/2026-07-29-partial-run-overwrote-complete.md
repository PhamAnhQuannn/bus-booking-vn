---
name: 2026-07-29-partial-run-overwrote-complete
description: "A per-day API quota makes mid-run truncation the normal case — a partial run overwrote a 72-row file leaving 2; never let a poorer newer result overwrite a richer one."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-29
  source: tourism-kb
  refs: []
---

# a partial run overwrote a complete one and destroyed 72 rows — a per-DAY quota makes mid-run abort the NORMAL case, not the exception

`sweep_youtube_quan.py` harvests vlog-recommended eateries across 33 queries. First run collected **72 establishments**. A later run hit `429 Quota exceeded for quota metric 'Search Queries'` on its third query, collected **2**, and then `json.dump`'d unconditionally — 72 rows became 2, with no backup anywhere (checked the scratchpad and git). The root miscalculation: I budgeted against the 10,000 units/day figure and treated `search.list` as costing 100 units, which it does — but it ALSO counts as 1 call against a **separate ~100-calls/day `Search Queries` limit**. Two quotas, one of which I never looked up. Under a per-day quota, **a run that dies partway through is the ordinary case and must be designed for**; my script treated it as an anomaly. Same family as the already-logged *"a filter decides what to KEEP, never what to SAVE"*: here a **poorer** result must not replace a richer one merely because it is **newer**. Fix: if the run recorded any error AND produced fewer rows than the file on disk, write to `quan_vlog.dorang-<N>quan.json` and leave the main file untouched. **Rule: any script whose data source is metered per day must treat truncation as an expected exit, and must never let a truncated result overwrite a fuller one. Greppable smell: an unconditional `json.dump(out, ...)` at the end of a loop that can `break` on an HTTP error.** Corollary on quota accounting: when an API documents cost in "units", check whether the same call also consumes a separate per-endpoint daily counter — the units budget can be 97% unused while the call budget is exhausted.

Related: [[2026-07-28-fetch-parse-split-rebroken]]
