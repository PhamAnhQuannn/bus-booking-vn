---
depends-on: [014-operator-booking-queue-manifest]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Operator revenue reporting (per trip / date range), CSV export, and per-trip payout status view. Introduces the `PayoutModule` pure-function calculator (6% platform fee, half-even rounding) and the `Payout` row state machine.

- Prisma `Payout` model per PRD § Schema.
- `PayoutModule` (deep): pure-function `calcPayout({ grossPaidBookings, platformFeePct: 0.06 }) → { gross, fee, net }`; state machine `pending → processing → settled | failed`; manual-retry hook.
- `GET /api/op/reports/revenue?dateFrom&dateTo&routeId?` — excludes `trip_cancelled / payment_failed_expired / cancelled` bookings; returns per-trip rows with gross / fee / net.
- `GET /api/op/reports/revenue.csv?...` — same data as CSV: bookingRef, route, departure, buyerName, buyerPhone, ticketCount, total, paymentMethod, status.
- `GET /api/op/reports/payouts` — per-trip payout status with `scheduledAt / settledAt / failureReason`.
- `POST /api/op/reports/payouts/:id/retry` — admin-triggered manual retry on a `failed` payout.
- `/op/reports/revenue`, `/op/reports/payouts` pages.

## Acceptance criteria

- [ ] Revenue report excludes cancelled / expired / trip-cancelled bookings.
- [ ] CSV export columns match PRD AC for story 57; opens cleanly in Excel + Google Sheets.
- [ ] `calcPayout` unit-test table: assorted gross values → expected net with 6% fee, half-even rounding precision verified to 0.01 VND (operate in integer minor units to avoid floats).
- [ ] Payout status visible per trip; failed retry button works and transitions to `processing`.
- [ ] Reports are scoped to the operator — no cross-operator leakage.

## Blocked by

- Blocked by `issues/014-operator-booking-queue-manifest.md`

## User stories addressed

- User story 56
- User story 57
- User story 58
