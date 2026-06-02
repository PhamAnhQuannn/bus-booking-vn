---
depends-on: [051-refund-out-rail, 036-oversell-for-update-at-sell]
type: FEATURE
wave: 1
spec: [SYS05, SYS06]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS05] / [SYS06]

## What to build

The **hold-lapses-mid-payment** edge case. [SYS05]: "hold TTL > max PSP confirm window +
re-validate/extend at initiate; on webhook-paid honor seat if still free; **refund-out** (SYS06) if
genuinely gone (rare)." Today the sell path doesn't handle a paid webhook arriving after the hold
lapsed and the seat was taken — it can silently fail to seat a paid customer.

- At `initiate`, re-validate/extend the hold so its TTL exceeds the max PSP confirm window (~15 min)
  before handing off to the PSP.
- At webhook-paid (in the sell path that issue 036 hardens with `SELECT … FOR UPDATE`):
  - hold still active / seat free → seat the booking (current happy path);
  - hold lapsed AND seat genuinely gone (oversold-race) → trigger **refund-out** via the rail from
    issue 051, with its own idempotency key (distinct from the inbound payment) — never silently
    drop the paid customer.

## Acceptance criteria

- [ ] Paid webhook with hold still free → booking seated (unchanged).
- [ ] Paid webhook with hold lapsed + seat gone → a `refund_out` is issued (idempotent), booking
      not left in a paid-but-no-seat limbo.
- [ ] Hold TTL is validated/extended at initiate to exceed the PSP confirm window.
- [ ] Integration test forces the lapse (expire the hold, fill the seat, then deliver paid IPN) and
      asserts the refund-out path.

## Blocked by

- Blocked by `issues/051-refund-out-rail.md` (the PSP refund + `refund_out` ledger entry).
- Blocked by `issues/036-oversell-for-update-at-sell.md` (the locked sell path this hooks into).

## User stories addressed

- [SYS05]/[SYS06] As traveler, if my seat is genuinely gone when payment confirms, I'm refunded
  rather than charged for a seat I can't get.
