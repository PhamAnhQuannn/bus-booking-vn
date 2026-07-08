# DS-030 Search & Results UX

Frontend UX specification for the pre-booking search funnel: search form, results display, filtering, sorting, empty states, and SEO URL strategy.

---

## 1. Search Form

### 1.1 Component: `SearchForm`

| Field | Component | Behavior |
|-------|-----------|----------|
| Origin | `PlaceCombobox` | Free-text with filtered dropdown. Diacritics-tolerant: "Da Lat" = "Da Lat" = "Dalat". Alias-aware: "TPHCM" / "Sai Gon" / "Ho Chi Minh" resolve to same Place |
| Destination | `PlaceCombobox` | Same as Origin. Cannot equal Origin (client-side guard) |
| Date | `DatePicker` + `Calendar` | VN timezone minimum: `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`. Monday-first weeks, Vietnamese month labels via `date-fns` `vi` locale |
| Ticket count | Number stepper | Min 1, max 10. Default 1. `inputMode="numeric"` |

### 1.2 Layout

| Viewport | Layout |
|----------|--------|
| Mobile (`< md`) | `flex-col` -- stacked fields, full-width CTA |
| Desktop (`>= md`) | `md:flex-row` -- inline fields with CTA aligned right |

### 1.3 State Management

| Concern | Implementation |
|---------|----------------|
| Store | Zustand `useSearchStore` with `localStorage` persistence |
| Hydration | Empty defaults server-side; fills from store client-side (prevents SSR mismatch) |
| Submit guard | CTA disabled when: origin empty, destination empty, date < VN today, or origin === destination |
| CTA text | "Tim chuyen xe" (Find bus trips) |
| Loading | Button shows spinner + "Dang tim..." (Searching...) |

### 1.4 PlaceCombobox Behavior

| Behavior | Detail |
|----------|--------|
| Mode | `mode="list"` -- free-text input with filtered suggestions |
| Search | `unaccent_immutable ILIKE` on server -- diacritics-normalized |
| Alias matching | Place alias arrays merge common names: "SG" / "Sai Gon" / "Saigon" / "Ho Chi Minh City" all resolve to one Place |
| Empty state | "Khong tim thay dia diem" (No places found) |
| Keyboard | Arrow keys navigate suggestions, Enter selects, Escape closes |
| Touch | 44px minimum tap target per suggestion row |
| English support | Tourist persona "Marco" can search "Da Lat", "Ho Chi Minh City", "Hanoi" |

---

## 2. SEO URL Strategy

### 2.1 URL Pattern

```
/tuyen/{origin-slug}/{destination-slug}/{date}
```

| Segment | Source | Example |
|---------|--------|---------|
| `/tuyen/` | Fixed Vietnamese prefix ("route") | `/tuyen/` |
| `{origin-slug}` | `Place.slug` (canonical, unique) | `ho-chi-minh` |
| `{destination-slug}` | `Place.slug` | `da-lat` |
| `{date}` | `YYYY-MM-DD` | `2026-02-01` |

**Full example:** `/tuyen/ho-chi-minh/da-lat/2026-02-01`

### 2.2 SEO Considerations

| Concern | Implementation |
|---------|----------------|
| Rendering | SSR via React Server Components -- full HTML for Google indexing |
| Meta title | `"Ve xe {origin} di {destination} ngay {date} | BusBooking"` |
| Meta description | `"Dat ve xe khach tu {origin} den {destination}. So sanh gia, xem cho trong, dat ve truc tuyen."` |
| Canonical URL | Self-referencing `<link rel="canonical">` using Place slugs |
| Structured data | `BusTrip` schema.org markup per trip result |
| Long-tail targeting | Route-specific keywords: "ve xe Da Lat TPHCM", "ve xe Sapa Ha Noi" |

---

## 3. Trip Card Anatomy

### 3.1 Card Structure

```
+----------------------------------------------------------+
|  [Operator Logo]  Operator Name        [Verified Badge]  |
|                                                          |
|  06:30  --------  4h 30min  --------  11:00              |
|  Ho Chi Minh                          Da Lat              |
|                                                          |
|  [Limousine]  [WiFi] [USB] [Blanket]                     |
|                                                          |
|  [Don tan noi]              350.000 d    [Dat ve ->]     |
|                             Con 12 cho                    |
+----------------------------------------------------------+
```

### 3.2 Card Elements

| Element | Source | Display |
|---------|--------|---------|
| Operator name | `Trip.route.operator.brandName` | Text, truncated with ellipsis at 30 chars |
| Operator logo | `Trip.route.operator.logoUrl` | 40x40px rounded, fallback: first letter avatar |
| Verified badge | `Operator.status === 'APPROVED'` | Green checkmark icon + "Da xac minh" tooltip |
| Departure time | `Trip.departureAt` | `HH:mm` in `Asia/Ho_Chi_Minh` timezone |
| Arrival time | Derived: `departureAt + route.durationMinutes` | `HH:mm` |
| Duration | `Route.durationMinutes` | `Xh Yphut` format (e.g., "4h 30phut") |
| Origin city | `Route.fromPlace.name` | Vietnamese with diacritics |
| Destination city | `Route.toPlace.name` | Vietnamese with diacritics |
| Bus type | `Bus.busType` | Badge with label (see table below) |
| Amenity badges | Per bus configuration | Small icons with tooltips |
| Pickup type | `PickupKind` indicator | Icon: station / pickup point / custom |

> **Phase 2 (deferred)**: Pickup type indicator deferred to post-launch (trigger: 4 operators). Phase 1 = station-only.
| Price | `Trip.price` (VND integer, server-derived) | Formatted: `350.000 d` (dot thousands separator, dong symbol) |
| Available seats | Computed: `capacity - holds - bookings` | "Con {n} cho" (n seats left) |
| CTA | "Dat ve" (Book ticket) | Primary button, links to hold creation |

### 3.3 Bus Type Badges

| `busType` | Vietnamese Label | Badge Color |
|-----------|-----------------|-------------|
| `coach` | "Xe ghe ngoi" | Grey/neutral |
| `sleeper` | "Xe giuong nam" | Blue |
| `limousine` | "Limousine" | Amber/gold |

### 3.4 Available Seats Display

| Seats remaining | Display | Style |
|-----------------|---------|-------|
| > 10 | "Con cho" (Seats available) | Green text |
| 4-10 | "Con {n} cho" | Amber text |
| 1-3 | "Chi con {n} cho" (Only n seats left) | Red text, bold |
| 0 | "Het cho" (Sold out) | Grey text, card greyed out or hidden (configurable) |

---

## 4. Sort Controls

### 4.1 Sort Options

| Sort | Label (Vietnamese) | Default | Implementation |
|------|--------------------|---------|----------------|
| Departure time (ascending) | "Gio khoi hanh" | Yes (default) | Server-side `ORDER BY departureAt ASC` |
| Price (ascending) | "Gia thap nhat" | No | Client-side re-sort of loaded results |
| Price (descending) | "Gia cao nhat" | No | Client-side re-sort |

### 4.2 Sort UI

| Element | Specification |
|---------|---------------|
| Component | Segmented control or dropdown |
| Mobile | Dropdown at top of results |
| Desktop | Inline segmented control above results |
| Default label | "Sap xep theo: Gio khoi hanh" |
| State | Local component state (not persisted) |

---

## 5. Filter Options

### 5.1 Filter Controls

| Filter | Type | Options | Vietnamese Labels |
|--------|------|---------|-------------------|
| Bus type | Checkbox group | `coach`, `sleeper`, `limousine` | "Xe ghe ngoi", "Xe giuong nam", "Limousine" |
| Departure time range | Radio group | Morning (05-12), Afternoon (12-18), Evening (18-24), Night (00-05) | "Sang", "Chieu", "Toi", "Khuya" |
| Operator | Checkbox group | Dynamic from results | Operator brand names |

### 5.2 Filter Layout

| Viewport | Layout |
|----------|--------|
| Mobile | Bottom sheet or expandable panel, triggered by "Bo loc" (Filter) button |
| Desktop | Sidebar left of results |

### 5.3 Filter Behavior

| Behavior | Detail |
|----------|--------|
| Application | Client-side filtering of SSR-loaded results |
| Reset | "Xoa bo loc" (Clear filters) resets all to default |
| Count | Active filter count shown on mobile filter button badge |
| No results after filter | "Khong co chuyen xe phu hop voi bo loc. Thu thay doi dieu kien tim kiem." |

---

## 6. Results Display

### 6.1 Results Header

| Element | Content |
|---------|---------|
| Route summary | "{Origin} -> {Destination}" |
| Date | Formatted Vietnamese: "Thu Bay, 01/02/2026" |
| Result count | "{n} chuyen xe" (n trips) |

### 6.2 Results List

| Concern | Implementation |
|---------|----------------|
| Rendering | RSC-rendered server-side for SEO. Fresh availability on every request |
| Layout | Vertical card stack, one card per trip |
| Spacing | `gap-4` between cards |
| Loading | Skeleton cards (3 placeholder cards) during navigation |

### 6.3 Promoted/Featured Listings (Future)

| Element | Specification |
|---------|---------------|
| Badge | "Noi bat" (Featured) label on promoted cards |
| Position | Top of results, before departure-time sort |
| Transparency | Badge clearly labels promoted content per advertising disclosure requirements |
| Timeline | Month 3-6 post-launch |

---

## 7. Empty & Edge States

### 7.1 No Results

| Element | Content |
|---------|---------|
| Illustration | Empty bus illustration |
| Heading | "Khong tim thay chuyen xe phu hop" |
| Subtext | "Thu thay doi ngay khoi hanh hoac tuyen duong khac." |
| Actions | "Tim ngay khac" (date picker), "Tim tuyen khac" (clear route) |

### 7.2 Sold-Out Trip

| Display option | Behavior |
|----------------|----------|
| Hidden (default) | Trips with 0 available seats excluded from results |
| Greyed (configurable) | Card shown but greyed out with "Het cho" badge and disabled CTA |

### 7.3 Error States

| Error | Display |
|-------|---------|
| Network error | Toast: "Khong the tai ket qua. Vui long thu lai." with retry button |
| Server error (500) | Full-page error boundary with "Da xay ra loi. Vui long thu lai sau." |
| No matching Place | Combobox empty state: "Khong tim thay dia diem" |

---

## 8. Trust Signals

| Signal | Location | Detail |
|--------|----------|--------|
| Operator verified badge | Trip card, next to operator name | Green checkmark for `APPROVED` operators. Only approved operators appear in search |
| Real-time availability | Trip card | Live seat count, not cached |
| Price = Trip.price | Trip card | Server-derived, never client-computed (I7 invariant). "What you see is what you pay" |
| Route permit indicator | Trip card (future) | Visual indicator of operator transport license for the route |
| Immediate confirmation | Below search form | "Dat ve va nhan xac nhan trong 60 giay" (Book and receive confirmation within 60 seconds) |

---

## 9. Accessibility

| Concern | Implementation |
|---------|----------------|
| Trip card | `role="article"`, `aria-label="{operator} - {departure} - {price}"` |
| Sort control | `role="radiogroup"` with `aria-label="Sap xep ket qua"` |
| Filter panel | `role="region"`, `aria-label="Bo loc tim kiem"` |
| Seat availability | `aria-live="polite"` for dynamic seat count updates |
| Focus management | Focus moves to first result after search submission |
| Keyboard | Tab through cards, Enter to select, filter checkboxes keyboard-operable |

---

## 10. Performance

| Concern | Target | Implementation |
|---------|--------|----------------|
| Search API latency | p95 <= 300ms | SSR via RSC, server-side DB query with composite indexes |
| LCP | <= 2.5s | Streaming HTML via RSC, no client-side loading spinner for initial results |
| Bundle size | Minimal JS | Filters and sort are client-side on already-loaded data; no additional API calls |
| Image optimization | Operator logos | `next/image` with WebP, 40x40 lazy-loaded |

---

## Cross-References

| Document | Relevance |
|----------|-----------|
| [ADR-011 Search & Availability](../../architecture-decisions/ADR-011-search-availability/) | SSR strategy, Place registry, real-time availability, visibility gates, sort decisions |
| [ADR-002 NFR Targets](../../architecture-decisions/ADR-002-nfr-targets/) | Search API p95 <= 300ms, LCP <= 2.5s |
| [FD-004 Form Design](../FD-004-form-design/) | SearchForm, PlaceCombobox, DatePicker, Calendar specifications |
| [FD-006 I18n Design](../FD-006-i18n-design/) | Vietnamese-only UI, VND formatting, date-fns `vi` locale |
| [FD-001 Design System](../FD-001-design-system/) | Card component, badge styles, color tokens |
| [Business: Customer Personas](../../business/personas/customer-personas.md) | Price sensitivity, comparison shopping, persona-specific needs |
| [Business: Ubiquitous Language](../../business/domain-model/ubiquitous-language.md) | Place, Route, Trip, Bus definitions and relationships |
