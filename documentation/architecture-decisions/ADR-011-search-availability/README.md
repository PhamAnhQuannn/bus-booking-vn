# ADR-011: Search & Availability

## Status
ACCEPTED

## Date
2026-06-17 (reviewed and confirmed)

## Context

Bus-Booking's search and availability system is the entry point for the primary customer journey (Search → Hold → Book → Pay → Ticket). It must serve diverse Vietnamese traveler personas across mobile-first, low-bandwidth, and multilingual contexts while maintaining real-time accuracy of seat counts in a high-concurrency marketplace. The architecture must support SEO-driven acquisition on long-tail route keywords while protecting against overselling during Tet surge periods.

Key business constraints driving search and availability decisions (sourced from `documentation/business/`):

- **Tet surge 10-20x normal volume**: Demand spikes 260% at major stations; tickets sell out 1-3 months in advance. System must be stable at 2,000+ concurrent booking attempts. Tet failure causes "permanent customer defection." Rated HIGH likelihood, HIGH impact. (risk-matrix.md)
- **SEO on route-specific long-tail keywords is the #2 customer acquisition channel**: Keywords like "ve xe Sapa Ha Noi" and "ve xe Da Lat TPHCM" are undercontested. Long-tail provincial routes offer low-CAC organic acquisition with 12-24 month payoff. (market-research/business-model.md)
- **Promoted/featured listings planned as revenue stream (Month 3-6)**: Operator-paid top placement in search results is a HIGH-feasibility additional revenue stream at 1-5M VND/month per operator. Search ranking must accommodate this. (market-research/business-model.md)
- **Multi-dimensional search visibility gates**: Search filters trips by `status='scheduled'`, `salesClosed=false`, `moderatedAt IS NULL`, operator `status='APPROVED'`, `departureAt > NOW()`, and maintenance window overlap exclusion using window-vs-window logic. (domain-model/event-flows.md, domain-model/invariants-catalog.md)
- **Capacity is computed, never stored**: `available = capacity - blockedSeats - active_holds - paid_bookings - awaiting_payment_bookings(within PSP_WINDOW_MINUTES)`. Three queries, no N+1. Hold TTL is 10 minutes; PSP_WINDOW_MINUTES is 20. (domain-model/event-flows.md, domain-model/invariants-catalog.md)
- **Place registry with alias merging and diacritics normalization**: Places are a global canonical registry with alias arrays and `unaccent_immutable ILIKE` search. Unique slug per Place for SEO-friendly URLs. Not operator-scoped. (domain-model/ubiquitous-language.md)
- **RecurringTripTemplate generates supply on a 14-day rolling horizon**: Daily cron job creates Trip rows from templates with `departureLocalTime` (HH:MM in Asia/Ho_Chi_Minh), `daysOfMask` (weekday bitmask), deduplication via partial unique index. (domain-model/ubiquitous-language.md, domain-model/event-flows.md)
- **Extreme price sensitivity and comparison shopping**: Vietnamese users comparison-shop in parallel tabs; "gia re" (cheap price) appears in virtually every booking search. Commission must be invisible to the customer. Bait-and-switch fear (listed price ≠ actual price) is a real concern. (market-research/user-insights.md, personas/customer-personas.md)
- **Diverse persona needs span mobile-first budget travelers to English-needing tourists**: "Chị Lan" (budget, MoMo, mobile-first, price-compare 3+ options), "Marco" (English, international card, unfamiliar routes), "Bà Hoa" (elderly, large-font, simple UI), "Em Quân" (student, data-light, MoMo family top-up). (personas/customer-personas.md)

---

## Decisions

### 1. Search Rendering Strategy — SSR via React Server Components

How search results pages are rendered and delivered to the customer.

| Option | Pros | Cons |
|--------|------|------|
| **SSR via React Server Components (RSC)** | Fresh data on every request (real-time availability); SEO-indexable HTML for route keywords; no client-side loading spinner for initial results; works on low-end Android/4G without heavy JS bundle | Server renders on every request (compute cost at Tet 10-20x scale); no static cache layer; server must handle every search query in real time |
| Client-side SPA | Minimal server load; rich interactive filtering (client-side sorts/filters); fast subsequent interactions after initial load | Not SEO-indexable without additional SSR/prerender layer; first meaningful paint requires JS bundle download + API call; bad for low-end Android/4G users; search engines see empty page |
| Static generation (SSG) | Fastest TTFB; zero server compute per request; CDN-cacheable globally; best Core Web Vitals scores | Stale availability data (seat counts outdated the moment page is generated); cannot show real-time capacity; rebuild frequency creates staleness window; route/date combinations grow combinatorially |
| Incremental Static Regeneration (ISR) | Fast TTFB from cache; periodic revalidation refreshes data; CDN-cacheable between revalidations; good Core Web Vitals | Availability can be stale for the revalidation interval (30s-5min); cache stampede at Tet when all route/date pages expire simultaneously; ISR path explosion for route × date × ticketCount combinations |

**Choice**: SSR via React Server Components (RSC)

**Reasons**:
- Real-time seat availability is a core trust signal — "Chị Lan" and "Trang" comparison-shop across 3+ platforms in parallel tabs; showing stale availability that leads to a failed hold destroys trust faster than a slightly slower page load (personas/customer-personas.md, market-research/user-insights.md)
- SEO on route-specific long-tail keywords is the #2 customer acquisition channel with the lowest CAC outside operator's own channels. SSR produces indexable HTML without a prerender layer. Keywords like "ve xe Da Lat TPHCM" must render full results in the initial server response for Google indexing (market-research/business-model.md)
- Place slugs provide SEO-friendly URLs (e.g., `/search/ho-chi-minh/da-lat/2026-02-01`), which require server-side resolution from the canonical Place registry — SSR handles this naturally without a client-side hydration step (domain-model/ubiquitous-language.md)
- "Bà Hoa" (elderly, low-tech) and "Em Quân" (student, data-plan-conscious prepaid mobile) need fast first paint without downloading a heavy JS bundle. RSC streams HTML progressively, no blank-screen-while-loading (personas/customer-personas.md)
- Tet surge compute cost is mitigated at the infrastructure level (Vercel cold-start scaling, PgBouncer pooling via issue 099, virtual waiting room if threshold exceeded) rather than at the rendering strategy level — these mitigations are already identified in the risk matrix (risk-matrix.md)
- ISR rejected despite good performance characteristics because the availability staleness window (even 30 seconds) during Tet peak could show sold-out trips as available or available trips as sold-out, both of which directly contradict the "immediate booking confirmation" trust signal (market-research/user-insights.md)

---

### 2. Place/Location Resolution — Canonical Place Registry with Unaccent

How origin and destination inputs are resolved to canonical locations for search queries.

| Option | Pros | Cons |
|--------|------|------|
| **Canonical Place registry + unaccent** | Diacritics-safe for Vietnamese text; alias merging handles common misspellings and abbreviations ("SG" → "Sài Gòn" → "Ho Chi Minh City"); unique slug per Place for SEO URLs; shared globally across operators (no fragmentation); supports both Vietnamese and English place names via aliases | Requires manual curation of Place registry and aliases; does not handle truly unknown locations; no geocoding for "near me" searches |
| Free-text string matching | Simplest implementation; no registry maintenance; handles any operator-defined origin/destination | No normalization (diacritics break matching); "Đà Lạt" ≠ "Da Lat" ≠ "Dalat"; no SEO slugs; fragmented search results across operator spelling variants; tourist persona "Marco" cannot search in English |
| Geocoding API (Google Places) | Handles any input including addresses; supports "near me" searches; multilingual input resolution; reverse geocoding for map-based search | External API dependency on critical search path; Google Places API cost per query ($2.83-17/1K requests); latency penalty (100-300ms per geocode); bus routes are not address-based but station/city-based; overengineered for Vietnamese bus market where locations are cities, not addresses |
| Structured hierarchy (province > district > station) | Mirrors Vietnam administrative divisions; granular location targeting; familiar mental model for Vietnamese users | Overly rigid for bus routes which span provinces; districts are too granular (users think in city names, not districts); requires maintaining 63 provinces × 700+ districts; tourist "Marco" has no idea which district he wants |

**Choice**: Canonical Place registry with `unaccent_immutable ILIKE` and alias merging

**Reasons**:
- Vietnamese text has 12 tone/accent marks that produce distinct Unicode codepoints for visually similar characters; `unaccent_immutable ILIKE` normalizes "Đà Lạt" = "Da Lat" = "Dalat" at the database level, essential for both Vietnamese and tourist search input (domain-model/ubiquitous-language.md)
- Place alias arrays merge common abbreviations and alternate names ("TPHCM" / "Sài Gòn" / "Ho Chi Minh" / "Ho Chi Minh City" / "Saigon" all resolve to the same Place), directly serving tourist persona "Marco" who searches in English and domestic persona "Chị Lan" who uses informal abbreviations (personas/customer-personas.md, domain-model/ubiquitous-language.md)
- Unique Place slugs produce SEO-friendly search URLs (`/search/da-lat/ho-chi-minh/2026-02-01`) that match the long-tail keyword acquisition strategy — route-specific URLs rank for "ve xe Da Lat TPHCM" class queries (market-research/business-model.md)
- Places are shared globally (not operator-scoped), preventing fragmentation where Operator A writes "Dalat" and Operator B writes "Đà Lạt" and searches for either return only half the results (domain-model/ubiquitous-language.md, domain-model/bounded-contexts.md)
- Routes carry optional Place FKs for canonical matching alongside free-text origin/destination strings, allowing backward compatibility with operator-entered text while progressively linking to the canonical registry (domain-model/ubiquitous-language.md)
- Google Places API rejected: $2.83-17 per 1,000 requests on the most latency-sensitive path in the application, with bus routes being city-to-city (not address-based), making geocoding precision unnecessary and cost unjustifiable given the target 4-6% net margin per booking (market-research/business-model.md)
- Structured hierarchy rejected: Vietnamese bus travelers think in city/province names ("Đà Lạt", "Thanh Hoá"), not administrative divisions. Requiring district-level selection adds friction for every persona, especially "Bà Hoa" (elderly) and "Marco" (tourist) (personas/customer-personas.md)

---

### 3. Availability Computation — Real-Time Computed at Query Time

How seat availability is calculated and presented to customers during search.

| Option | Pros | Cons |
|--------|------|------|
| **Real-time computed at query time** | Always accurate — no staleness; directly enforces capacity invariant; consistency between search display and hold-creation guard; no cache invalidation complexity | Database load on every search query (3 subqueries per trip for holds, paid bookings, awaiting-payment bookings); Tet 10-20x surge multiplies query load proportionally; no read optimization layer |
| Cached/materialized count with TTL | Reduced database load; faster response times; CDN-cacheable availability counts | Stale within the TTL window; hold creation (10-min TTL) changes availability faster than most cache intervals; cache invalidation on every hold/booking/expiry is complex; stale count shown then hold fails = trust-breaking experience |
| Seat-level tracking (individual seats) | Enables seat selection UI; most granular capacity model; prerequisite for seat map feature | Requires complete data model rewrite — seat selection is explicitly "DEFER (REMODEL)" in risk-matrix.md; dramatically increases write contention (lock per seat vs lock per trip); N seats × M concurrent requests = order-of-magnitude more lock contention; count-based model matches current operator reality |
| Estimated count with periodic sync | Minimal database impact; fast search responses; works for low-precision use cases | "Bait and switch" is the #1 fear for Vietnamese bus travelers — showing "5 seats available" that turns into "sold out" at hold time destroys trust; misaligned with platform positioning on transparent, reliable booking (market-research/user-insights.md) |

**Choice**: Real-time computed at query time

**Reasons**:
- Capacity Guard is a multi-layer defense system: search-time computation is Layer 0 (display), Hold creation is Layer 1 (enforcement via advisory locks), Booking-paid webhook is Layer 2 (oversold race detection). Consistency between Layer 0 display and Layer 1 enforcement prevents the trust-breaking experience where search says "available" but hold says "sold out" (domain-model/invariants-catalog.md)
- The computation formula is defined precisely: `capacity - blockedSeats - active_holds(expiresAt > NOW()) - paid_bookings - awaiting_payment_bookings(createdAt > NOW() - PSP_WINDOW_MINUTES)` — this includes the 20-minute PSP window grace period and matches the exact guard used by hold creation (domain-model/event-flows.md, domain-model/invariants-catalog.md)
- Vietnamese users comparison-shop in parallel tabs with a "bait and switch" fear that is the most widely reported complaint. If search shows stale availability and the hold fails, the platform confirms the bait-and-switch narrative that competitors are criticized for (market-research/user-insights.md)
- Tet surge database load is mitigated via existing infrastructure plans: PgBouncer connection pooling (issue 099), Vercel cold-start scaling, and virtual waiting room if threshold exceeded — these are already identified as prerequisites in the risk matrix (risk-matrix.md)
- Seat-level tracking rejected: explicitly deferred as "DEFER (REMODEL)" with the rationale "count-based model matches operator reality" — Vietnamese operators, especially micro operators (60-70% by count), do not track individual seats and use walk-up assignment (risk-matrix.md, personas/operator-personas.md)
- Cached counts rejected: Hold TTL is 10 minutes and holds change availability instantly. A cache with even a 30-second TTL could show seats that are already held. During Tet peak when trips sell out in minutes, a 30-second stale window is the difference between a successful booking and a frustrated customer defecting permanently (risk-matrix.md, domain-model/ubiquitous-language.md)

---

### 4. Search Visibility Gates — Multi-Dimensional Composite

What filters and conditions determine whether a trip appears in search results.

| Option | Pros | Cons |
|--------|------|------|
| Simple status-only filter | Easy to implement; single WHERE clause; minimal query complexity | Misses crucial conditions: moderated trips still visible, non-approved operator trips searchable, maintenance-conflicted buses still shown; no salesClosed gate |
| **Multi-dimensional composite gates** | Enforces all business rules at search time; prevents booking attempts on ineligible trips; consistent with hold-creation guards; moderation, operator approval, maintenance, and sales closure all gated before customer sees trip | Complex WHERE clause; multiple JOINs (Trip → Route → Operator, Trip → Bus → BusMaintenance); query plan must be optimized carefully for Tet scale; new gates require search query modification |
| Operator-controlled visibility only | Operators manage what customers see; simplest from platform perspective; maximum operator autonomy | Non-approved operators could show trips; moderated (admin-hidden) trips visible; maintenance-conflicted trips shown; no platform-level safety net; inconsistent with marketplace trust positioning |
| Time-based auto-expiry | Automatically hides past departures; clean search results; no manual intervention needed for expired trips | Only handles one dimension (time); ignores moderation, operator approval, maintenance, and sales closure; insufficient alone as a visibility strategy |

**Choice**: Multi-dimensional composite gates

**Reasons**:
- Search must enforce six simultaneous conditions: `Trip.status = 'scheduled'`, `Trip.salesClosed = false`, `Trip.moderatedAt IS NULL`, `Operator.status = 'APPROVED'`, `Trip.departureAt > NOW()`, and maintenance window overlap exclusion. These are documented as the explicit search filter set in the primary event flow (domain-model/event-flows.md)
- The maintenance window overlap uses window-vs-window logic (`maintenanceStart IS NULL OR maintenanceEnd < startUtc OR maintenanceStart > endUtc`), not point-in-time comparison. This was a documented correction after a bug where future maintenance on a bus with future trips was incorrectly included when maintenance wasn't active "right now" (domain-model/invariants-catalog.md)
- Only `APPROVED` operators are search-visible. This is critical because an admin could suspend an operator between a customer's search and their hold attempt — the Hold creation re-verifies operator approval to close this race, but search should not display trips from non-approved operators in the first place (domain-model/state-machines.md, domain-model/invariants-catalog.md)
- `salesClosed` is orthogonal to Trip status — a `scheduled` trip can have `salesClosed = true` when an operator manually closes early or when `markDeparted` fires. Without this gate, customers would see trips they cannot book, wasting their time and eroding trust (domain-model/ubiquitous-language.md, domain-model/state-machines.md)
- Admin moderation (`moderatedAt IS NULL`) provides a safety net against problematic listings without requiring full trip cancellation — admin can soft-hide a trip from search while investigating, preserving existing bookings. This aligns with the admin/moderation context where "admins DISABLE, never EDIT catalog fields" (domain-model/bounded-contexts.md)
- Simple status-only rejected: would expose trips from suspended operators, trips with active maintenance windows, trips the admin has moderated, and trips the operator has manually closed — each a distinct trust violation

---

### 5. Trip Supply Strategy — RecurringTripTemplate with Rolling Horizon Cron

How trips are created, maintained, and made available as searchable inventory.

| Option | Pros | Cons |
|--------|------|------|
| **RecurringTripTemplate with rolling horizon cron** | Automates supply for predictable schedules (daily/weekly departures); 14-day horizon ensures customers can book up to 2 weeks ahead; deduplication via partial unique index prevents double-generation; operators still have manual creation for one-offs; covers beachhead persona "Chị Lan" who books 1-3 days ahead | Cron dependency (if cron fails, no new trips generated); 14-day horizon may be insufficient for Tet advance booking (1-3 months ahead); template management adds operator console complexity |
| Manual operator-only creation | Simplest model; maximum operator flexibility; no cron dependency; operators create exactly what they want | Does not scale for operators with daily departures (mid-size operator with 10 buses × 2 departures/day = 20 manual trip creates daily); error-prone repetitive work; micro operator persona "Bác Tám" (very low tech literacy, paper ledger) needs automation, not manual entry (personas/operator-personas.md) |
| Calendar-based bulk generation | Generate all trips for a month/quarter at once; single operation creates many trips; reduces daily cron dependency | Large upfront data creation; changes to schedule require bulk updates or deletions; rigid — cannot easily adjust for holidays, special events, or maintenance without regenerating |
| On-demand creation at search time | Zero upfront trip creation; infinite schedule flexibility; no cron or bulk generation needed | Violates Trip as a concrete domain entity with a fixed price, bus assignment, and capacity; no way to apply maintenance windows or bus overlap guards without a pre-existing Trip row; cannot track bookings against a trip that doesn't exist; fundamentally incompatible with Hold-then-Pay architecture |

**Choice**: RecurringTripTemplate with rolling horizon cron, supplemented by manual operator creation

**Reasons**:
- RecurringTripTemplate carries `departureLocalTime` (HH:MM in Asia/Ho_Chi_Minh timezone) and `daysOfMask` (weekday bitmask), generating Trip rows for a 14-day rolling horizon via daily `generateFromTemplate` cron. Deduplication via partial unique index in `RecurringGenerationLog` prevents double-generation on cron restart or retry (domain-model/ubiquitous-language.md, domain-model/event-flows.md)
- The template uses the same core trip creation logic as manual creation (`createTrip`), ensuring bus overlap guards, maintenance window checks, and operator scope validation apply uniformly to both auto-generated and manually created trips (domain-model/event-flows.md)
- Mid-size regional operators ("Công Ty Xe Khách Tỉnh") with 6-30 buses running fixed inter-provincial schedules would require 12-60 manual trip creates daily without automation. Template-based generation eliminates this repetitive burden (personas/operator-personas.md)
- Manual creation remains available for one-off trips, special Tet extras, or charter departures — the template supplements rather than replaces operator control (domain-model/bounded-contexts.md)
- Tet advance booking (1-3 months ahead per user insights) exceeds the 14-day default horizon. This is addressed by operators manually creating Tet trips in advance or by adjusting the horizon parameter for the Tet season — the template system's deduplication ensures no conflicts between auto-generated and manually created trips (market-research/user-insights.md, risk-matrix.md)
- On-demand creation rejected: Trip is a concrete entity with a fixed VND price, assigned Bus, and capacity constraints. Advisory lock-based capacity guard requires a pre-existing Trip row to lock against. A trip materialized at search time cannot enforce bus overlap or maintenance window invariants (domain-model/invariants-catalog.md, domain-model/ubiquitous-language.md)

---

### 6. Maintenance Window Handling — Window-vs-Window Overlap Exclusion

How bus maintenance schedules affect search results and trip visibility.

| Option | Pros | Cons |
|--------|------|------|
| **Window-vs-window overlap exclusion** | Correctly handles future maintenance on buses with future trips; prevents showing trips that will conflict with scheduled maintenance; uses set-theoretic overlap logic (not point-in-time); documented correction of a known bug | Requires computing trip time windows (`[departureAt, departureAt + durationMinutes]`) and comparing against maintenance windows; SQL logic more complex than simple flag check; performance impact from JOIN to BusMaintenance |
| Trip-level flag (operator marks trips manually) | Simplest model; operator has full control; no complex window logic | Error-prone — operator forgets to flag a trip; maintenance scheduled after trip created would not retroactively flag; no automated protection; micro operator "Bác Tám" (paper ledger, very low tech literacy) is especially likely to forget manual flagging (personas/operator-personas.md) |
| Bus deactivation (all-or-nothing) | Simplest enforcement; deactivated bus = no trips shown; clear state | Too blunt — a bus with maintenance next Tuesday should still show for trips today and Monday; hides all trips for the bus even those unaffected by the maintenance window; reduces operator revenue unnecessarily |
| Ignore maintenance in search (filter at booking) | Simplest search query; maintenance only checked at hold/booking time; no search performance impact | Customers see trips they cannot book; "bait and switch" experience when hold fails due to maintenance; wastes customer comparison-shopping time; directly contradicts the trust positioning that search results are bookable (market-research/user-insights.md) |

**Choice**: Window-vs-window overlap exclusion at search time

**Reasons**:
- The window-vs-window overlap formula (`maintenanceStart IS NULL OR maintenanceEnd < startUtc OR maintenanceStart > endUtc`) was a documented bug fix: the original point-in-time comparison (`new Date()` vs maintenance window) incorrectly included future trips on a bus with a future maintenance window whenever maintenance wasn't active "right now." The corrected logic compares the trip's time window against the maintenance window (domain-model/invariants-catalog.md)
- Trip time window is `[departureAt, departureAt + route.durationMinutes]`; maintenance window is `[maintenanceStart, maintenanceEnd]`. The overlap exclusion uses the complement: a trip is shown if maintenance doesn't exist, or maintenance ends before the trip starts, or maintenance begins after the trip ends. This is the same logic used in trip creation guards for bus overlap, making it consistent across the system (domain-model/invariants-catalog.md, domain-model/event-flows.md)
- BusMaintenance records include `startAt`, `endAt`, and optional `reason`. This structured data enables automated search-time filtering without operator intervention, which is essential for micro operators (60-70% of market) with very low tech literacy who manage with phone/Facebook/paper ledger (domain-model/ubiquitous-language.md, personas/operator-personas.md)
- Filtering at booking time rather than search time would show customers trips that will fail at hold creation — the exact "bait and switch" pattern that is "a real fear" among Vietnamese bus travelers and the "most widely reported complaint." Search results must represent bookable trips (market-research/user-insights.md)
- Bus deactivation rejected: a bus with a 2-day maintenance window scheduled next week should still appear in search results for trips departing before the maintenance starts. All-or-nothing deactivation unnecessarily removes bookable inventory and reduces operator revenue (domain-model/ubiquitous-language.md)

---

### 7. Search Result Ranking & Display — Departure Time Primary Sort

How search results are sorted and what information is displayed per result.

| Option | Pros | Cons |
|--------|------|------|
| **Departure time primary sort (default)** | Intuitive for most use cases — travelers search by date and want the next departure; simplest to understand for all personas including "Bà Hoa" (elderly); deterministic and predictable; no algorithmic opacity; no "bait and switch" perception from opaque ranking | Does not surface best-value options; premium limousine operators buried if their departures are mid-day; no mechanism for promoted listings without adding a secondary sort layer |
| Price ascending sort | Directly serves the price-sensitivity signal ("giá rẻ" in virtually every search); "Chị Lan" (5/5 price sensitivity) and "Em Quân" (5/5 price sensitivity) immediately see cheapest options | Commoditizes operators — "Shopify for bus operators" positioning claims operator brand ownership, but price-first sort reduces all operators to a price comparison; limousine/VIP operators penalized by default; operator churn trigger #6 (brand dilution) activated |
| Operator-rating weighted | Trust signal for customers; rewards operators who provide good service; aligns with long-term quality incentives | Ratings system is explicitly "DEFER (50+ ops)" in the risk matrix — no rating data exists at launch; chicken-and-egg problem (no bookings = no ratings = no ranking signal); cold start unfairness to new operators |
| Algorithm-based (relevance score combining multiple factors) | Can balance departure time, price, operator quality, and promoted status; enables promoted listing monetization; optimizes for conversion rate | Algorithmic opacity triggers "bait and switch" fear — Vietnamese travelers distrust rankings they don't understand; complex to build and tune; requires conversion data that doesn't exist at launch; opaque algorithms are the exact pattern VeXeRe is criticized for |

**Choice**: Departure time as primary sort (default), with client-side re-sort by price available

**Reasons**:
- Vietnamese users comparison-shop in parallel tabs with extreme price sensitivity (5/5 for "Chị Lan" and "Em Quân"), but they search by date — the mental model is "I need to travel on Friday" not "show me the cheapest trip sometime." Departure time sort matches this journey. Price re-sort is available as a client-side option for price-first shoppers (personas/customer-personas.md, market-research/user-insights.md)
- "Bait and switch" fear is the most salient trust concern for Vietnamese bus travelers. Algorithmic ranking that surfaces promoted listings without transparent labeling would confirm this fear. Departure time sort is deterministic and predictable — every user understands why Trip A appears before Trip B (market-research/user-insights.md)
- The "Shopify for bus operators" positioning promises operator brand ownership. Price-ascending default sort commoditizes operators, directly triggering churn trigger #6 (brand dilution) and #5 (subsidized competition perception when platform-promoted operators appear cheaper). Departure time sort is brand-neutral (market-research/competitive-advantages.md, competitor-benchmark/operator-sentiment.md)
- Promoted/featured listings (Month 3-6 revenue stream, HIGH feasibility, 1-5M VND/month per operator) can be layered onto departure-time sort as a clearly-labeled "Featured" badge or top-of-results slot without replacing the base sort logic. This preserves sort transparency while enabling monetization (market-research/business-model.md)
- Search results display per trip: departure time, arrival time (derived from `departureAt + durationMinutes`), operator name, bus type (`coach | sleeper | limousine`), price in VND, available seats count, and pickup areas. This matches the table-stakes feature set from the competitive matrix (origin/destination, departure time, price, operator name, vehicle type) while adding available seats as a real-time trust signal (competitor-benchmark/feature-parity-matrix.md, domain-model/ubiquitous-language.md)
- Rating-weighted sort rejected: ratings are explicitly deferred until 50+ operators and "enough volume" exists. No launch-day rating data means the algorithm would have no signal to weight, falling back to an arbitrary substitute that is worse than a simple, understandable sort (risk-matrix.md)
- I7 invariant compliance: price displayed is `Trip.price` (set by operator, the price authority for their trips). Search never accepts client-originated price parameters and never displays computed/dynamic prices. What you see is what you pay (domain-model/invariants-catalog.md)

---

## Consequences

### Positive
- SSR via RSC delivers SEO-indexable search result pages for the #2 customer acquisition channel (route-specific long-tail keywords) with zero additional prerendering infrastructure
- Real-time availability computation ensures search results are consistent with hold-creation guards, eliminating the "bait and switch" trust failure between search display and hold attempt
- Canonical Place registry with `unaccent_immutable ILIKE` provides diacritics-safe search for Vietnamese text and alias-based English resolution for tourists, served from a single shared registry
- Multi-dimensional composite gates enforce all six visibility conditions at search time, preventing customers from seeing trips they cannot book (moderated, suspended operator, maintenance-conflicted, sales-closed, departed, non-scheduled)
- RecurringTripTemplate automates supply generation for operators with predictable schedules, reducing daily manual effort from 12-60 trip creates to zero for mid-size operators
- Window-vs-window maintenance exclusion correctly handles future maintenance on future trips, preventing the documented bug where point-in-time comparison produced incorrect results
- Departure time sort with transparent, deterministic ordering directly counters the "bait and switch" fear while preserving operator brand equity per the "Shopify for bus operators" positioning

### Negative
- SSR on every search request places compute cost proportional to search volume — Tet 10-20x surge means 10-20x server render load with no static cache absorption layer
- Real-time availability requires 3 subqueries per trip (active holds, paid bookings, PSP-window bookings) on every search — database load scales linearly with search traffic and result count
- Place registry requires ongoing manual curation of aliases and new locations — no automated geocoding discovery of places users search for but that don't exist in the registry
- Multi-dimensional composite gates produce a complex WHERE clause with JOINs to Operator and BusMaintenance tables — query plan must be carefully indexed and monitored for performance degradation at scale
- 14-day rolling horizon for RecurringTripTemplate is insufficient for Tet advance booking (1-3 months ahead) — requires operator manual intervention or seasonal horizon adjustment
- Departure time sort does not optimize for conversion rate or revenue per search — promoted listings must be layered on later as a separate mechanism

### Mitigations
- Tet SSR compute surge: PgBouncer connection pooling (issue 099), Vercel cold-start auto-scaling, and virtual waiting room if concurrent search threshold exceeded. Search query optimization with composite indexes on `(status, salesClosed, departureAt)` plus operator status JOIN (risk-matrix.md)
- Database query load from real-time availability: the 3 subqueries are aggregates (COUNT with WHERE conditions), not row-level fetches. PostgreSQL partial indexes on `Hold.status = 'active'` and `Booking.status IN ('paid', 'awaiting_payment')` make these counts index-only scans. No N+1 (domain-model/event-flows.md)
- Place registry curation: FunnelEvent tracking (`search_performed` with context payload) can log unmatched search terms for admin review, revealing places users search for that need to be added to the registry. Progressive alias expansion over time (domain-model/bounded-contexts.md)
- Tet advance booking horizon: operators can manually create trips beyond the 14-day horizon for known Tet peak dates. RecurringTripTemplate deduplication ensures no conflicts between auto-generated and manually created trips for the same slot. Document Tet preparation playbook for operator onboarding (domain-model/ubiquitous-language.md)
- Promoted listings layering: departure time remains the base sort; promoted operators receive a "Featured" badge and optionally a pinned top-of-results slot, clearly labeled per Vietnamese advertising disclosure requirements. Implementation deferred to Month 3-6 per business model timeline (market-research/business-model.md)

---

## References

All decisions sourced exclusively from `documentation/business/`:

| Document | Cited In |
|----------|----------|
| domain-model/event-flows.md | D1, D3, D4, D5, D6, Mitigations |
| domain-model/ubiquitous-language.md | D1, D2, D3, D5, D6, D7, Mitigations |
| domain-model/invariants-catalog.md | D3, D4, D6, D7 |
| domain-model/state-machines.md | D4 |
| domain-model/bounded-contexts.md | D2, D4, D5, Mitigations |
| market-research/business-model.md | D1, D2, D3, D7, Mitigations |
| market-research/user-insights.md | D1, D3, D4, D6, D7 |
| market-research/competitive-advantages.md | D7 |
| personas/customer-personas.md | D1, D2, D3, D7 |
| personas/operator-personas.md | D3, D5, D6 |
| competitor-benchmark/feature-parity-matrix.md | D7 |
| competitor-benchmark/operator-sentiment.md | D7 |
| risk-matrix.md | D1, D3, D5, D7, Mitigations |
| vietnam-market-context.md | D5 |
| stakeholder-map.md | D3 |
