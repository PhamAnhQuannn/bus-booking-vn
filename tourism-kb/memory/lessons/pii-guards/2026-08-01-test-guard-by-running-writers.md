---
name: 2026-08-01-test-guard-by-running-writers
description: "To test a write-guard, call the guard predicate — never run the real writer it fronts; running it overwrote the parity anchor."
metadata:
  type: reference
  domain: pii-guards
  date: 2026-08-01
  source: tourism-kb
  refs: []
---

# I tested a WRITE-guard by running the writers — so three of them wrote, and one overwrote the parity anchor

Adding `duong_dan_ra.kiem_loi_ra()` to stop the tourism builders emitting outside the gitignored roots, I proved it two ways. The good way: a standalone `test_duong_dan_ra.py` with 23 bia paths covering both directions, `..` traversal and absolute paths. The bad way, done right after: invoking all five real builders with a bad `OUT` to watch them refuse, then invoking them again with a *good* `OUT` to prove they still accept. **The second half is not a test, it is a run.** The guard passed and the builder then did its whole job: `build_report.py` and `build_data_report.py` created two `.docx` files I had invented as target names, and `build_huong_dan_docx.py` regenerated `.tourism-data/build/Huong-Dan-Da-Lat.docx` — the merged parity anchor. `kiem_parity.py` then correctly reported `LECH BUILD … cach nhau 273 phut`, because the `.md` half was from 15:10 and I had just moved the `.docx` to 19:43. Content was unaffected (`guide_data.json` still stamped 15:10:11, so the rebuild read identical input) and nothing is pushable (all three paths are gitignored), but the provenance relationship between the pair was mine to break and I broke it while testing something else. Two things stopped it being worse, both pre-existing guards written for other reasons: `build_huong_dan.py` **hard-stopped** rather than writing, because its id-stability check saw 29 of 36 `DL-xx` ids would shift; and the freshness check added to `kiem_parity.py` after the 31/07 entry is exactly what surfaced the skew. **Rule: to test a guard that sits in front of a side effect, call the GUARD, never the thing it guards. `duoc_phep(path)` is pure and answers the question; `python build_x.py <args>` answers it too and then rebuilds a document. Splitting the predicate out of `kiem_loi_ra` was already the right design — I just didn't use it for the second half of my own test. Greppable smell: a verification step that invokes a real entry point (`python scripts/…`, `pnpm <task>`) in order to observe a check that a unit-level function already exposes.** Corollary on cleanup: I deleted the two invented files, and deliberately did NOT `touch` the anchor's mtime back — faking a timestamp to silence a freshness guard is the one repair that makes the next reader's evidence wrong.

Related: [[2026-07-31-docx-crash-parity-blessed-stale]]
