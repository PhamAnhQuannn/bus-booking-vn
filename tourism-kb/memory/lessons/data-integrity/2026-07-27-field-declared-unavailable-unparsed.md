---
name: 2026-07-27-field-declared-unavailable-unparsed
description: "Declared price 'unavailable from every source' while holding 289 unparsed rows of it — a source counted DONE on row-count alone has not been read; grep raw payloads for the field label."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-27
  source: tourism-kb
  refs: []
---

# tourism KB — I declared a field "unavailable from every source" while holding 289 rows of it unparsed

Across the Đà Lạt data work I stated repeatedly, in the .docx report and the .md catalogue, that **price is zero from every source**, verified across Overture, Foursquare OS, OSM and Wikidata. That claim was true of those four and **false overall**: the 1,230 lodging records already pulled from `csdl.vietnamtourism.gov.vn` store everything in one flat `text` blob, and **289 of them contain `Giá: 300.000 - 900.000`** — real room prices, from the state register, already sitting on disk. 213 are in Đà Lạt. The same blob also held **1,072 phone numbers, 822 room counts, 423 emails**, and a `Cơ quan nhà nước quản lý` vs `tự đăng ký` marker that is a ready-made verification tier. I had listed the source as "✅ done — 1,230 lodging records" and never looked *inside* a record; the sweep script only ever kept `id`/`name`/`text`. The audit that found it took one grep. **Rule: "source X does not have field Y" is only a valid claim for sources whose fields you have actually enumerated. A source counted as DONE on row-count alone has not been read — a scraper that stores an unparsed blob is a source you have collected, not a source you have examined. Before asserting any field is unavailable, grep the raw payloads for the field's label (`Giá`, `price`, `rating`) rather than reasoning from each provider's documented schema.** Greppable smell: a raw record whose value is one long free-text string, and any coverage table that reports a source by row count without a per-attribute breakdown. Corollary: government registers publish as rendered prose, not as typed columns — the structure is there, just in the sentence rather than the schema.
