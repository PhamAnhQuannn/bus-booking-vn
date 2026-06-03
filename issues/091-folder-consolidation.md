---
depends-on: [038-scaffold-lib-core-tenant-helper-lint]
type: CHORE
wave: 8
spec: [SYS20]
---

> ✅ **DONE 2026-06-03.** 7 atomic moves (commit-per-move, tsc-green each): manifest→booking,
> {buses,routes,pickupPoints}→catalog, payouts→ledger, notifications→notification, validation→core/validation,
> payment adapters→payment/adapters/{momo,stub}, db→core/db (343 import sites). ~450 import sites rewritten.
> `lib/stores` kept; `lib/api` assessed → kept (client fetch helpers). tsc 0, lint 0, 1408 unit pass,
> integration = pre-existing baseline (no new failures). Pure restructure, zero behavior change.

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS20] (final sweep — run last)

## What to build

Complete the incremental folder consolidation to the [SYS20] target tree. Earlier waves
migrated domains as they were touched; this sweep reconciles the remainder. **Run LAST** (after
all feature waves) to avoid churning files mid-build.

- `lib/buses` (+ `lib/routes` + `lib/pickupPoints` + overlap helpers) → `lib/catalog`.
- `lib/payouts` → `lib/ledger` (already partly there from Wave 1).
- `lib/db` → `lib/core/db` (prisma client, pooler, tenant-scope helper).
- `lib/notifications` (plural) → `lib/notification` (singular, spec naming).
- `lib/manifest` → folded into `lib/booking`.
- `lib/validation` → per-domain `types.ts`/schemas or `lib/core`.
- `lib/payment/*` adapters → `lib/payment/adapters/{momo,stub,…}` subdir.
- Keep `lib/stores` (client-only). Assess `lib/api` (client helpers vs `lib/core/http`).
- Update all imports; no behavior change. Migration is mechanical — verify with build +
  full test suite green after each move.

## Acceptance criteria

- [ ] `lib/` matches the [SYS20] target tree (catalog/ledger/core/db/notification/ticketing/
      storage/onboarding/charter/audit/analytics + payment/adapters).
- [ ] All imports updated; build + typecheck + full test suite green.
- [ ] No behavior change (pure restructure).

## Blocked by

- Blocked by `issues/038-scaffold-lib-core-tenant-helper-lint.md` (+ all feature waves done)

## User stories addressed

- [SYS20] consolidated domain modules; future service boundaries.
