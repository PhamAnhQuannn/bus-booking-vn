# Tour KB — Data Sources & Measured Coverage

**Status:** Strategy decided, coverage measured. No product code, no schema.
**Date:** 2026-07-26
**Companion to:** [README.md](README.md) (customer discovery). This resolves that document's Open Item 2 — *where does the destination data come from, and who re-verifies it?*

---

## Context

For a destination like Đà Lạt the knowledge base must answer, in depth and not just for headline places: *where in Đà Lạt, what to eat, where to go, how to get there and get around, where to sleep, what is worth doing in daylight, how much.*

Three questions were put to a five-seat debate (licensing, pro-acquisition engineering, Vietnam legal, affiliate/partnership, operations): explain OSM and ODbL; can we run a daily Playwright scrape against Foody / Facebook / Traveloka / Google Maps using a self-registered account; can affiliate programmes supply the data. This document records the answers, the decisions, and — critically — the **measured** coverage that tests them.

---

## The framing that decides everything

The data splits into three layers with completely different acquisition stories.

| Layer | What it is | Bulk-acquirable? |
|---|---|---|
| **Spine** | entity list: name, category, coordinates, address, phone, website | **Yes — free and permissively licensed.** Solved. |
| **Operational** | opening hours, last entry, seasonality, price, still-open-or-not | **Barely.** Sparse in open data, rich only in ToS-locked commercial data. |
| **Differentiator** | stairs, walking distance from the drop point, somewhere to sit, squat-vs-seated toilet, real đèo travel time, whether a 45-seat coach can park | **No. It exists in no dataset.** |

That third row is the entire beachhead. No scraping strategy produces it. **The part that can be scraped is already free and legal to download; the part worth having cannot be scraped from anyone.**

---

## Measured coverage — Đà Lạt

Run 2026-07-26 against the Overpass API. Bounding box `11.85, 108.36, 12.05, 108.55` (old Đà Lạt city plus margin). OSM base timestamp `2026-07-27T00:53:02Z`. Reproducible: `POST https://overpass-api.de/api/interpreter` with `[out:json];(nwr[<selector>](<bbox>););out count;`.

### Entity counts — the spine

| Category | Selector | Count |
|---|---|---:|
| Eat | `amenity=restaurant\|cafe\|fast_food\|bar\|pub\|food_court\|ice_cream` | **804** |
| Sleep | `tourism=hotel\|guest_house\|hostel\|motel\|apartment\|chalet` | **471** |
| See — built | `tourism=attraction\|viewpoint\|museum\|artwork\|theme_park\|zoo\|gallery` | **113** |
| See — parks | `leisure=park\|garden\|nature_reserve` | **54** |
| See — natural | `natural=waterfall\|peak\|spring\|cave_entrance` | **12** |
| See — historic | `historic=*` | **13** |
| Public toilets | `amenity=toilets` | **33** |
| | **Spine total** | **~1,467** |

### Tag density — the operational layer

| Set | Attribute | Have it | % |
|---|---|---:|---:|
| Eat (804) | `opening_hours` | 107 | **13.3%** |
| Eat | `phone` / `contact:phone` | 111 | 13.8% |
| Eat | `cuisine` | 211 | 26.2% |
| Eat | `wheelchair` | 8 | **1.0%** |
| Sleep (471) | `opening_hours` | 38 | 8.1% |
| Sleep | `phone` / `contact:phone` | 108 | 22.9% |
| Sleep | `stars` | 21 | 4.5% |
| Sleep | `wheelchair` | 1 | **0.2%** |
| See (113) | `opening_hours` | 11 | 9.7% |
| See | `fee` / `charge` | 2 | **1.8%** |
| See | `wheelchair` | 0 | **0.0%** |

### What these numbers mean

**1. The spine is a solved problem, and then some.** ~1,467 free, permissively-obtainable entities for one city — roughly 20× the 50–80 the itinerary maths says a 5-day family trip actually consumes. Depth is not the constraint. It never was.

**2. The operational layer is essentially absent.** Around 90% of Đà Lạt restaurants have no opening hours in OSM. 98% of attractions have no entry fee recorded. *"What time does it open"* and *"how much"* — two of the seven questions this product exists to answer — are **field work, not download work**, and the measurement says so unambiguously.

**3. This falsifies a claim made in the strategy that preceded it.** The argument for accepting ODbL discipline was partly that OSM carries accessibility hint tags that Overture structurally lacks. **The data does not support that.** Across the entire city: 8 restaurants, 1 hotel, and **zero attractions** carry any `wheelchair` tag. That is not a hint layer, it is noise. The accessibility rationale for including OSM is void.

OSM still earns inclusion — but on the narrower, now-evidenced grounds that it carries **25 natural and historic features** (`natural=waterfall|peak`, `historic=*`) that a commercial-POI schema like Overture Places does not model at all, plus meaningfully better `cuisine` (26%) and comparable `phone` coverage. For a destination that *is* waterfalls and a mountain, that is a real gap to close. The decision stands; the reason changed.

**4. The differentiator is confirmed unavailable at any price.** No dataset, licensed or scraped, carries stairs, seating, toilet type, drop-point distance, or coach parking. The measurement puts a number on it: zero.

---

## Answer 1 — OSM and ODbL

### What OSM is

Three primitives: **nodes** (a point), **ways** (an ordered node list; closed for a building or park), **relations** (grouped elements). A POI is usually a node, increasingly a way where the building outline *is* the POI. Everything else is **tags** — free-form `key=value` pairs with no enforced schema, governed by wiki convention rather than validation. `opening_hours` is a genuine grammar (`Mo-Fr 08:00-12:00,13:00-17:00; PH off`), not free text.

Acquisition: **Geofabrik** regional `.osm.pbf` (bulk, daily, self-hosted, unmetered) → `osm2pgsql` or `imposm3` into PostGIS. **Overpass API** for targeted deltas, capped around 10k requests / 1 GB per day per user.

### ODbL 1.0 — three legal objects, and picking the right one *is* the architecture

| Object | Definition | Obligation |
|---|---|---|
| **Derivative Database** | a database based on OSM, or any alteration of a Substantial part of its contents | **§4.4 share-alike + §4.6 access** — must be offered back under ODbL |
| **Produced Work** | a work resulting from querying it — a rendered page, an itinerary | **§4.3 attribution only.** §4.5 explicitly exempts Produced Works from share-alike |
| **Collective Database** | OSM unmodified, alongside independent databases | share-alike does **not** spread to the non-OSM part |

**The decisive fact:** our survey data in *our* table, OSM rows in *their* table, joined at query time is precisely the pattern OSMF's **Horizontal Map Layers** and **Collective Database** community guidelines exist to bless. Write one OSM-derived value *into* our own row and our table becomes a Derivative Database — and §4.4/§4.6 would oblige us to publish our proprietary field survey under ODbL. **This is a schema decision, not a legal one.**

Also relevant: §4.2 notices, §4.7 no DRM layered on top, §4.8 no extra restrictions and no sublicensing. "Substantial" expressly includes *repeated and systematic* extraction of insubstantial parts; OSMF's practical safe harbour is under ~100 features as a one-off, which we exceed immediately.

Attribution: `© OpenStreetMap contributors`, linked to `openstreetmap.org/copyright`, visibly placed wherever OSM-sourced fields render — a reachable footer, not buried in Terms. Mobile may show it once per session in an about screen.

**Vietnam wrinkle:** ODbL is built on the EU *sui generis* database right. **Vietnam has no equivalent** — Luật SHTT protects only creative selection and arrangement of a compilation, not investment in facts. ODbL's database-right hook is therefore weak here and enforcement would run through contract law. A genuine grey area to raise with counsel — **not a loophole to build on.**

---

## Answer 2 — the daily authenticated scrape

**Verdict: no.** Not primarily on legal grounds — on the grounds that it does not contain what we need.

### The login makes it strictly worse

Almost nothing we want is gated behind authentication: Foody/ShopeeFood menus, prices and hours are visible logged out; a Facebook Page *About* tab is public by design; OTA prices render without a session; Google Maps needs no login at all. A self-registered account therefore buys **no meaningful extra reach**, while converting an ambiguous browsewrap question into an unambiguously accepted clickwrap contract, personally attributable to the founder. Maximum legal delta, near-zero data delta — a strictly dominated move.

### The cadence does not arithmetic

~3,000–8,000 POIs across five platforms is 15,000–40,000 requests/day for a nightly sweep. A genuinely polite profile — robots.txt honoured, single-digit concurrency, 2–3s between same-host requests — runs 3–4 hours *per platform*, so a serial polite sweep consumes most of a working day, every day, to refresh facts that change on a scale of weeks. Either impolite enough to be noticed, or too slow to finish.

### Tết is structural, not bad luck

5–15 engineer-hours/month across six brittle scrapers in calm periods, spiking on redesigns; the Foody→ShopeeFood merge already broke every scraper built against the old markup. **Tết is simultaneously peak travel demand and peak platform UI churn** — the week the data matters most is the week it is most likely to be silently stale.

### Vietnam legal reality, specifically

- **No CFAA equivalent.** The nearest analog, **Điều 289 BLHS 2015**, targets circumventing a technical barrier — a password you do not have, a firewall. Using your own valid account to fetch pages it may see does not fit. **Criminal risk is genuinely low.**
- **Facts are not protectable.** Names, addresses, hours, prices are not copyrightable, and Vietnam has no sui generis database right. Storing those facts is low risk.
- **The sharp edge is personal data.** Nghị định 13/2023 and the PDPL (**Law 91/2025/QH15, effective 2026-01-01**). Vietnam's PDPL has **no legitimate-interest basis** analogous to GDPR Art 6(1)(f) — Art 19.1(a) is a narrow defensive carve-out. Consent is effectively mandatory, so scraped reviewer names, avatars and review text have **no available lawful basis**. Business owners' personal phone numbers count too.
- **Photos** are the uploader's copyright, not the platform's — the platform cannot license us rights it does not hold.
- **Practical enforcement ladder:** IP block → account termination → cease-and-desist → civil suit (rare) → administrative fine (only on a data-subject complaint) → criminal referral (very unlikely). No public record found of a Vietnamese company sued or prosecuted for scraping. Honest read: at our scale, realistic exposure is account termination and possibly a C&D.

### The decisive argument

**The seat briefed to argue *for* scraping concluded against it:** none of these platforms carry stairs, seating, squat-vs-seated toilets, drop-point walking distance, or coach parking. Google Maps has the closest analog — sparse, binary, self-reported wheelchair booleans, which answer a wheelchair question rather than a coach-logistics one, and are unstorable under Google's terms regardless. The most scraping buys is raw review text to mine for phrases like *"khó đậu xe khách"* — a standalone Vietnamese-NLP project, not a free byproduct of a nightly run.

### And the positioning cost is asymmetric

Our premise is that we are more verifiable than an anonymous Facebook page — our target customer was defrauded by one. Building the knowledge base out of silently harvested Facebook pages inverts that. A journalist or competitor who discovers it gets a clean story — *"trust platform's data was scraped, not verified"* — which requires no court to ever rule against us.

---

## Answer 3 — affiliate programmes

**Direct answer: mostly no. Affiliate gives links and live rates, not a licensable content database.**

| Programme | What you get | Storable static content? |
|---|---|---|
| Booking.com Affiliate + Demand API | widgets, deep links, live rates, property details | No — usable only inside the referral flow; data-forwarding banned |
| Agoda Affiliate | widgets, deep links | No |
| **Agoda Partner API (Content API)** | CSV data file / XML feed, weekly+daily refresh, ~20 hotel + 3 room photos | **Yes** — contracted partner tier, not affiliate signup |
| Klook Affiliate | widgets, deep links, strong VN attractions | No |
| Klook Partner API | in-flow content + rates | Unverified; contact-gated |
| GetYourGuide Affiliate | links (very low bar, 3–5 days) | No |
| GetYourGuide Partner API | live content | Gated at **100k monthly visits** basic / **1M + 300 bookings** full — out of reach |
| Traveloka | no visible self-serve programme; Partners Network is contact-gated | Unverified |
| Expedia Rapid (EPS) | live rates | Discretionary commercial approval |
| **Hotelbeds Content API** | addresses, descriptions, photos, facility codes | **Yes — the terms *require* you to store it and refresh weekly.** The only programme that wants you to build a local database |
| RateHawk / ETG | live + likely content | Claimed 1–2 week onboarding; terms unverified |
| Amadeus Self-Service | live search, free 2,000 calls/mo, instant | **No — explicitly live-only by design** |
| TripAdvisor Content API | descriptions, reviews, ratings; free ~5,000 calls/mo | No — only `location_id` cacheable; mandatory logo attribution |
| Google Places API | richest, incl. `wheelchairAccessibleEntrance` + parking/restroom/seating | **No — only `place_id`.** No partner tier relaxes it |

**Accessibility:** Google has real structured accessibility booleans and they are unstorable. Hotelbeds has generic facility-group codes that *might* carry accessibility-adjacent entries — unverified, needs a live `/types/facilitygroups` query. Nothing else has any.

Affiliate therefore solves **monetisation and live price display**, not knowledge-base diversity.

---

## Answer 4 — Common Crawl, review sites, and price-tier stratification

*Question: can we call an API or use a common crawler over rating/review sites, Facebook and social posts to get all the places — coffee shops, restaurants — layered from 5★ expensive down to mid and lower range?*

### Common Crawl is the most legitimate idea raised, and it still fails

**It is legal and free.** A nonprofit archive hosted on AWS; commercial use is not excluded. We would not be crawling anyone — we would be reading an existing public archive. Genuinely different from running a scraper.

Four things break it:

**1. Access is not rights.** Common Crawl states that all crawled content is copyrighted by third parties and that it "cannot offer a license to the crawled page contents." Reach, not permission.

**2. The convenience layer is research-only.** Web Data Commons has extracted schema.org markup from Common Crawl annually since 2013 — `LocalBusiness`, `Restaurant` and `Hotel` entities carrying `priceRange` and `aggregateRating`, which is *exactly* the tiering asked for. The 2024-12 release is 136.7 billion quads across ~1,703 GB. **WDC states: "We publish the corpora for research purposes only."** Hard blocker for commercial use. Using it commercially would mean running our own extraction over raw WARC files — a large project that lands us back at point 1.

**3. Facebook is not in Common Crawl.** CC honours robots.txt; Facebook's broadly disallows crawlers. The social layer is structurally unreachable this way.

**4. The decisive problem — Common Crawl's coverage bias is exactly inverse to the requirement.**

The ask is depth *down to the lower range*. Common Crawl can only see a business that has **its own website**. In Vietnam that skews hard toward chains and 4–5★ hotels. The bún bò quán, the bánh căn stall, the family homestay, the cà phê vườn have no website at all — they live on a Facebook page, which CC excludes.

**Common Crawl over-represents the expensive end and under-represents the cheap end. More crawling yields a *more* skewed catalogue, not a deeper one.**

Additionally: schema.org `aggregateRating` is markup the business publishes on its own site — a rating the merchant wrote about itself. Chú Bình's bought-reviews problem in structured form.

### Can the free sources stratify by tier? Measured: no

| Source | Rating | Price tier | Evidence |
|---|---|---|---|
| Overture Places | absent | absent | schema carries names, categories, contacts, brand, addresses, confidence — no rating or price field |
| **Foursquare OS Places** | **absent** | **absent** | all 22 fields confirmed; rating, price, popularity, hours and accessibility all absent |
| OSM | n/a | `stars` on 21 of 471 Đà Lạt hotels | **4.5%** — measured, see coverage table above |
| Google Places | present | `priceLevel` present | unstorable — `place_id` only |

### But an authoritative free tier source already exists — the one we found for trust

Vietnamese law requires the tourism authority to publish the ranked-accommodation list: **Sở VHTTDL Lâm Đồng** for 1–3★, **Cục Du lịch Quốc gia (VNAT)** for 4–5★.

**That list *is* the 5★ → mid → low stratification** — official, free, and far more trustworthy than any scraped or self-published rating. It is simultaneously the licence badge answering *"is this a registered cơ sở lưu trú"*. **One source, two jobs.**

**F&B has no official tier in Vietnam.** A price band comes from our own observation — a menu photo plus one phone call yields a per-head VND band — or from a paid feed. Field work, consistent with the measurement that ~90% of Đà Lạt restaurants carry no hours and 98% of attractions carry no fee in open data.

### One free win

**FSQ OS Places carries `date_closed` and `date_refreshed`.** Free, permissive, and a direct partial defence against the *"recommends a quán that closed two years ago and is now a nail salon"* hallucination class. Nothing else in the free stack offers a closure signal. Adopted.

### The honest paid answer

Tier and rating **at scale without field work** is a commercial-data purchase, not a crawling problem: **Foursquare Places Pro / Premium** (the paid tier of the dataset already in our stack, which does carry rating, price and popularity) or **dataplor** (350M+ POIs, explicitly positioned for emerging markets, weekly refresh). Neither has been quoted. **Tier at scale costs money; it does not cost crawling.**

---

## The coverage maths that reframes the problem

Worked from the **itinerary side, not the map side**, for the chosen beachhead — a 5-day multi-generational family trip:

- Activity slots: 2/day (evenings are rest for this persona) × 5 days = **10 slots**
- × 3 alternatives each for weather / closure / energy contingency = 30 raw, deduped because a strong option fills several slots across variants → **~20–25 attractions**
- Meals: 3/day × 5 = 15 slots × 2 alternatives, deduped by proximity clustering → **~15–20 restaurants**
- Đèo rest stops / toilet-grade waypoints → **~5**
- Lodging → **1–2**

**Total: ~40–50 core entities, ~60–80 with generous buffer.**

Re-verification treadmill at ~18 min per entity per month including admin:

| Entities | Hours/month | |
|---:|---:|---|
| 50 | 15 | |
| 80 | 24 | |
| 200 | 60 | 0.375 FTE |
| 1,000 | 300 | **1.9 FTE — for one destination** |

At a realistic ~20 hrs/month of ops capacity per destination without a new hire, **break-even is ~65–70 entities.**

**The two independently-derived numbers converge.** What the product needs to be consultable ≈ what the team can keep fresh. Every bulk source is sized for *thousands of shallow rows*; the product needs *tens of deep rows*. Both figures are derived estimates rather than measurements — but the convergence is a strong signal, and the Overpass counts above confirm that supply is nowhere near the binding constraint.

---

## Decisions

**1. Two-tier catalogue.**
- **Tier A — verified core, 50–80 per destination.** We surveyed it; it carries the four blocking fields (stairs, seating, toilet type, drop-point distance) plus a last-verified date; we stand behind it. Bounded by the treadmill maths.
- **Tier B — attributed long tail, unlimited.** From permissive bulk sources, displayed with visible source, visible date, and explicitly marked unverified. ~5 hrs/month upkeep. Supplies depth, coordinates, and the "where in Đà Lạt" area structure without ever claiming we verified it.

Promotion B→A requires a survey and a date. It never happens silently.

**2. OSM included, isolated, query-time join only.** A permanent schema rule:
- OSM-derived rows live in their own tables. Nothing OSM-derived is ever written into a survey row.
- Join at read time, on `osm_id` or geometry proximity.
- `© OpenStreetMap contributors` renders visibly wherever an OSM-sourced field reaches a page or an API response.
- Any export of the joined view exports as **two files**, never one merged file.

**3. Hotelbeds outreach starts now; all other affiliate deferred.** Sole path to a licensable, storable static content set, and the longest lead time (1–3 weeks to open a conversation). Consumer affiliate signups wait until there is traffic worth showing.

**4. Cost posture — cheapest viable at each phase, escalate on evidence.** No vendor spend now. Each step up the ladder is gated by a measurable trigger, not by appetite.

| Phase | Data spend | Contents | Trigger to advance |
|---|---|---|---|
| **0 — now** | **$0** | Overture + FSQ OS spine (incl. `date_closed`); OSM as isolated ODbL layer; official VNAT / Sở VHTTDL star list for lodging tier; operator debrief; field survey of the 50–80 Tier-A set | measurable bus-leg conversion lift on the Đà Lạt cohort vs. the pre-ship baseline |
| **1** | partnership only, no per-record fee | Hotelbeds Content API — storable static lodging content, descriptions, photos, facility codes | ≥3 destinations live **and** the field-survey treadmill exceeding the 20 hrs/month/destination ceiling |
| **2** | per-record / per-seat | paid POI feed (dataplor or FSQ Places Pro/Premium) for tier + rating at scale | V1's information-only posture revisited |
| **3** | commission-based | affiliate / live prices, if and when we sell more than the bus seat | — |

The phase-1→2 trigger is deliberately the treadmill break-even (~65–70 entities per destination at ~20 hrs/month). **Paid data is what we buy when the humans run out of hours — not before, and not to chase depth nobody has proven anyone wants.**

**5. Price tier is a first-class field with a per-category source and explicit provenance.**

| Category | Tier source | Provenance |
|---|---|---|
| Lodging | official VNAT / Sở VHTTDL star ranking | `official` |
| F&B | surveyed per-head VND band | `surveyed` |
| Attractions | posted entry fee, surveyed | `surveyed` |
| Tier-B long tail | none | `unknown` |

Native per category — the official star stays a star, the F&B band stays a VND range. No uniform scale that flattens a government classification into a guess-shaped number.

**A tier value may never be inferred, guessed, or carried over from a scraped rating. `unknown` is a legitimate and required state**, and the UI must display it without embarrassment. An unknown tier shown honestly is the whole difference between this product and the Facebook page that burned Chú Bình.

**Source stack, ranked by whether it changes Chị Hương's decision to book — not by row count:**

1. **Operator / driver debrief** — free, already internal, uniquely holds real drop-to-entrance distance and actual đèo transit time versus schedule. Nobody else has it. Directly resolves the JOIN anxiety.
2. **Field survey of the Tier-A set** — the four blocking fields + last-verified date, plus the F&B price band.
3. **Overture Places (CDLA-Permissive 2.0) + Foursquare OS (Apache 2.0)** — Tier-B spine, no copyleft, merge freely. FSQ's `date_closed` / `date_refreshed` are the free closure signal.
4. **Official VN sources** — VNAT and Sở VHTTDL ranked-accommodation lists (licence badge **and** lodging tier), business-registration lookup, provincial event calendar.
5. **OSM as the isolated ODbL layer** — for the 25 natural/historic features a commercial-POI schema does not model, plus `cuisine` and `phone`. **Not** for accessibility; the measurement above voided that rationale.
6. **Hotelbeds** — lead-time clock only.

**Explicitly out:** any scraping of Foody / ShopeeFood / Facebook Pages / Traveloka / Google Maps HTML; any authenticated-account scraper; Google Places as a backing store; Common Crawl and the Web Data Commons extracts.

---

## Two structural findings

**1. `lib/geo` is factually stale, and was the wrong unit for tourism anyway.** `lib/geo/data/vn-admin-tree.json` is the legacy 3-tier tree (63 provinces / 696 districts / 10,051 wards), a deferral recorded deliberately in its `PROVENANCE.md`. Since **2025-07-01** Lâm Đồng has merged with Đắk Nông and Bình Thuận, and the old *Thành phố Đà Lạt* is now five wards — **Xuân Hương, Cam Ly, Lâm Viên, Xuân Trường, Lang Biang** — within a 124-unit province.

This matters less than it appears, because official wards are the wrong unit for *"where in Đà Lạt"* regardless. Travellers think in *khu Hoà Bình, hồ Xuân Hương, Tuyền Lâm, Trại Mát, Cầu Đất, Măng Lin* — informal areas that cut across ward boundaries and always have. The KB needs its own tourism **Area** concept, not a join onto the admin tree. `lib/geo` stays what it is: address validation. **The admin-merger refresh is therefore not a blocker for this work.**

**2. Do not overload the existing `Place` model.** `Place` (`prisma/schema.prisma:170-183`) is a flat registry of *bus-route endpoint names* — `canonicalName`, `aliases[]`, `slug` — auto-created from operator free-text via `resolveOrCreatePlace` (`lib/places/placeRepo.ts:29`). "Đà Lạt" exists there as *a place a bus goes to*. A POI inside Đà Lạt is a different concept carrying coordinates, hours, prices and verification state. Two models, with the destination referencing the `Place` the bus serves. Overloading `Place` would corrupt route resolution.

---

## Next step — a 30-day falsifiable test, not a data programme

1. **Derive the Tier-A entity list** for Đà Lạt from the itinerary-slot maths — from the itinerary side, not a map export. Write it down before collecting anything.
2. **Populate it** via operator/driver debrief first, direct phone or site check second. Four blocking fields + last-verified date on every row.
3. **Tier-B floor:** the Overpass measurement above is done. Remaining: pull the Overture Places release for the same bbox and compare category counts against the OSM numbers, to decide which source leads the spine.
4. **Ship and measure bus-leg attach rate** — conversion from "itinerary shown referencing ≥1 verified entity" → "seat purchased", against the baseline for itineraries with zero verified entities. **Capture the baseline before shipping** or it proves nothing.
5. **Send the Hotelbeds enquiry** in week 1 so the clock runs in the background.

**If the lift is not measurable within 30 days, no amount of additional sourcing volume will produce it.**

Sequencing consequence: step 3 is the only step touching the ODbL boundary; steps 1–2 are the only steps producing the differentiator. If capacity is short, 1–2 come first.

---

## Open items

| # | Item | Owner |
|---|---|---|
| 1 | Vietnamese counsel on ODbL enforceability absent a sui generis database right, and on PDPL obligations for any third-party-sourced data | Legal |
| 2 | Overture Places extract for the same bbox — compare against the OSM counts above before choosing the lead spine source | Product |
| 3 | Hotelbeds `/types/facilitygroups` query to confirm whether any accessibility-adjacent facility codes exist | Product |
| 4 | Baseline bus-leg conversion on family/group searches, captured before anything ships | Product |
| 5 | Obtain the Sở VHTTDL Lâm Đồng 1–3★ and VNAT 4–5★ ranked-accommodation lists — this is both the lodging tier source and the licence badge, and it is the highest trust-per-hour acquisition available | Product |
| 6 | Decide the F&B per-head VND band boundaries before surveying, so bands are consistent across destinations rather than retrofitted | Product |

---

*OSM-derived counts in this document were obtained from the Overpass API. Data © OpenStreetMap contributors, available under the Open Database License — <https://openstreetmap.org/copyright>.*
