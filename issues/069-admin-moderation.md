---
depends-on: [056-admin-middleware-segment]
type: FEATURE
wave: 3
spec: [S11, SYS13]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S11] (Moderation tab)

## What to build

Admin **Moderation** tab — disable (NOT edit) bad trips/routes, review flagged content/
reports. Posture: moderate = disable, never edit operator catalog for them ([S11] OUT).

- Disable a trip/route (sets a disabled flag / pulls from search — reuse the existing
  disable posture from `disableOperator` precedent; never mutate operator catalog fields).
- Surface flagged content / reports queue (model the flag if absent — minimal).
- Audit-logged; step-up not required (moderation is lower-privilege than money) but role-gated
  (support+).

## Acceptance criteria

- [ ] Admin can disable a trip/route (hidden from search) without editing its content.
- [ ] Flagged-content/reports queue visible.
- [ ] Actions audit-logged; role-gated.
- [ ] No path to edit operator catalog data (moderate = disable only).

## Blocked by

- Blocked by `issues/056-admin-middleware-segment.md`

## User stories addressed

- [S11] admin Moderation: disable bad trips/routes; flagged content. Moderate, don't edit.
