---
depends-on: []
type: CHORE
wave: 0.5
spec: [S03, S07, S15-1]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S03] / [S07] (S15 ratified item 1)

## What to build

**Cash deletion Phase A** — kill the cash / call-to-confirm creation paths (online-only is
the target). Phase A removes code + wiring only; the enum/column DROPS are **Phase B**
(Wave 7, after a live-row check) — do NOT drop enums/columns here.

Remove (per [S03]/[S07] EXTRA-DELETE list in `rebuild-mismatches.md`):
- `cash` from the customer initiate route (`app/api/bookings/initiate/route.ts:33,81-106`)
  and the `paymentMethod` request schema.
- `ReviewClient.tsx:58-65` cash default + "Tiền mặt" radio → default an online rail; drop
  the cash option from the UI.
- `lib/booking/initiateBooking.ts` `initiateCashBooking` orchestrator.
- `lib/db/bookingRepo.ts:96-194` `createCashBookingFromHold`.
- The 4 operator cash/phone-workflow routes + libs: `cash-collected/**` +
  `recordCashCollected.ts`, `call-outcome/**` + `recordCallOutcome.ts`, `picked-up/**` +
  `markPickedUp.ts`, `escalation/**` + `recordEscalation.ts`.
- `lib/booking/createManualBooking.ts` + `app/api/op/trips/[id]/manual-booking/**`.

Leave intact (Phase B will drop): `PaymentMethod='cash'`, `BookingStatus='pending_cash_payment'`,
`ContactStatus`, `pickedUpAt`/`escalationNote`/`escalatedAt` columns. Guard any remaining
READ-side branch so the dead enum values don't crash until dropped.

Update tests: delete cash/manual-booking unit+int+e2e specs (003, 015 era) or convert to
assert the path is gone. Grep `createCashBooking`, `initiateCashBooking`, `manual-booking`,
`cash-collected` across `app/**`, `lib/**`, `e2e/**`.

## Acceptance criteria

- [ ] Customer initiate route rejects / no longer accepts `paymentMethod: 'cash'`.
- [ ] Checkout UI offers only online rail(s); no cash default.
- [ ] `initiateCashBooking`, `createCashBookingFromHold`, `createManualBooking` and the 4
      operator workflow routes/libs are deleted; no import references remain (grep clean).
- [ ] Build + typecheck + test suite green (cash specs removed/converted).
- [ ] Enum/column values NOT dropped (deferred to Wave 7); remaining reads don't crash.

## Blocked by

- none

## User stories addressed

- [S03] Online only — no cash; pay-later out of app scope.
