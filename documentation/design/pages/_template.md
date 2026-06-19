---
title: Per-page spec template
date: 2026-05-27
design-language: v1.0
---

# Per-page spec template

Every page spec fills these sections in this order. Uniformity = consistency.
**If a page needs something not in the pattern library, add a pattern (PTN) first —
pages do not invent layout.**

```
### <route>  —  <page name>
- **Audience / goal:** who, single primary user goal.
- **OTA precedent:** which benchmarked competitor page it mirrors (ota-capture.md).
- **Patterns used:** list of PTN-ids.
- **Layout (desktop):** structure, columns, key regions.
- **Layout (mobile ≤md):** collapse behavior (cite design-language §11).
- **States:** loading / empty / error / success / auth-gated (cite PTN-12).
- **CTA hierarchy:** the one primary; secondary/tertiary (cite §9).
- **A11y notes:** landmarks/headings/focus/aria specifics (WCAG 2.2 AA).
- **Open questions:** anything unresolved.
```

Completeness bar (Phase E4): a page is design-complete only when it has all
sections, ≥1 PTN-id, a named OTA precedent, and all four+ states enumerated.
