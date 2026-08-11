---
name: 2026-07-28-osm-facilities-separate-nodes
description: "Absence of a wheelchair/toilets tag ON an OSM attraction is not absence in the AREA — facilities are separate amenity nodes; query the bbox for the feature type itself."
metadata:
  type: reference
  domain: data-integrity
  date: 2026-07-28
  source: tourism-kb
  refs: []
---

# I predicted a data source was empty by checking the wrong element — facilities are mapped as SEPARATE nodes, not as tags on the attraction

Planning the enrichment pass for the 36-place Đà Lạt guide, I checked whether the OSM element for each attraction carried `wheelchair` / `toilets` tags. All zero across 28 matched elements, so I wrote into the plan that Pass 1 would yield "~0–10 fields" and that A.11 facilities was "a phone-and-site-visit field with no data route at all". Ran it anyway to record the negative. It returned **+50 fields — 16 toilets, 16 parking, 6 gift shops, 5 information desks, 4 wheelchair, 3 benches**. The tags were never on the attraction's own way/node; they are on **separate `amenity=toilets` / `amenity=parking` nodes mapped inside the grounds**, which only a bbox query for those amenity values returns. My check answered "does this element describe its own facilities" when the question was "do facilities exist here". **Rule: for any spatial dataset, absence of an attribute ON an entity is not absence of the thing in the AREA — sub-features are routinely mapped as independent neighbouring records. Before declaring a spatial attribute unavailable, query the bounding area for the feature type itself, not just the parent entity's tags.** Greppable smell: concluding a field is empty from a per-row tag census when the field describes a physical thing that could be its own map object. Sibling of the 2026-07-27 csdl entry — same family of error (declaring a field unavailable without querying it properly), and the third time this project has hit it.

Related: [[2026-07-27-field-declared-unavailable-unparsed]]
