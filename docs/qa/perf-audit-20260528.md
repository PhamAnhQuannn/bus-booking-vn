---
audit-date: 2026-05-28
build-target: STATIC ANALYSIS (no Lighthouse run)
status: advisory
---

# Perf Audit — 2026-05-28 (static)

> ⚠️ **No Lighthouse/CWV numbers.** A real lab pass needs a stable prod deploy + 3-run median; a single local-box run is high-variance noise (the skill's own caveat). This is a grounded static assessment + the actionable opportunities. Re-run `npx lighthouse` against a staging/prod URL for promotion-gate numbers.

## Budgets
No `docs/nfr.md` → defaulting to Web Vitals "good": LCP ≤2.5s · CLS ≤0.1 · INP ≤200ms · TTFB ≤800ms · FCP ≤1.8s. **Action: author `docs/nfr.md` (`/nfr-template`)** so the gate has real targets.

## Findings

### ✅ Low risk
- **LCP / CLS — images:** the app ships **zero images** (`next/image`=0, raw `<img>`=0) — text + lucide SVG icons only. No unsized-image CLS, no LCP hero image to preload. Layouts are fixed (Card/grid), so layout shift is minimal. (Design plan's "destination imagery" is deferred — when added, set explicit dimensions / `aspect-ratio`.)
- **Bundle:** small surface — base-ui + lucide + zustand, no heavy client libs. No image weight. First-load JS is modest (text app).

### ⚠️ INP / responsiveness — search filter round-trips
- `components/search/SearchFilters.tsx` calls `router.replace(...)` on **every** control change (operator/busType/window/price/sort), with **no `useTransition` / `useDeferredValue` / debounce**. Each toggle = a full RSC navigation + DB query; without `useTransition` the update isn't marked non-urgent, so rapid filter changes can feel janky and there's no pending affordance.
- **Fix:** wrap `commit()` navigations in `useTransition` (show a subtle pending state on the results list); price inputs already defer to `onBlur` (good). This is the single highest-value responsiveness improvement.

### ⚠️ TTFB — `/search` uncached
- `/search` is `force-dynamic` + `Cache-Control: no-store`; every search runs `searchTrips` (raw routeId match → `findMany` → optional hold/booking aggregates) against Postgres. Correct for live seat counts, but TTFB scales with DB latency and offers no edge cache.
- **Fix (later, at scale):** short-TTL CDN cache (`s-maxage`) for popular origin/destination/date combos, or cache the route-facet list. Not needed now.

### Code-splitting
- 0 manual `next/dynamic` boundaries. Fine at current bundle size; revisit only if a heavy client widget (map, seat-map, charts) lands.

## Verdict
**Advisory — no blocking lab failures identified statically.** Image/CLS/bundle risks are minimal (text app). The one concrete improvement is **`useTransition` on the search filter rail** (INP/UX). Author `docs/nfr.md` + run a real Lighthouse pass on staging before a public-launch promotion gate.

## Auto-chain
- INP → memoize / `useTransition` on `SearchFilters` (do now, cheap).
- TTFB/caching → `/cache-strategy` for `/search` popular routes (defer).
- Missing budgets → `/nfr-template`.
