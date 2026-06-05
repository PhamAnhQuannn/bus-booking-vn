-- Issue 042: capture + store buyer email (S03/S04 guest snapshot = name+phone+email).
-- Both columns nullable so pre-042 rows tolerate NULL; the form makes email required
-- for NEW bookings only. Email threads Hold.customerEmail → Booking.buyerEmail.
ALTER TABLE "Hold" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN "buyerEmail" TEXT;
