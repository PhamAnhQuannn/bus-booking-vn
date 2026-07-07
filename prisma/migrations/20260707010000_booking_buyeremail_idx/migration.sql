-- PR 259: index buyerEmail to support register-time guest-booking backfill scan
-- (match Booking.buyerEmail → Customer.email, set Booking.customerId).
-- Mirrors existing Booking_buyerPhone_idx from Issue 009.
CREATE INDEX "Booking_buyerEmail_idx" ON "Booking"("buyerEmail");
