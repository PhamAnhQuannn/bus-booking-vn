---
name: 2026-07-29-concat-before-substring-match
description: "Never concatenate independently-authored text fields before substring matching — the seam fabricates matches present in no source field; use one boundary-aware matcher everywhere."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-29
  source: tourism-kb
  refs: []
---

# concatenating fields before substring-matching FABRICATES matches — predicted, then measured, and the phantom was real

`sweep_youtube_quan.py` matched eatery names against `fold(title + " " + description)`. Because the join is a plain space, a name can straddle the seam and match text present in neither field: `title="Review quán bánh căn"` + `description="Lệ phí gửi xe khá rẻ"` → `"...quan banh can le phi gui xe..."` contains `banh can le`, while matching each field separately returns **False for both**. I set the verification bar in advance — *"`Bánh Căn Lệ` phải được tính lại sau khi bỏ gộp chuỗi — nếu số video tụt thì lỗi ghép biên đã có thật"* — and the real run confirmed it: **9 videos → 8**. One of the nine was a seam artifact. Fixed by matching each field independently. **Rule: never concatenate independently-authored text fields before substring matching. The join creates character adjacencies existing in no source field, so any match spanning the seam is fabricated — and invisible, because the fabricated string reads plausibly. Greppable smell: `fold(a + " " + b)` or `" ".join(fields)` feeding an `in` test or a regex.** The same run surfaced the sibling defect one layer down: `mon_gan` tested dish presence with bare `mf in d`, so `Bánh canh Xuân An` (`banh canh xuan an`) was attributed the dish **`Bánh căn`** (`banh can`) as a prefix substring. That is the `bar`/`barber` · `sữa chua`/`sửa chữa` · `đồi chè`/`chè` trap for at least the fifth time here, arriving at a new position each time — now at the *attribution* step rather than the category filter. Fixed with one shared `tim_cum()` requiring a non-alnum boundary at both ends, used by BOTH the name match and the dish match. Symmetric risk it also closes: a vlog saying `chè hẻm` would otherwise match the shop `Quán Chè Hé`. **Corollary: one boundary-aware matcher used by every matcher on the path — a second hand-rolled `in` test is how this keeps returning.** Note the saved `quan_vlog.json` predates this fix, so its dish attributions still carry the artifact until the next full run.

Related: [[2026-07-29-proper-noun-poisons-stopwords]]
