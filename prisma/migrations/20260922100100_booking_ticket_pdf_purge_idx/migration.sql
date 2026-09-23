-- PDPL retention (W3): partial index backing the ticket-PDF purge sweeper's claim.
-- A booking whose guest PII snapshot was scrubbed (snapshotAnonymizedAt IS NOT NULL)
-- may still hold a rendered ticket PDF in object storage that bakes buyerName/buyerPhone
-- (see lib/jobs/generateTicketPdfs.ts). The sweep purges that object and NULLs the key.
-- PARTIAL/WHERE index => SQL-only (Prisma DSL cannot express it); intentionally not @@index.
CREATE INDEX "Booking_pdf_purge_pending_idx"
  ON "Booking" ("snapshotAnonymizedAt")
  WHERE "ticketPdfKey" IS NOT NULL AND "snapshotAnonymizedAt" IS NOT NULL;
