---
depends-on: [056-admin-middleware-segment, 063-analytics-admin-consumer]
type: FEATURE
wave: 3
spec: [S11, SYS16]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S11] (Overview tab)

## What to build

Admin **Overview** page — action queue + business metrics + failure alerts. First of the
7-tab admin console (nav: Overview · Approvals · Users · Operators · Finance · Moderation ·
System).

- Action queue: pending operator approvals, open disputes/chargebacks, failed payouts.
- Business metrics: total customers/operators, GMV, bookings, revenue (from the analytics
  consumer, issue 063).
- Failure alerts: payment-webhook / payout / SMS-email failures.
- Infra health **links out** to Sentry/Datadog — NOT rebuilt here (per [S11]).
- Admin-realm guarded (issue 056); role-aware (super-admin/finance/support see appropriate
  slices). RSC, in-process lib calls (no self-fetch).

## Acceptance criteria

- [ ] Overview renders action queue (approvals/disputes/failed payouts) with live counts.
- [ ] Business metrics (customers/operators/GMV/bookings/revenue) shown from analytics.
- [ ] Failure-alert section surfaces payment/payout/notification failures.
- [ ] Infra health links out (not rebuilt).
- [ ] Page behind admin auth; role-aware visibility.

## Blocked by

- Blocked by `issues/056-admin-middleware-segment.md`,
  `issues/063-analytics-admin-consumer.md`

## User stories addressed

- [S11] admin Overview: action queue + metrics + failure alerts.
