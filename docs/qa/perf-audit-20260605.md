---
audit-date: 2026-06-05
target: PR #7 feat/rebuild-complete @ 3fc5afba (static diff pass)
build-target: NOT RUN — static-only
lighthouse-version: n/a (runtime gate deferred)
status: pass (static) / deferred (runtime CWV)
---

# Perf Audit — 2026-06-05 (PR #7)

> ⚠️ **Runtime Lighthouse / Core Web Vitals gate was NOT run.** That gate requires a production
> build (`pnpm build && pnpm start`) + a seeded DB + headless Chrome. Standing the full stack up
> is out of scope for a PR code-review pass. This report covers the **static, diff-reviewable**
> perf surface only (query shape, indexing, pagination, N+1, seq-scans). The CWV gate should run
> against `pnpm start` as part of go-live (#094) — see "Deferred" below.

## Static query/perf review — PASS

| Check | Result |
|-------|--------|
| N+1 (prisma/tx call inside for/map/forEach) | ✅ none found — call sites batch |
| Unbounded list queries (findMany without bound) | ✅ all hot lists cursor-paginated |
| JSON-payload WHERE predicate (seq-scan risk, Issue 014) | ✅ none — `scheduledFor` is a top-level indexed column |
| Index coverage | ✅ 69 `@@index`/`@@unique` declarations in schema |
| Hardcoded fee recompute per request | ✅ FeeConfig effective-dated + cached read |
| Availability oversell scan | ✅ set-based availability (issue 100), not per-seat loop |

Detail:
- **Cursor pagination everywhere it matters**: `listCustomerBookings`, `listOperatorBookings`,
  `listUpcomingForOperator`, `searchTrips` all use stable cursor (+ id tiebreaker) on id/departureAt.
- **Trip-bounded reads** (`cancelTrip`, `completeTripCore`, `reassignBus`, `getManifest`) fetch the
  bookings of ONE trip — naturally bounded by bus capacity (~16–50 rows). Not a scan risk.
- **Issue 014 fix holds**: no `payload->>'...'` predicate in any cron/sweeper — the cron predicate
  columns (`scheduledFor`, retention `*At` columns) are top-level + composite-indexed.

## ⚠️ Advisory (P3)

- **searchTrips in-memory `take = limit + 1`** (lib/trips/searchTrips.ts:259). DELIBERATE +
  documented: a DB-level `take` would be unsafe because availability filtering can exclude rows
  after the DB read, so the code fetches a candidate window, resolves availability in-memory, then
  paginates. Correct for correctness; watch the candidate-window size under a dense trip grid +
  popular route — if the pre-availability candidate set ever grows large, the in-memory resolve
  becomes the hot path. Not a current issue; note for load-test.
- **No `docs/nfr.md`** — perf budgets are not authored, so there is no numeric promotion threshold
  to gate against. Chain `/nfr-template` to set LCP/CLS/INP/TTFB budgets before the runtime gate.

## Deferred — runtime CWV gate (run before go-live #094)

Per skill, run against a production build, 3× median, on: `/`, `/search`, a `/trips/[id]`,
`/booking/review`, `/auth/login`. Default thresholds (no nfr.md): LCP ≤2.5s, CLS ≤0.1, INP ≤200ms,
TTFB ≤800ms, FCP ≤1.8s. Note from PR body: this session already ran Playwright browser crawls
(traveler/operator/cross-persona BROKEN→0) — functional, not perf-instrumented. CWV numbers still
need a real Lighthouse pass.

## Verdict

**Static perf: ✅ PASS** — query shape, indexing, and pagination are sound; no N+1, no seq-scan
predicate, no unbounded hot-list query. **Runtime CWV: ⏸ DEFERRED** to a `pnpm start` Lighthouse
run at go-live. No static perf blocker to merge.

SUMMARY: 0 P1 · 0 P2 · 2 P3 (advisory) · runtime gate deferred
