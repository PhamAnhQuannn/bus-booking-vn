---
depends-on: []
type: FEATURE
wave: 3
spec: [SYS16, S11, S02]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS16] / [S11]

## What to build

Complete the analytics business layer + admin consumer. Today events are wired
(`FunnelEvent`, `track.ts`) but there's **no GMV metric** and **no admin console consumer**
(`getFunnel.ts` exists, unused). Spec [SYS16]: fire-and-forget events (incl. GMV) → admin
business metrics.

- Add a **GMV** metric/event (gross booking value) + revenue aggregate (platform fee SUM
  from ledger, issue 049). Keep emit fire-and-forget, non-blocking (existing `track.ts`
  posture, gated on `bb_sid`).
- Aggregate queries for the admin Overview (issue 064): total customers/operators, GMV,
  bookings, revenue, funnel (search→hold→payment→paid). Build on `getFunnel.ts`.
- Ensure the full funnel is wired (search_performed + booking_paid exist; add
  hold_created/payment_initiated if missing).

## Acceptance criteria

- [ ] GMV + revenue aggregates computed (revenue from ledger platform_fee SUM).
- [ ] Admin aggregate queries return customers/operators/GMV/bookings/revenue/funnel.
- [ ] Funnel events complete (search→hold→payment_initiated→paid).
- [ ] Emit stays fire-and-forget, non-blocking.
- [ ] Consumed by admin Overview (issue 064).

## Blocked by

- none (analytics aggregates; consumed by issue 064)

## User stories addressed

- [SYS16]/[S11] business metrics + GMV + funnels for the admin overview.
