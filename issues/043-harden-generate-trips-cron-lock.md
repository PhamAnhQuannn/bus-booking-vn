---
depends-on: []
type: FIX
wave: 0.5
spec: [SYS10, S06]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS10] (recurrence = keep + harden, S15 item 5)

## What to build

Harden the `generate-trips` cron to match the other 5 crons. `app/api/cron/generate-trips/route.ts:29`
calls `generateTripsFromTemplates()` directly — **no `runJob`/advisory lock, no JobRunLog** —
so two ticks can race (mitigated only by per-row idempotency). [SYS10]: every cron runs
under a run-lock so a slow sweep doesn't double-run against the next tick.

- Wrap the generation in the existing `runJob` + `withAdvisoryLock` machinery
  (`lib/jobs/withAdvisoryLock.ts`, `lib/jobs/runJob.ts`) like the other crons (sweep-holds,
  sendReminders, processPayouts, autoCloseSales, autoCompleteTrips).
- Emit a `JobRunLog` row per run (at-least-once + idempotent).
- Keep per-row idempotency as defense-in-depth.

## Acceptance criteria

- [ ] `generate-trips` runs under `runJob` + advisory lock; a concurrent second tick
      returns `skipped_locked` (test).
- [ ] One `JobRunLog` row written per run.
- [ ] Recurrence generation behavior otherwise unchanged (idempotent per template/date).

## Blocked by

- none

## User stories addressed

- [SYS10] cron run-overlap lock; recurrence engine kept + hardened (S15#5).
