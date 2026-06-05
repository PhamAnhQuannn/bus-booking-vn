---
depends-on: [091-folder-consolidation]
type: CHORE
wave: 8
spec: [SYS20]
---

> ⚠️ **PARTIAL / SPLIT 2026-06-03.** Structural foundation DONE; enforcement sweep split to
> [092b](092b-barrel-enforcement-reachins-nocycle-tenant.md).
>
> **Done (7 commits, tsc 0, eslint 0 errors, 1408 unit pass):**
> - All **5 rule-4 inversions fixed** — domain repos moved out of `lib/core`: phoneNormalize→
>   core/validation/phone, bookingRepo+bookingSelects→booking, searchTrips+getTripDetails→trips,
>   getSearchablePlaces→places. `lib/core` now imports zero domains.
> - **31 barrels** — all 22 missing `lib/<domain>/index.ts` authored (public API only) + 9 pre-existing → full coverage (AC1 ✅).
> - **Rules 2 + 4 at ERROR**, green; `LIB_DOMAINS` reconciled to post-091 tree (config exempt).
>
> **Deferred to 092b (issue-sized — measured ~600 reach-in sites + 2 new lint plugins under a hard error gate):**
> - AC2 cross-domain reach-in → barrel conversion (~500 app + ~137 lib) + rule-1/3 enforcement (`eslint-plugin-boundaries`).
> - No-cycle (`eslint-plugin-import` + TS-alias resolver) (AC5).
> - AC4 rule-5: `withOperatorScope` wiring across operator-owned repo queries (currently used by zero repos).

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS20] (final sweep)

## What to build

Add per-domain `index.ts` barrels everywhere + flip the import-boundary lint from warn to
**error** and get the tree green. The barrel IS the future service boundary (rule 3).

- Every `lib/<domain>/` gets an `index.ts` exposing its PUBLIC API only; cross-domain imports
  go through the barrel, never into internals.
- Flip the import-boundary lint (issue 038, started in warn) to **error**: enforce rules 1-4
  (app/components no business logic; lib no app/components import; cross-domain via barrel;
  lib/core imports no domain; no cycles). Fix every remaining violation.
- Confirm the tenant-scope helper (issue 038) is used by every operator-owned repo query
  (rule 5) — finish wiring any still-hand-scoped queries.

## Acceptance criteria

- [ ] Every `lib/<domain>` has an `index.ts` barrel (public API only).
- [ ] Cross-domain imports go through barrels (no internal reach-ins).
- [ ] Import-boundary lint at ERROR, tree green, runs in CI.
- [ ] Every operator-owned repo query uses the tenant-scope helper (rule 5).
- [ ] No dependency cycles.

## Blocked by

- Blocked by `issues/091-folder-consolidation.md`

## User stories addressed

- [SYS20] barrel boundaries + enforced import rules + tenant-scope everywhere.
