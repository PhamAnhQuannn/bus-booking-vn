---
depends-on: []
type: FIX
wave: 0
spec: [S13, S08, S15-5]
---

> 🔎 **Reality-check 2026-06-01: CONFIRMED REAL + TRIVIAL.** `lib/trips/completeTripCore.ts:28`
> `THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000`; `scheduledFor = now + THREE_DAYS_MS` (line 89) feeds
> both the `payout_scheduled` NotificationLog (line 114) and the `Payout.scheduledAt` (line 135).
> One-line constant change → `ONE_DAY_MS` + update any T+3 test assertion. Quick win.

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S13] / [S08] (S15#5 ratified)

## What to build

Change the payout settlement delay from **T+3 to T+1** per S15#5. `completeTripCore.ts:28,89`
hard-codes `THREE_DAYS_MS`; the dispute/chargeback buffer should be one day.

- Replace `THREE_DAYS_MS` with `ONE_DAY_MS` in `lib/trips/completeTripCore.ts` (and any
  shared constant module it lives in). `scheduledFor = completedAt + 1 day`.
- Update any test/fixture asserting the T+3 window (grep `THREE_DAYS` + `scheduledFor`
  assertions in `lib/**/__tests__`, `lib/jobs/__tests__`).
- Leave a `// TODO(ledger):` note that this constant promotes to a FeeConfig-style
  platform setting when the ledger lands (Wave 1 issue 048-054) — do NOT build the config
  here.

## Acceptance criteria

- [ ] Trip completion schedules payout at `completedAt + 1 day` (was +3).
- [ ] No `THREE_DAYS_MS` reference remains in the payout path.
- [ ] Existing payout/settlement tests updated to the T+1 window and green.
- [ ] `@@index([template, scheduledFor])` predicate still satisfied (no schema change).

## Blocked by

- none

## User stories addressed

- [S13]/[S08] money AVAILABLE at trip completion + T+1 settlement delay.
