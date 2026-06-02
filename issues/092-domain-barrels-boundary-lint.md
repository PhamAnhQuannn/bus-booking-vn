---
depends-on: [091-folder-consolidation]
type: CHORE
wave: 8
spec: [SYS20]
---

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
