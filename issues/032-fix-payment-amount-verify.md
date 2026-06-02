---
depends-on: []
type: FIX
wave: 0
spec: [S12, SYS06]
---

> ✅ **DONE 2026-06-01 (commit `8089cb0`).** Amount-verify guard pre-existed; added overpay-delta
> recording + over-amount test. 8/8 webhook tests green.

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S12] / [SYS06]

## What to build

Close the **live money-loss P1**: an underpaid/short MoMo IPN carrying a success
`resultCode` is accepted as fully paid. `lib/payment/processWebhook.ts` fetches the
booking (≈line 97, `booking.totalVnd`) but **never compares it** to the IPN `amount`,
and never checks currency.

- In `processWebhook.ts`, before transitioning the booking to paid, **verify
  `ipn.amount >= booking.totalVnd`** (VND integer compare). A short payment must NOT
  mark the booking paid — leave it `awaiting_payment` and record the event for recon
  (Wave 0 issue 037 / recon sweeper later).
- Overpayment (`ipn.amount > booking.totalVnd`) marks paid AND flags the difference for
  refund-out (refund-out rail lands in the Ledger wave — here just record the overpay
  delta on the PaymentEvent / log; do NOT silently keep it).
- Spec invariant ([S12]): "matched by orderRef + amount/currency verified server-side;
  short/wrong payments rejected." This issue does the **amount** half; currency-field +
  verify is issue 033.

## Acceptance criteria

- [ ] An IPN with `amount < booking.totalVnd` + success resultCode does NOT transition
      the booking to paid; booking stays `awaiting_payment`.
- [ ] An IPN with `amount == booking.totalVnd` + success transitions to paid (happy path
      unchanged).
- [ ] An IPN with `amount > booking.totalVnd` transitions to paid AND records the overpay
      delta (no silent acceptance).
- [ ] Unit test in `lib/payment/__tests__/` covers short / exact / over amounts.
- [ ] No regression in monotonic transition (replayed pending can't regress a paid row).

## Blocked by

- none (uses existing `Booking.totalVnd`)

## User stories addressed

- [S12] As platform, payment matched by orderRef + amount verified server-side so
  short/wrong payments are rejected.
