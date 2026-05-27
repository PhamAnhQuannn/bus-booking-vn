-- Issue 009: index buyerPhone to support register-time guest-booking backfill scan
-- (match Booking.buyerPhone → Customer.phone, set Booking.customerId).
CREATE INDEX "Booking_buyerPhone_idx" ON "Booking"("buyerPhone");
