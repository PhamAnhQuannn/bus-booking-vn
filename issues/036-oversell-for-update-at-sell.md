---
depends-on: []
type: FIX
wave: 0
spec: [SYS05, S03]
priority: P3
---

> 🔎 **Reality-check 2026-06-01: DOWNGRADED P1→P3 (defense-in-depth, NOT a live bug).**
> The oversell vector is already closed at HOLD CREATION (`lib/db/holdRepo.ts` — advisory lock +
> capacity check). At sell, `createOnlineBookingFromHold` (`bookingRepo.ts:222-282`) only converts
> already-held seats to paid via `ON CONFLICT (holdId)` + active-hold WHERE guard — it adds NO new
> seats, so it cannot oversell. The spec's FOR-UPDATE-at-sell is belt-and-suspenders. Keep as
> optional hardening; do NOT block Wave 0 on it. (Still worth the concurrent-write test.)

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS05] / [S03]

## What to build

Close the **sell-side oversell window**. `lib/db/bookingRepo.ts:211-299`
(`createOnlineBookingFromHold`) converts hold→booking via `ON CONFLICT (holdId)` +
WHERE-EXISTS eligibility, but with **no `SELECT … FOR UPDATE` on the Trip row and no
available-capacity re-check at sell time**. Capacity is validated only at hold creation
(advisory lock). Spec [SYS05]: seat-sell runs in `$transaction` + `SELECT … FOR UPDATE`
on the trip row → the second concurrent buyer sees `available = 0` and gets a clean
reject; the hold transitions `active → consumed` atomically in the same txn.

- Wrap the sell in `prisma.$transaction` (callback form) with `SELECT … FOR UPDATE` on
  the Trip (and/or the gating row) so concurrent sells serialize.
- Re-compute `available = capacity − Σ paid − Σ active-held` inside the lock and reject if
  `< seatCount` (clean error, no partial write).
- Transition the Hold to consumed atomically in the same txn (note: enum value is
  `converted` today; the rename to `consumed` is Wave 7 — keep `converted` here).
- Add a **concurrent-write integration test** (two sells racing the last seat → exactly
  one succeeds), per Mistake-Log Issue 011 rule (happy-path test alone won't exercise the
  lock).

## Acceptance criteria

- [ ] Two concurrent sells for the last seat → exactly one booking created, the other
      cleanly rejected (integration test with real txns).
- [ ] Sell runs inside `$transaction` with `SELECT … FOR UPDATE` on the trip row.
- [ ] Available re-checked at sell time (not only at hold creation).
- [ ] Hold → consumed (`converted`) in the same txn as the paid Booking insert; abort
      leaves the hold active (no oversell).
- [ ] Happy-path single sell unchanged.

## Blocked by

- none

## User stories addressed

- [SYS05] 2 concurrent buyers, last seat → serialize via FOR UPDATE; never oversell.
