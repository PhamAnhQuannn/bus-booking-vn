---
name: 2026-07-30-selection-rule-one-renderer
description: "A selection rule shared by two renderers must live in the shared module — writing it inline in one builder silently emptied the other output; kiem_parity.py is the durable fix."
metadata:
  type: reference
  domain: build-pipeline
  date: 2026-07-30
  source: tourism-kb
  refs: []
---

# I wrote a selection rule inside ONE renderer and silently emptied the other — the exact rule this project has for exactly this

Restructuring the Đà Lạt guide, I moved five provenance fields (`trang_facebook`, `email_facebook`, `luot_checkin`, `nguoi_theo_doi`, `ty_le_gioi_thieu`) out of the destination cards into a research appendix. The removal touched **both** renderers; the appendix that was supposed to receive them I wrote **inline in `build_huong_dan.py`**. So the `.docx` lost the data outright: measured, `.md` 32 Facebook URLs / 21 check-in counts / 4 recommend ratios / 1 ranking table versus `.docx` **0 / 0 / 0 / 0**. Not degraded — gone, with no error and no warning, because nothing in the pipeline compares the two outputs. It surfaced only when I diffed the two files by hand, and the project's own rule ("một nguồn chọn lọc, hai nguồn định dạng") is printed in the docstring of both files I was editing. Fixed by moving selection to `an_ngu_data.tai_nghien_cuu()`; counts are now equal on both sides. **Rule: a rule shared by two renderers lives in the shared module, or one output is wrong and you will not find out. When you delete a field from N renderers, the replacement must be added in the same commit and in the same place the deletion was made — asymmetric edits across renderers are how an output loses data silently. Greppable smell: a selection literal (`[("field", "Label"), …]`, a threshold, a sort key) inside a `build_*` script rather than beside the `tai_*` loaders in the data module.** The durable fix was not the repair but `scripts/tourism/kiem_parity.py`, which reads only the two output files — so it cannot drift along with the renderers it checks — and compares section titles and order, the set of `mục N` cross-references, presence of every named block, the call-list order ID for ID, per-card `A.x` continuity, and the absence of rating fields. **Proven to fire before being trusted**, per the `import-x/no-cycle` lesson: run against the pre-change `.docx` it reports six distinct divergence classes and exits 1. Sibling of the 2026-07-26 VNPay entry — there two readers of one payload each built their own view; here two writers of one document each had their own field list.
