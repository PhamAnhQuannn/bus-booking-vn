---
name: 2026-07-29-overwrite-guard-three-holes
description: "An overwrite guard for scraped data had three holes: non-atomic write, unreadable-treated-as-absent baseline reset, and the check running after the non-refundable quota was spent."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-29
  source: tourism-kb
  refs: []
---

# my own overwrite guard had three holes, one of which re-armed the exact failure it was added to prevent

After a partial run overwrote a complete one (next entry below), I added: on error, if the new result has fewer rows than the file on disk, write to a side file instead. Auditing that guard found three defects. (1) `json.dump` wrote **directly to the destination**, so an interrupt mid-write leaves corrupt JSON — now temp file plus `os.replace`, one atomic swap. (2) The baseline read was `except Exception: cu = []`, conflating *unreadable* with *absent* and **silently resetting the comparison baseline to empty**, making every later result look like an improvement — so a corrupt file disables the guard, and defect (1) is precisely what produces a corrupt file. The two compose back into the original bug. An unreadable-but-present file is now a hard stop. (3) I placed that check **after** the API loop, so a corrupt baseline would have consumed the whole non-refundable daily quota and *then* refused to save. Moved to startup; verified it exits 1 having spent nothing and leaves the baseline untouched. **Rule: any check that can abort a run must run before the run spends a non-refundable resource. And a guard reading prior state must distinguish missing from unreadable — collapsing them into a default is how a safety check becomes a no-op exactly when needed. Greppable smell: `except: <baseline> = []` / `= 0` / `= {}` around a load whose value gates a destructive write, and any bare `json.dump(..., open(path,"w"))` for a file costlier to recreate than to write.** Fixed alongside: `403` was treated uniformly as quota exhaustion without reading `error.errors[0].reason`, so the 28/07 **revoked key** (`API key expired`) yielded the advice "wait until tomorrow", which cannot fix a revoked key. And a correction to my own written figures: I had recorded the co-occurrence coverage gain as *754 → 5.186, 7×*. Re-measured against 5,543 Overture eateries it is **897 dish-attributed → 4,976 reachable ≈ 5.5×**; the 754 came from a different measurement step, and I had conflated three distinct ceilings (897 full-phrase dish matches / 2,790 names containing any dish token / 4,976 names distinctive enough to match). Logged because a wrong multiplier in a plan gets quoted forward as settled.

Related: [[2026-07-29-partial-run-overwrote-complete]]
