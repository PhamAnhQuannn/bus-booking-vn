---
depends-on: [074-async-pdf-s3, 058-notification-dispatcher-stub]
type: FEATURE
wave: 4
spec: [S06, SYS08, S15-4]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S06] / [SYS08] (S15#4)

## What to build

Close the **reassign → regenerate/invalidate PDF + notify** gap. `lib/trips/reassignBus.ts:101-117`
updates `busId` (overlap + capacity + lock now correct) but does NOT regenerate the ticket PDF
and does NOT notify customers of the new plate — half the S06 AC. S15#4 default = yes, notify
+ regenerate.

- On reassign, **invalidate** the stored PDF key + enqueue a **regenerate** job (issue 074
  pipeline) so the snapshot reflects the new plate; the public verify page (issue 072) is
  already live-correct.
- Enqueue a customer **notification** (issue 058) of the new plate for each affected paid
  booking.
- Idempotent / safe under the existing reassign transaction (don't block the reassign on the
  async work — enqueue, return fast).

## Acceptance criteria

- [ ] Reassign invalidates the old PDF key + enqueues a regenerate job (new plate).
- [ ] Each affected paid booking gets a new-plate notification enqueued.
- [ ] Reassign returns fast (async work enqueued, not inline).
- [ ] Public verify page already shows the new plate (regression check).
- [ ] Integration test: reassign → PDF key changes + notifications enqueued.

## Blocked by

- Blocked by `issues/074-async-pdf-s3.md`, `issues/058-notification-dispatcher-stub.md`

## User stories addressed

- [S06] reassign → invalidate+regenerate ticket PDF + notify customers of new plate (S15#4).
