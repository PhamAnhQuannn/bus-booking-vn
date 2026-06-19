> ← [Previous](../11-concurrency/) | [Index](../README.md) | [Next →](../13-booking/)

## 12. Search & Discovery

### 12.1 SQL-Based Search — Why Not Elasticsearch?

**Elasticsearch** is a dedicated search engine built for full-text search, faceted filtering, and high-volume queries across huge datasets.

**Why we don't need it (yet)**:
- ~500 active trips at any time. SQL query with proper indexes: < 10ms.
- Our search is structured (origin, destination, date, price range) not full-text ("find trips mentioning scenic route").
- Adding Elasticsearch means another server to maintain, data sync to manage, and a consistency lag between the database (source of truth) and the search index.

**When we'd add it**: If trip volume exceeds ~50,000 active trips AND SQL queries consistently exceed 200ms despite index tuning.

### 12.2 The Search Query

The core search answers: "Show me trips from A to B on date D with N seats available."

**What gets excluded** (in the SQL `WHERE` clause):
- Cancelled trips
- Sales-closed trips
- Trips on buses currently in maintenance
- Trips from non-approved operators
- Trips where `available seats < requested ticket count`

**Available seats computation**:
```
available = capacity − paidSeats − activeHeldSeats
```
This is computed set-based (one query with subquery/join), not per-row in a loop (which would be N+1).

### 12.3 Place Entity — Canonical Names

**The problem**: An operator creates a route "Ha Noi → HCM". Another creates "Hanoi → Ho Chi Minh City". A customer searches "Hà Nội → Hồ Chí Minh". Three different strings for the same cities — search finds nothing.

**The solution**: A `Place` table with canonical names and aliases:
```
Place { id: "hanoi", canonicalName: "Hà Nội", aliases: ["Ha Noi", "Hanoi", "HN"] }
Place { id: "hcm", canonicalName: "TP. Hồ Chí Minh", aliases: ["HCM", "Ho Chi Minh", "Saigon"] }
```

Routes reference `originPlaceId` and `destPlaceId` (not free text). Typeahead searches Place names and aliases. No fragmentation.

### 12.4 Facets

**What they are**: Summary counts shown alongside search results. "Showing 15 trips. Filter by: Hoàng Long (8) · Phương Trang (7) | Sleeper (10) · Seated (5)".

Facets are computed from the **unfiltered** base result set (all trips matching origin/destination/date), not from the already-filtered set. This way, selecting a filter shows how many results other filters would yield.

**Supported filter dimensions**:

| Dimension | Type | How it works |
|-----------|------|-------------|
| Operator name | Facet (with count) | Checkbox list — shows count per operator |
| Time-of-day departure | Bucketed facet | Morning / Afternoon / Evening / Night windows |
| Bus type | Facet (with count) | Seated / Sleeper / Limousine |
| Price range | Range filter (min/max) | Slider or numeric inputs |
| Maximum duration | Range filter | Filter trips longer than N hours |
| Seats available | Threshold filter | "At least N seats" (defaults to ticket count) |

All dimensions map 1:1 to existing data model fields — no new schema columns required.

### 12.5 Home Page — Popular Routes Lookup

The home page shows popular route cards with starting prices. This requires a **separate query** from the main search: `MIN(price)` aggregation over upcoming non-cancelled trips per origin/destination route pair. This is a derived value, not a stored column on the Route model.

Open question: whether to compute dynamically on each home page load (simple, always fresh, but adds ~50ms) or maintain a materialized cache (faster, but requires invalidation when trip prices change).
