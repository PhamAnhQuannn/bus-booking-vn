---
depends-on: [043-harden-generate-trips-cron-lock]
type: FEATURE
wave: 2
spec: [SYS09, S14, S03, S04, S05]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS09] / [S14]

## What to build

The **notification dispatcher** (worker/cron + retry) + `NOTIFY_STUB` flag + email channel.
Today rows are enqueued (`NotificationLog`, status pending) but **no worker/cron picks up
pending/failed rows** — dispatch is fire-once in `afterFn` with no retry; email never sent.

- A dispatch cron under `app/api/cron/**` (run-locked per SYS10) that selects pending/failed
  `NotificationLog` rows (using `scheduledFor` + status), dispatches via the channel adapter,
  and retries failed rows with backoff (bounded attempts).
- **Idempotent per `(bookingId, template)`** — add the unique constraint (spec [SYS09]) so a
  re-run can't double-send; the dispatcher claims rows safely (FOR UPDATE SKIP LOCKED).
- Add the **email channel** (channel = email) alongside SMS; both go through the same enqueue
  + dispatch path. Real provider deferred — gated by `NOTIFY_STUB` (parallel to
  `PAYMENTS_STUB`): stub logs/records instead of sending. Add `NOTIFY_STUB` to `lib/config/env.ts`.
- **Decoupled from booking state** ([S14]/#12): a delivery failure updates only
  `NotificationLog`, never the booking `paid` state.
- Migrate the existing in-process `after()` sends to enqueue-only (dispatcher delivers).

## Acceptance criteria

- [ ] Dispatch cron (run-locked) delivers pending rows + retries failed with bounded backoff.
- [ ] Unique `(bookingId, template)` constraint; re-run does not double-send.
- [ ] Email channel exists; SMS + email both flow through enqueue→dispatch.
- [ ] `NOTIFY_STUB` flag in env (zod-validated); stub records instead of sending.
- [ ] Delivery failure touches only NotificationLog, never booking paid state (test).

## Blocked by

- Blocked by `issues/043-harden-generate-trips-cron-lock.md` (cron run-lock pattern)

## User stories addressed

- [SYS09]/[S14] async queued notifications with retry; NOTIFY_STUB; delivery decoupled from
  money state.
