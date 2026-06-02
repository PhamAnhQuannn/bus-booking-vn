---
depends-on: [091-folder-consolidation]
type: CHORE
wave: 8
spec: [SYS20, SYS18]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS20] / [SYS18] (final sweep)

## What to build

Introduce the `app/(customer)` route group so the customer realm is segmented to match the
[SYS20] target `app/` layout (operator `op/` + admin `admin/` segments already exist from
earlier waves).

- Move customer pages (`page.tsx`, `search/`, `trips/[id]/`, `booking/{customer,review}/`,
  `account/`, `charter`/`lien-he-dat-xe`, `auth/`) under `app/(customer)/`. Route group `()`
  = no URL change (paths stay the same).
- Verify all links, redirects, and the middleware path matchers still resolve (route-group
  parens don't affect the URL but do affect file paths / matchers).
- Keep `app/` thin (no business logic; in-process lib calls; no self-fetch — boundary rule 1).

## Acceptance criteria

- [ ] Customer pages live under `app/(customer)/`; URLs unchanged.
- [ ] Links/redirects/middleware matchers still resolve (no 404 regressions).
- [ ] `app/` realm layout matches the SYS20 target (customer/op/admin segments).
- [ ] Build + e2e smoke green.

## Blocked by

- Blocked by `issues/091-folder-consolidation.md`

## User stories addressed

- [SYS20]/[SYS18] app/ segmented by routing realm (customer/operator/admin).
