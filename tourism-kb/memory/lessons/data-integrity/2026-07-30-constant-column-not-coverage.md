---
name: 2026-07-30-constant-column-not-coverage
description: "A column filled 36/36 with the same value is one fact wearing 36 rows — print the value distribution (nunique), not just the fill count, before promoting a field to a per-row column."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-30
  source: tourism-kb
  refs: []
---

# a column filled 36/36 with the SAME value is not coverage — it is one fact wearing 36 rows

The Phase L terrain layer had been collected on 28/07 and never rendered (`do_cao` 36/36, `do_nho` 36/36, `huong_mo` 26/36, `huong_binh_minh` 36/36) — itself the **fifth** time in this project a layer was gathered and then not read, after the `socials` column, the `csdl` free-text blob, the OSM facility tags and the Overture `confidence` field. Building the section, I was about to publish `huong_binh_minh` as a per-destination column on the strength of its 36/36 fill rate. Printing the values first: **all 36 identical** — `khoảng 114° so với hướng Bắc (tháng 12)` — because sunrise azimuth is a function of latitude and date, not of place, and all 36 sit at effectively one latitude. As a column it discriminates nothing while reading exactly like data. Moved to a single city-level line in §1, where it appears once. **Rule: before adding a field as a per-row column, print its value distribution, not just its fill count. A field whose values are constant across all rows belongs at the level the constant actually applies to. Greppable smell: an enrichment field promoted to a column on the basis of a `count(field)` with no `nunique(value)` beside it.** Same family as the 2026-07-28 Facebook `Luôn mở cửa` entry, one step earlier in the pipeline: there a platform default was indistinguishable from a real answer, here a real answer is indistinguishable from a default because it never varies.

Related: [[2026-07-28-facebook-default-hours-noise]]
