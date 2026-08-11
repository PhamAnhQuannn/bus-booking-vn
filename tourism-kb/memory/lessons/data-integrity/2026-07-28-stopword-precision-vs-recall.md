---
name: 2026-07-28-stopword-precision-vs-recall
description: "A frequency stopword list raises precision and destroys recall — right fix for an over-matching bug, wrong fix for its recall mirror; check which direction a reused fix errs."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# a frequency-derived stopword list is the right fix for one name-matching bug and the wrong fix for its mirror image

Matching the 36 curated places back to their Overture rows to recover the `socials` column (the merge had dropped it — 1,422 merged rows, 0 with socials, against 20,847 in the source). The substring rule fired on `Chợ Đà Lạt` ⊃ `Đà Lạt`, binding the market to a **generic city-promo page**. My first fix reused the 28/07 remedy — drop tokens appearing in >0.5% of names — which promptly rejected the *correct* match for `Quảng trường Lâm Viên`, because `lâm`, `viên` and `trường` are all high-frequency in Đà Lạt and the name was erased to nothing. The two bugs look identical and want opposite treatments: **frequency tells you which tokens carry no discriminating power; it does not tell you whether a name still has content.** What actually separates the bad match is that the *shorter* name consists **entirely of place-name tokens** (`da lat`) with no proper noun left — a set derivable from the existing `GENERIC` phrase list, not from corpus statistics. Result 35/36, with `Chợ Đà Lạt` correctly reported as unmatched rather than silently bound to the wrong page. **Rule: before reusing a fix from a previous name-matching failure, check which direction it errs. A frequency stoplist raises precision and destroys recall; applying it to a recall bug makes things worse while looking like diligence.** Two independent validity checks then earned their keep on different failures: phone-vs-Overture cross-check confirmed **17/17** matched pages, but could not see the three pages that redirected to a *different* Facebook ID — and those three turned out to be a **plant shop** sold as the public flower garden, a **`Nhà riêng` listing run by `checkin.vn`** sold as Hồ Xuân Hương (its "phone" being checkin.vn's own hotline), and a third-party directory page. **A single validity check is a single failure mode; the redirect check caught exactly what the phone check structurally could not.**

Related: [[2026-07-28-handwritten-stopword-misses-local]]
