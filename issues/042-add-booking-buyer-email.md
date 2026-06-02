---
depends-on: []
type: FEATURE
wave: 0.5
spec: [S03, S04, S15-8]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S03] (S15 ratified item 8)

## What to build

Add `Booking.buyerEmail` now — unblocks the SYS08 email-PDF delivery and avoids a second
Booking migration later. [S03] says the buyer enters **name + phone + email**; today the
form (`CustomerForm.tsx:29-52`) collects only name+phone and `Booking` has no email column
(`schema:212-213`).

- Add `buyerEmail String?` (nullable) to the `Booking` model + migration (declare in BOTH
  schema.prisma and SQL).
- Add the email field to `app/booking/customer/CustomerForm.tsx` + its validation schema
  (`lib/validation/hold.ts` or the buyer-info schema) — optional or required per [S03]
  (recommend required for ticket delivery; confirm in AC).
- Thread `buyerEmail` through hold/initiate → `createOnlineBookingFromHold` INSERT (guest
  snapshot stores name/phone/email per [S04]).
- Email *delivery* stays a later issue (Wave 2 notification + Wave 4 ticketing) — this only
  captures + stores the field.
- Normalize/trim; do NOT add PII to logs (extend redaction if email is logged anywhere).

## Acceptance criteria

- [ ] `Booking.buyerEmail` column exists (migration in schema.prisma + SQL).
- [ ] Checkout form collects email + validates format; value persists to the booking.
- [ ] Guest snapshot now carries name + phone + email.
- [ ] Existing bookings without email tolerate null (no read crash).
- [ ] Email is not leaked in structured logs.

## Blocked by

- none

## User stories addressed

- [S03] As traveler, enter buyer name + phone + email so the operator can reach me + I get
  my ticket.
