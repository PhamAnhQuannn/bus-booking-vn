---
name: 2026-07-30-dedup-same-name-branches
description: "Before collapsing records that share a name key, measure inter-record distance — identical names are chains/branches as often as duplicates and the dedup reading silently destroys data."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-30
  source: tourism-kb
  refs: []
---

# an audit finding was WRONG, and acting on it would have made the number less true — same-name rows were branches, not duplicates

A review pass reported that `5.559 quán còn hoạt động` was inflated by scrape duplicates: 86 folded-name groups with 116 extra rows, `Lẩu Gà Lá É Tao Ngộ` ×10, `Napoli Coffee` ×6, and noted that dedup already existed for the closed list but not the open one. The remedy looked obvious and one-line. Measuring the pairwise distance inside each name group first **inverted the conclusion**: same-name rows sit **277 m to 29 km apart** (`napoli coffee` spans 24 km, `son lam quan` 29 km), and the number of same-name pairs closer than **50 m is zero** — under 100 m, two. Those are chains and branches, which is exactly what a city's restaurant list should contain. Deduping by name would have deleted real establishments and made the headline **lower** than the truth while looking like a correction, and it would have been defended by a "fixed the inflated count" note. Left deliberately un-deduped with the measurement recorded beside the closed-list dedup so the next reviewer does not refile it. **Rule: before collapsing records that share a key, measure the distance (or any independent axis) BETWEEN them. Identical names are evidence of a chain at least as often as evidence of duplication, and the two demand opposite treatment — the "duplicate" reading is the one that silently destroys data. Greppable smell: a dedup keyed on a name/title alone, with no second axis (coordinate, address, id, timestamp) in the key.** Sibling of the 2026-07-28 entry where a frequency stoplist was the right fix for one name-matching bug and the wrong fix for its mirror image: same lesson, arriving at the dedup step instead of the match step. Corollary about review findings generally: a finding that arrives with a plausible mechanism and a real count attached is still a hypothesis — the count (86 groups, 116 rows) was accurate and the conclusion drawn from it was not.

Related: [[2026-07-28-handwritten-stopword-misses-local]]
