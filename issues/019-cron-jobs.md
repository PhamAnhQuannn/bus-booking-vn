---
depends-on: [014-operator-booking-queue-manifest, 016-operator-revenue-csv-payout]
type: AFK
---

## Parent PRD

`issues/prd.md`

## What to build

Background jobs that keep the system honest: expired-hold sweeper, sales auto-close + trip auto-complete, 24h customer SMS reminder, and T+3 payout processor. Single in-process scheduler (node-cron) in V1 — no external queue. Each job is idempotent.

- **Hold expiry sweeper** — runs every 30s. Marks `Hold.status = expired` where `expiresAt < now() AND status = active`. Decrements `Trip.activeHolds` atomically. Supports S2 release semantics; no SMS.
- **Sales auto-close** — runs every 60s. Sets `Trip.salesOpen = false` where `departureAt <= now() AND salesOpen = true`. Supports S13.
- **Trip auto-complete** — runs every 5 min. Trips with `departureAt + estimatedDuration < now() AND status = departed` → `completed`. Triggers payout-row creation (status `pending`).
- **24h SMS reminder** — runs every 15 min. For paid bookings where `departureAt` is within next [23h, 25h] window and `reminderSentAt IS NULL`: dispatches reminder SMS via NotificationModule (`bookingReminder24h` template), sets `reminderSentAt = now()`. Window prevents duplicate sends across runs.
- **Payout processor** — runs hourly. For payouts where `status = pending AND scheduledAt <= now()` (set to `tripCompletedAt + 3d` by trip-auto-complete): transitions to `processing`, runs `PayoutModule.calcPayout`, persists `{gross, fee, net}`, attempts settlement (stubbed bank transfer in V1 — just transitions to `settled` after a fake delay or `failed` with reason on injected error). Manual-retry hook in S16 reuses this path.
- All jobs log run start / end / row counts to NotificationLog-adjacent `JobRunLog` table for ops visibility.
- Concurrency guard: per-job advisory lock (`pg_try_advisory_lock`) so a horizontally-scaled deployment (V1.x) does not double-run.

## Acceptance criteria

- [ ] Hold expiry sweeper releases capacity within 30s of `expiresAt`; integration test asserts seat becomes bookable again.
- [ ] Trip whose `departureAt` is in the past has `salesOpen = false` within 60s.
- [ ] Trip marked departed and 5min past its expected end transitions to `completed`; a `Payout` row appears with `scheduledAt = completedAt + 3d`.
- [ ] 24h reminder fires exactly once per booking; `reminderSentAt` prevents re-send; assert via NotificationLog.
- [ ] Payout processor moves `pending → processing → settled` for a happy path and `pending → processing → failed` on injected adapter error.
- [ ] Two concurrent scheduler instances do not double-process; advisory lock test confirms.

## Blocked by

- Blocked by `issues/014-operator-booking-queue-manifest.md`
- Blocked by `issues/016-operator-revenue-csv-payout.md`

## User stories addressed

- User story 67
- Supports user story 2 (hold release path)
- Supports user story 13 (sales auto-close)
- Supports user story 16 (24h reminder)
- Supports user story 58 (payout settlement)
