# 13 -- Cash-at-Boarding Operator Confirmation Flow

## Status: DONE

## What changed

Implemented the cash-at-boarding booking flow for Phase 1 operators.

### Schema

- Migration `20260621010000`: adds `cash` and `bank_transfer` to `PaymentMethod` enum
- `bank_transfer` included for WT-03 (SePay/VietQR) future use

### Service: `lib/booking/createCashBooking.ts`

- Operator creates a walk-up booking directly (no hold needed)
- `paymentMethod: 'cash'`, `status: 'paid'`, `isManual: true`
- Capacity check under `SELECT FOR UPDATE` on Trip (Issue 011 TOCTOU rule)
- Price derived from `Trip.price × ticketCount` (I7-exempt: operator is price authority)
- Ledger entries (`booking_credit` + `platform_fee`) written in same transaction
- Idempotent on bookingRef (retry on P2002 collision, up to 5 attempts)
- Error codes: `trip_not_found`, `trip_not_bookable`, `insufficient_capacity`

### API: `POST /api/op/bookings/cash`

- Auth: `requireOperatorAuth` (operator JWT, operatorId from claims)
- Body: `{ tripId, buyerName, buyerPhone, buyerEmail?, ticketCount }`
- Zod validation on all inputs
- Returns 201 with booking on success
- Error mapping: 404 (not found), 422 (not bookable / insufficient capacity)

### Type updates

- `BookingDto.paymentMethod`: added `'vnpay' | 'cash' | 'bank_transfer'`
- `BookingRow.paymentMethod`: same extension
- Barrel export from `lib/booking/index.ts`

### Test: `lib/booking/__tests__/createCashBooking.test.ts`

5 tests covering:
- Happy path: booking created with correct fields + ledger entries
- Trip not found (missing or wrong operator)
- Trip not bookable (cancelled / salesClosed / departed)
- Insufficient capacity

## Files

- `prisma/migrations/20260621010000_add_cash_bank_transfer_payment_methods/migration.sql` — new
- `prisma/schema.prisma` — PaymentMethod enum extended
- `lib/booking/createCashBooking.ts` — new service
- `lib/booking/bookingDto.ts` — type widened
- `lib/booking/bookingRepo.ts` — type widened
- `lib/booking/index.ts` — barrel export
- `app/api/op/bookings/cash/route.ts` — new API route
- `lib/booking/__tests__/createCashBooking.test.ts` — new unit test

## GL-006 checklist

Satisfies: `- [x] Cash-at-boarding flow working (operator confirms on console)`
