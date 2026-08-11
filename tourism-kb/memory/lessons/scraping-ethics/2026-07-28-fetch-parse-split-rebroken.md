---
name: 2026-07-28-fetch-parse-split-rebroken
description: "Re-broke the fetch/parse split one script later by verifying inline and saving only on pass — a filter decides what to KEEP, never what to SAVE; report 'could not test' separately from 'failed'."
metadata:
  type: reference
  domain: scraping-ethics
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# I re-broke the fetch/parse split ONE STEP after writing the rule that created it

Phase O ended by splitting `fb_pages_crawl.mts` (fetch + save evidence) from `parse_fb_pages.py` (all field logic) precisely so that a wrong parser costs an offline re-run instead of 35 page loads. The very next script, `tour_sites_crawl.mts`, did identity verification **inline** and wrote the evidence file **only when verification passed**. The verification rule was too strict (it required name tokens ≥5 characters, so `toursanmay.vn` failed because the only qualifying token in its business name was `booking`), and the four sites it rejected had **no saved evidence to re-examine** — fixing the rule meant re-fetching every site. Worse, for a business named `Săn Mây Đà Lạt` **no token reaches 4 characters at all**, so the check is not merely strict but *inapplicable*, and "unverified" silently conflated *"this is the wrong site"* with *"the test could not run"*. Fix: always write the evidence file, verify in the parse step, and keep the two failure states distinct. **Rule: a filter decides what to KEEP, never what to SAVE. Any gate that runs before persistence turns a bad heuristic into lost data, and heuristics on the first attempt are bad by default. Corollary: a verification whose inputs can be empty must report "could not test" separately from "failed" — collapsing them makes an inapplicable check look like a negative result.**
