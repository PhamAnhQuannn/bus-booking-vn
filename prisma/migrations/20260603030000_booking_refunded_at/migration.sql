-- Issue 100: add refundedAt column + composite index on Booking.
-- Predicate column for the oversold-race terminal state (Issue 014 rule: verb-At + status in same tx).
-- Index supports future cron/reporting queries on refunded bookings.
ALTER TABLE "Booking" ADD COLUMN "refundedAt" TIMESTAMPTZ;

CREATE INDEX "Booking_status_refundedAt_idx" ON "Booking"("status", "refundedAt");
