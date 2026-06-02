---
depends-on: []
type: FEATURE
wave: 1
spec: [S02, SYS04]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S02] / [SYS04]

## What to build

**Cursor/seek pagination on customer search results.** The S15#22 decision ("cursor/seek
pagination on results") is ratified and `rebuild-plan.md` marks it RESOLVED, but neither an issue
nor the code exists — `lib/db/searchTrips.ts` does `findMany` with no `take`/`cursor`, and
`app/search/page.tsx` filters in-memory over the full base set. A popular route overflows one
response.

- `lib/db/searchTrips.ts`: add `take = limit + 1` + a stable seek cursor on `(departureAt, id)` —
  mirror the operator-list convention in `lib/booking/listOperatorBookings.ts` (id-seek, take+1,
  stable `orderBy`, return `nextCursor`).
- `app/search/page.tsx`: carry the cursor in the URL (URL = source of truth; share/refresh
  preserves position); render a next-page control. Facets still computed from the **unfiltered**
  base set (`lib/search/applyTripFilters.ts`), not the page.
- Keep the set-based availability predicate (already always-on after the 2026-06-01 P1 fix).

## Acceptance criteria

- [ ] A route with more trips than the page size returns a first page + a working `nextCursor`.
- [ ] Following the cursor returns the next page with no duplicates/gaps (stable seek).
- [ ] Refresh/share of a paginated URL preserves position.
- [ ] No N+1 — one base query per page; facets still from the unfiltered base set.

## Blocked by

- none (reuses the `listOperatorBookings.ts` seek-pagination pattern).

## User stories addressed

- [S02] As traveler, search results paginate so a busy route doesn't overflow one response and I
  can page through all trips.
