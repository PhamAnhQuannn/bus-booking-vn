---
name: 2026-07-30-section-renumber-stale-refs
description: "A section number written as a literal in more than one place is a cross-reference that goes stale on renumber — make section numbers named constants read by both titles and refs."
metadata:
  type: reference
  domain: docs-output
  date: 2026-07-30
  source: tourism-kb
  refs: []
---

# renumbering sections THREE times, and the first two each left references pointing at the wrong place

Cutting five index sections and inserting two new ones shifted the top-level numbering repeatedly. Each pass I hand-updated the cross-references, and each of the first two passes missed some: `mau-chuyen-di.md:32` and `build_huong_dan.py` both said *"tra mục 7"* for the rain-fallback list, which actually lived in **§9** — a reference that was already wrong before I touched it and stayed wrong through a renumber; then the `.docx` was left saying *"mục 2"* in two places where the `.md` already said *"mục 3"*, so the two documents disagreed about where their own content was. Nothing breaks when this happens; the document simply sends the reader to the wrong section. Fixed structurally rather than by another sweep: section numbers are now named constants (`S_DIEMDEN`, `S_HOATDONG`, `S_ANNGU`…) at the top of both builders, and every title *and* every reference reads from them, so a title and a reference can no longer disagree. **Rule: a section number written as a literal in more than one place is a reference that will go stale — the third time you hand-fix the same class of drift, stop fixing instances and remove the ability to drift. Greppable smell: the same small integer appearing in both a heading string and a body string in the same file.**
