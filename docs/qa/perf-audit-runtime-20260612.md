# Performance Audit — Runtime Analysis

Date: 2026-06-12
Scope: Full codebase, code-analysis-only (no Lighthouse run)
Auditor: automated code-analysis agent

---

## Summary

The codebase has solid server-side patterns (cursor pagination, bounded `take`, no N+1 loops in hot paths), but the customer-facing homepage has a critical LCP defect — the hero image uses CSS `backgroundImage` instead of `next/image` with `priority`, which prevents the browser from discovering it in the preload scanner. A secondary cluster of issues covers missing `next/image` usage across content carousels (11 raw `<img>` elements), two redundant `searchTrips` calls on every `/search` page load, and the complete absence of caching on DB-read-only page data that doesn't need to be fully dynamic.

---

## P1 — Go-Live Blockers

### 1. Hero LCP: CSS `backgroundImage` hides the image from the preload scanner

**File:** `app/(customer)/page.tsx` lines 62–73

The hero is rendered as two `<div style={{ backgroundImage: "url(...)" }}>` elements. CSS `background-image` is not discoverable by the HTML preload scanner — the browser finds it only after CSSOM is built, adding a full render-blocking round-trip. The same file does call `react-dom`'s `preload()` (lines 32–33), but `preload()` with `as: 'image'` still waits for JS to execute, giving no scanner-level benefit on a cold 4G load. The inline comment in the code (`// Production LCP upgrade: replace this div with <Image fill priority src=… />`) confirms this was known but deferred.

**Risk:** On Moto G Power over 4G with 4× CPU throttle, LCP for the homepage is almost certainly above the 2.5s budget. This is the single most impactful CWV gap.

**Fix:** Replace both hero `<div>` elements with a single `<Image>` component from `next/image`:

```tsx
import Image from 'next/image';
// ...
<Image
  src="/hero/landing-1280.jpg"    // or use sizes= for responsive
  alt="Hero"
  fill
  priority                         // triggers <link rel="preload"> in the HTML
  quality={85}
  className="object-cover brightness-95"
/>
```

Use the `sizes` prop to serve the correct resolution per viewport: `sizes="(max-width: 767px) 100vw, 100vw"` pointing at the 1280/2560 variants via `next.config.ts` `images.localPatterns`. Remove the two `preload()` calls — `next/image priority` handles this natively at the HTML level.

### 2. `/search` page fires TWO full `searchTrips` calls per page load

**File:** `app/(customer)/search/page.tsx` lines 396–402

```ts
const [base, page] = await Promise.all([
  searchTrips({ ..., limit: Number.MAX_SAFE_INTEGER }),  // full base for facets
  searchTrips({ ..., cursor, limit: SEARCH_PAGE_LIMIT }), // page slice
]);
```

Both calls hit the same 3-query pipeline (route lookup → trip rows → hold sum → booking sum). On a busy route, `searchTrips` with `limit: Number.MAX_SAFE_INTEGER` loads the entire result set into Node process memory with zero row cap. The second call repeats the same DB round-trips for the overlap. Together, the two calls can double TTFB on a popular search.

**Risk:** Directly violates the p95 ≤ 300ms target for `/api/trips/search` and the TTFB ≤ 800ms budget for `/search`. With 200+ trips on a popular route the base call can return thousands of rows to Node memory.

**Fix:** Call `searchTrips` once without a cursor to get the full availability-resolved list, then apply the in-memory seek slice and facet derivation against that single result. This is 3 DB queries instead of 6:

```ts
const allTrips = await searchTrips({ origin, destination, date, ticketCount,
  limit: Number.MAX_SAFE_INTEGER });
const { facets, totalBeforeFilters } = applyTripFilters(allTrips.trips, activeFilters);
// Derive the page slice in-memory from allTrips.trips (same cursor logic)
```

Alternatively — and better for large routes — run facets from a dedicated lightweight aggregate query and load only the page slice from `searchTrips`, accepting that facet counts are from the full DB set while the page is the seek-paginated slice. This is the intended design per the `searchTrips` module DESIGN comment; the current implementation materialises the full set in the base call anyway, so the fix is simply to reuse it for both purposes instead of repeating it.

---

## P2 — Should Fix Before Launch

### 3. All content images use raw `<img>` — no optimization, no responsive sizes

**Files:**
- `components/home/PopularTrips.tsx` line 85 — destination thumbnails (up to 12 images)
- `components/home/FeatureHighlights.tsx` line 73 — feature photos (3 images)
- `components/home/ContractCarRental.tsx` line 76 — tourism bento photos (8 images)

All use native `<img loading="lazy">` with no width/height attributes and no `srcset`. The browser must download the full-resolution JPEG then lay out the image, causing layout shift (CLS risk) because the image dimensions are unknown at paint time. The eslint disable comment (`no-img-element -- next/image+sharp not used in this app`) reveals this was a deliberate skip.

`sharp` IS installed (present in `node_modules/.pnpm/sharp@0.34.5`). The only gap is `next/image` configuration.

**Risk:** CLS violations on the homepage carousel. Each image block collapses then expands as the browser measures it. With 12 destination thumbnails in the carousel, cumulative CLS can exceed 0.1. Also, 8 tourism images in the bento grid without dimensions cause layout thrash.

**Fix:**
1. Add `images.localPatterns` to `next.config.ts` to allow `/public/**`.
2. Replace `<img>` with `<Image>` from `next/image` in all three components, supplying `width`/`height` (or `fill` + `sizes` for flexible containers). The aspect-ratio CSS classes already applied (`aspect-[4/3]`) work naturally with `next/image fill` inside a `relative` container.

### 4. Homepage renders fully dynamic — no ISR despite data changing at most hourly

**File:** `app/(customer)/page.tsx` — no `dynamic` export (defaults to dynamic because of DB reads)

The homepage calls:
- `getSearchablePlaces()` — the Place table changes only when an operator adds a route.
- `getActiveRoutes()` — active route list changes when operators publish trips (~hourly/daily).
- `getHomeMetrics()` — operator/route/trip counts update occasionally.

None of these require real-time freshness for the trust strip or popular-routes carousel. Every visitor triggers three DB queries for identical data.

**Risk:** Unnecessary TTFB load; every homepage hit costs a DB round-trip when the data could be stale-served from Vercel's edge cache.

**Fix:** Add `export const revalidate = 300;` (5 minutes) to `app/(customer)/page.tsx`. This enables ISR — Vercel serves the cached HTML for 5 minutes, then regenerates on the next request. The `SearchFormWrapper` and its combobox data (places list) are the only part that benefits from freshness, but a 5-minute stale places list is acceptable (operators don't add cities mid-session). For the `/routes` page, same fix applies (currently `force-dynamic` for no strong reason).

### 5. `Geist_Mono` loaded globally on every page including customer portal

**File:** `app/layout.tsx` lines 15–18

```ts
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

`Geist_Mono` is applied to the root `<html>` element via CSS variable and used throughout the app including customer-facing pages (price displays use `font-mono`). However, `Be_Vietnam_Pro` covers the `vietnamese` subset while `Geist_Mono` only covers `latin`. Mono fonts are a secondary typeface; loading them globally adds an extra font file download on every page.

**Risk:** Extra font download on customer portal pages; Geist Mono does not cover Vietnamese glyphs so price strings fall back to the system monospace anyway in VN locale when prices contain non-ASCII characters (though VND integers are all ASCII, so this is lower severity).

**Fix:** `Geist_Mono` without `display: 'swap'` defaults to `display: 'optional'` in Next.js font loader — this means browsers may skip it if it doesn't load within a short window. Add explicit `display: 'swap'` to match `Be_Vietnam_Pro`'s behaviour, OR move the mono font to an operator/admin-only layout since customer pages predominantly use `Be_Vietnam_Pro`.

### 6. `/search` page fetches places list on every render for the inline edit form

**File:** `app/(customer)/search/page.tsx` line 427

```ts
const places = await getSearchablePlaces();
```

`getSearchablePlaces()` runs a raw SQL `UNION` across the Place table on every `/search` render. This is a pure read of slowly-changing data. The places list is also fetched for the homepage (`app/(customer)/page.tsx` line 34). Both calls are uncached.

**Fix:** Same ISR fix as #4 — if `/search` uses `revalidate` (even 60s), or wraps `getSearchablePlaces` in React's `unstable_cache` with a 5-min TTL, the Place UNION query is amortized across requests.

### 7. `will-change-transform` on two full-bleed divs (hero) + animated blob in IntroBanner

**Files:**
- `app/(customer)/page.tsx` lines 66, 71 — `will-change-transform` on hero background divs
- `components/home/IntroBanner.tsx` line 28 — `will-change-transform` on animated blob

`will-change-transform` promotes every element to its own GPU compositing layer. Two full-bleed hero divs (each covering the full viewport at 100vw × ~600px on mobile) represent large GPU texture allocations. On Moto G Power (≤2GB RAM), excessive compositor layers cause memory pressure and jank. The Ken Burns animation is purely decorative.

**Risk:** INP degradation during scroll on low-memory Android devices. GPU memory allocation for two full-viewport textures plus the blob animation can slow first render.

**Fix:**
- Keep `will-change-transform` only on the currently-visible hero div (use a single div + `@media` conditional rendering via CSS, or one div with `background-image` conditional on a data attribute set server-side).
- Wrap the Ken Burns animation with `@media (prefers-reduced-motion: no-preference)` already done via `motion-safe:animate-*`, but also consider removing `will-change-transform` from the non-animated md-breakpoint div (which is `md:hidden` anyway).
- For the IntroBanner blob: `will-change-transform` on a `size-96` blurred blob is fine; keep it.

---

## P3 — Advisory

### 8. `getActiveRoutes` runs a multi-table JOIN + GROUP BY without a result cap

**File:** `lib/core/db/getActiveRoutes.ts`

The raw SQL query joins Route × Trip with `GROUP BY r.origin, r.destination`. As routes grow, this touches every active Trip row in the DB to compute MIN aggregates. Called on homepage and `/routes` page.

**Note from prior audit:** This was flagged as a P3 in the 2026-06-05 static audit. Still not fixed. Recommend adding ISR caching (fix #4) first; the DB-side fix (a materialized view or indexed aggregate table) is P3.

### 9. `listSearchablePlaces` uses a `UNION` with `unnest(aliases)` — no index on aliases array

**File:** `lib/places/placeRepo.ts` lines 73–82

```sql
SELECT "canonicalName" AS place FROM "Place"
UNION
SELECT unnest("aliases") AS place FROM "Place"
```

`aliases` is a `String[]` array column. The `unnest` requires a full table scan on Place for each call. Place table is small now but will grow. No GIN index on `aliases` for containment queries.

**Fix (advisory):** Add a GIN index on the `aliases` column (`@@index([aliases])` in Prisma DSL or `CREATE INDEX ... USING GIN ("aliases")`). More impactful: cache the result with ISR or `unstable_cache`.

### 10. `/trips/[id]` is `force-dynamic` but calls two aggregate queries (hold + booking sums)

**File:** `lib/trips/getTripDetails.ts` lines 79–91

The page runs two `prisma.*.aggregate` calls after the main trip query — unavoidable for live availability. However, the `force-dynamic` directive means every direct link to a trip detail page triggers 3 DB queries. For trips departing > 24h in the future, stale-while-revalidate (5s) would serve most users from cache.

**Fix (advisory):** Change from `force-dynamic` to `export const revalidate = 5;` — short enough that availability is never stale by more than one hold cycle (holds expire in 15 min), but amortizes the queries across bursts of users clicking the same trip from search.

### 11. No `@next/bundle-analyzer` configured — bundle sizes unverified

**File:** `next.config.ts` — no `bundleAnalyzer` wrapper; `package.json` — no analyze script

The NFR budget (NFR-003) sets ≤150kB gzip per customer page. There is no mechanism to verify this target is being hit. The dependency list includes `@react-pdf/renderer` (a heavy PDF library), `date-fns` + `date-fns-tz`, `zustand`, `jose`, and `lucide-react`. `@react-pdf/renderer` is used only in server-side cron jobs (`lib/jobs/generateTicketPdfs.ts`, `lib/booking/ticketPdf.tsx`) so it should never appear in a client bundle — but this is unverified without a bundle analysis run.

**Fix:** Add `@next/bundle-analyzer` to devDependencies and a `"build:analyze": "ANALYZE=true next build"` script. Run before go-live to confirm `@react-pdf/renderer` is not leaking into client chunks.

### 12. `SearchFilterRail` + `SearchToolbar` both instantiate `useFilterState()` independently — double `useSearchParams()` subscription

**File:** `components/search/SearchFilters.tsx` lines 57–93

`SearchFilterRail` calls `useFilterState()` and `SearchToolbar` also calls `useFilterState()`. Both are rendered on the same `/search` page. Each `useFilterState()` independently subscribes to `useSearchParams()`, resulting in two separate router subscription instances. React 19 deduplicates these within a render pass, but on a URL change both components re-render individually, potentially causing two paint cycles.

**Fix (advisory):** Lift `useFilterState()` to a shared context provider at the `ResultsList` level and pass `s` as a prop to both `SearchFilterRail` and `SearchToolbar`. Low-priority since Next.js App Router batches route updates, but it eliminates redundant subscriptions.

### 13. `Hold` model: `getManifest` uses two separate DB queries (trip verify + bookings)

**File:** `lib/booking/getManifest.ts` lines 56–87

```ts
const trip = await prisma.trip.findFirst(...);  // verify ownership
if (!trip) return null;
const bookings = await prisma.booking.findMany(...);  // fetch bookings
```

Two sequential queries with a serial await. For the manifest page, which is operator-internal and not in the CWV path, this is acceptable. However, both queries can be combined into one `prisma.booking.findMany({ where: { tripId, trip: { operatorId } } })` with the tenant scope applied to the where clause, eliminating the ownership verification round-trip.

---

## Bundle Risk Assessment

| File | Heavy Import | Client Bundle Risk | Notes |
|------|-------------|-------------------|-------|
| `app/(customer)/booking/review/ReviewClient.tsx` | `lucide-react` (Wallet, Smartphone, CreditCard) | Low | 3 icons tree-shaken |
| `components/home/PopularTrips.tsx` | `lucide-react` (ArrowRight, ChevronLeft, ChevronRight) | Low | 3 icons tree-shaken |
| `app/(customer)/booking/layout.tsx` | `lib/state` (zustand stores) | Low | Zustand is ~3kB gzip |
| `components/search/SearchFilters.tsx` | `useSearchParams`, multiple lucide icons, Dialog | Medium | Dialog + Select from @base-ui adds ~20kB |
| `app/(customer)/trips/[id]/TripBooking.tsx` | `lib/state` | Low | Zustand store |
| `lib/booking/ticketPdf.tsx` (server-only) | `@react-pdf/renderer` | **None** (server only) | Verify with bundle analysis — must NOT appear in client bundle |

**Key finding:** `@react-pdf/renderer` is imported only in server-side files (`lib/jobs/`, `lib/booking/ticketPdf.tsx`) with no `'use client'` directive in the chain. Risk of client-bundle leakage is low but unverified without `next build --debug` output.

**Lucide-react version 1.16.0** supports named ESM exports — each icon is a separate module. Next.js + SWC tree-shakes them correctly. No barrel-import risk.

---

## CWV Risk Assessment

| Page | LCP Risk | CLS Risk | INP Risk | Notes |
|------|----------|----------|----------|-------|
| `/` (home) | **HIGH** — hero is CSS background, not preloaded image | **MEDIUM** — carousel images lack width/height; 12 lazy `<img>` without dimensions | Low — no heavy event handlers | P1 fix required |
| `/search` | Low — no hero image; first paint is text | **MEDIUM** — 3 feature images in FeatureHighlights if included; search result list is text-only | Low — filter URL updates are router.replace (no long task) | Double searchTrips call inflates TTFB |
| `/trips/[id]` | Low — no image; LCP is the sticky price banner (text) | Low — no images; layout is mostly text cards | Low — TripBooking stepper is a simple counter | force-dynamic on a per-trip page adds latency |
| `/booking/review` | Low — no image | Low — static layout | Low — checkbox + radio state updates | Server-rendered hold details, no client fetch |

---

## Database Query Hot Spots

| Query | File | Issue | Severity |
|-------|------|-------|----------|
| `searchTrips` base call with `limit: MAX_SAFE_INTEGER` | `app/(customer)/search/page.tsx:399` | Unbounded in-memory result set on popular routes | P1 |
| `getActiveRoutes` GROUP BY over all trips | `lib/core/db/getActiveRoutes.ts:31` | Full Trip table scan on every homepage + /routes render | P2 (fix with ISR) |
| `listSearchablePlaces` UNION + unnest | `lib/places/placeRepo.ts:73` | Full Place scan + array unnest on every search + homepage render | P2 (fix with ISR) |
| `getHomeMetrics` — 3 COUNT queries | `lib/home/getHomeMetrics.ts:23` | 3 independent DB counts per homepage render | P2 (fix with ISR) |
| `getTripDetails` — 3 sequential queries | `lib/trips/getTripDetails.ts:30` | Trip → holdAgg → bookingAgg; last two are parallel but trip is serial | P3 (acceptable) |
| `getManifest` — 2 sequential queries | `lib/booking/getManifest.ts:56` | trip verify + bookings list could be one query | P3 (operator-internal) |

**No N+1 patterns found.** The `searchTrips` function correctly uses two bounded aggregate queries (`GROUP BY tripId`) rather than per-trip queries. `listUpcomingForOperator` uses Prisma `_count` subqueries (translated to a single SQL query with lateral joins). `listOperatorBookings` uses a single `findMany` with a `take` limit. All operator-facing list queries are cursor-paginated with explicit `take: limit + 1` caps.

---

## Recommendations

**Priority order for go-live:**

1. **[P1] Replace hero CSS background with `next/image priority`** (`app/(customer)/page.tsx`). This is the single highest-impact CWV fix. Estimated LCP improvement: 0.5–1.5s on 4G mobile. 1–2h of work.

2. **[P1] Eliminate the duplicate `searchTrips` call on `/search`** (`app/(customer)/search/page.tsx` lines 396–402). Reuse the base set for both facets and the page slice. Halves DB query count on every search. 1–2h of work.

3. **[P2] Add `width`/`height` (or `fill`) to all content `<img>` elements** across `PopularTrips`, `FeatureHighlights`, and `ContractCarRental`. Eliminates CLS from unsized images. Pre-requisite: add `images.localPatterns` to `next.config.ts`. 2–3h of work.

4. **[P2] Add `revalidate = 300` to homepage and `/routes` page** to enable ISR. Eliminates repeated DB round-trips for slowly-changing data (places, active routes, metrics). 30 min of work.

5. **[P2] Add explicit `display: 'swap'` to `Geist_Mono`** in `app/layout.tsx`. Prevents invisible text during font load on slow connections. 5 min of work.

6. **[P3] Add `@next/bundle-analyzer` and verify `@react-pdf/renderer` is server-only**. Run `next build` with analyzer before tagging go-live. 30 min of work.

7. **[P3] Evaluate caching `getSearchablePlaces`** with `unstable_cache` (TTL 5 min) — prevents Place UNION query on every search render independent of ISR page cache.