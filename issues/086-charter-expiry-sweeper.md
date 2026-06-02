---
depends-on: [085-charter-admin-dispatch, 084-charter-public-pool-claim, 043-harden-generate-trips-cron-lock]
type: FEATURE
wave: 6
spec: [S18, SYS19, SYS10]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S18] / [SYS19]

## What to build

The **charter expiry sweeper** — stale assignments + unclaimed published requests return to
admin so nothing stalls.

- Cron under `app/api/cron/**` (run-locked per SYS10 / issue 043 pattern):
  - `ASSIGNED_DIRECT` past `acceptByAt` (default 24h, no accept) → ADMIN_REVIEW.
  - `PUBLISHED` past `claimByAt` (default 48h, unclaimed) → EXPIRED → ADMIN_REVIEW.
- Predicate columns (`acceptByAt`, `claimByAt`) are **top-level indexed** (per Mistake-Log
  Issue 014 — never a JSON key); add `@@index` for the sweeper predicate.
- Notifications on auto-return (issue 058); audit-logged.

## Acceptance criteria

- [ ] Sweeper returns timed-out ASSIGNED_DIRECT (>24h) + unclaimed PUBLISHED (>48h) to
      ADMIN_REVIEW.
- [ ] Runs under run-lock (concurrent tick → skipped_locked); JobRunLog row per run.
- [ ] Predicate columns top-level + indexed.
- [ ] Auto-return notifications + audit entries written.
- [ ] Integration test: seed a stale assignment + expired publish → sweeper reroutes both.

## Blocked by

- Blocked by `issues/085-charter-admin-dispatch.md`,
  `issues/084-charter-public-pool-claim.md`,
  `issues/043-harden-generate-trips-cron-lock.md`

## User stories addressed

- [S18] published-unclaimed EXPIRE → admin; assigned-no-response → admin; nothing stalls.
