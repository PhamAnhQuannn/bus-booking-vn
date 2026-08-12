---
name: 2026-07-29-independence-count-channel
description: "An independence threshold must count the independent actor (channelId), not the artifact (videoId) — one channel's many videos or a reupload farm satisfies the bar with zero corroboration."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-29
  source: tourism-kb
  refs: []
---

# the evidence threshold counted `videoId` when the thing it was defending against is one CHANNEL

The rule *"mentioned in ≥2 different videos"* counted `videoId`, but `search.list` is biased toward keyword-stuffed listicle content (*"Top 10 quán ăn Đà Lạt"*) — precisely what the threshold exists to reject. One channel posting several videos, or a farm reuploading a single list, satisfies ≥2 with **zero independent corroboration**; the threshold measured volume while claiming to measure independence. `channelId` is already in the `videos.list` response, so the fix cost no quota, and the run now prints both (`Lẩu Gà Lá É Tao Ngộ` = 9 channels / 11 videos). **Rule: an independence threshold must count the independent ACTOR, not the artifact — artifacts are cheap to duplicate and the duplication is exactly the failure mode being screened out.** Operational finding that contradicted my own assumption while fixing the (already-logged) dual-quota bug: I reasoned the Pacific day had reset ~16 h earlier and was unused, then **died after 8 calls**, because prior same-day usage was invisible — the day-log I had just added did not exist yet. **A day-scoped budget file reading zero is not evidence of an unused budget; the first run after introducing one is untrusted.** Day boundary is computed at UTC−8 on purpose (rolls over ~1 h late in summer, erring toward *not* resetting early); actual reset is midnight Pacific = **14:00–15:00 Vietnam**.

Related: [[2026-07-29-partial-run-overwrote-complete]]
