-- Issue 074: async ticket PDF → object storage, generate-once.
-- The generate-once cron claims PAID bookings WHERE "ticketPdfKey" IS NULL, renders the
-- ticket PDF (with QR), uploads it via putObject, then sets the key + timestamp atomically.
-- A re-run skips already-keyed rows (render-once idempotency).
ALTER TABLE "Booking" ADD COLUMN "ticketPdfKey" TEXT;
ALTER TABLE "Booking" ADD COLUMN "ticketPdfGeneratedAt" TIMESTAMP(3);
