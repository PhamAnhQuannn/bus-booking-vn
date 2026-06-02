---
depends-on: []
type: FEATURE
wave: 0.5
spec: [SYS20, SYS00, SYS02]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS20] (+ SYS00 door #1, SYS02)

## What to build

Scaffold the target module skeleton so every subsequent wave builds into the right tree
and uses the tenant-scope helper from day 1. This is the SYS20 "scaffold first, migrate
incrementally" decision — create the skeleton + the one-way-door helper + the lint; do NOT
big-bang-move existing folders.

- Create `lib/core/` with sub-areas per [SYS20] target tree: `db/`, `money/`, `time/`,
  `id/`, `result/`, `errors/`, `logger/`, `config/`, `jobs/`, `http/`. Seed each with an
  `index.ts` barrel; move only the trivially-relocatable primitives now (e.g. re-export
  existing `lib/logger.ts`, `lib/config/env.ts` through `lib/core/`), leaving full folder
  migration to later waves.
- Implement the **tenant-scope query helper** in `lib/core/db` (SYS00 one-way-door #1 /
  SYS02): a wrapper that always injects `operatorId` into operator-owned queries so new
  repos can't forget it. Provide it + document the usage rule; wiring existing 19 hand-
  scoped queries through it is incremental (later waves as each domain is touched).
- Establish the **per-domain `index.ts` barrel convention** (doc + one example) — the
  barrel is the only cross-domain import surface (boundary rule 3).
- Add an **import-boundary lint rule** (eslint `no-restricted-imports` or
  dependency-cruiser) enforcing rules 1-4: `app/`+`components/` no business logic;
  `lib/<domain>` MUST NOT import `app/`/`components/`; cross-domain via barrel only;
  `lib/core` imports no domain. Start in **warn** mode if a hard fail would block existing
  violations; the final sweep (Wave 8) turns it to error + green.

## Acceptance criteria

- [ ] `lib/core/` exists with the [SYS20] sub-areas + barrels; build + typecheck green.
- [ ] Tenant-scope helper exported from `lib/core/db`, with a usage doc + ≥1 real call site.
- [ ] Import-boundary lint rule present + running in CI (warn or error); current tree has
      no NEW violations.
- [ ] Barrel convention documented (where new `lib/<domain>` code exposes its public API).
- [ ] No behavior change / no mass folder move (migration is incremental, per plan).

## Blocked by

- none

## User stories addressed

- [SYS20]/[SYS00] clean module seams + tenant-scope one-way door from day 1.
