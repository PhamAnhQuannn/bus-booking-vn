-- Down migration for issue_004_payment_event
-- Drops the PaymentEvent table and removes the back-relation from Booking.
DROP TABLE IF EXISTS "PaymentEvent" CASCADE;
