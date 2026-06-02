---
depends-on: []
type: FEATURE
wave: 0.5
spec: [SYS05, S03]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS05] / [S03]

## What to build

**Per-IP + per-customer concurrent-hold cap** (inventory-DoS guard). The S15#16 decision is
ratified and `rebuild-plan.md` marks it RESOLVED, but neither an issue nor the code exists.
`app/api/holds/route.ts` has only a per-IP request rate-limit — nothing caps the number of
simultaneous ACTIVE holds one actor can open, so a single actor can hold a whole trip for the TTL.

- In `app/api/holds/route.ts`, before creating a hold, count the caller's **ACTIVE non-expired**
  holds by IP and (when signed in) by `customerId`; reject `429` over a cap (constant, e.g. 5).
- Distinct from: the existing per-IP request rate-limit (request frequency) and the oversell race
  (issue 002, capacity per trip). This caps simultaneous live reservations per actor.
- Expired/consumed/converted holds do not count toward the cap.

## Acceptance criteria

- [ ] One actor (IP or customerId) cannot hold more than the cap of simultaneous active holds;
      the over-cap request gets `429`.
- [ ] Expired holds don't count — after TTL lapses, the actor can hold again.
- [ ] A normal single-checkout flow (1 hold) is unaffected.
- [ ] Integration test: N+1 parallel hold requests from one actor → cap succeed, rest `429`.

## Blocked by

- none.

## User stories addressed

- [SYS05] As platform, a concurrent-hold cap stops one actor from reserving a whole trip's
  inventory for the hold TTL (inventory DoS).
