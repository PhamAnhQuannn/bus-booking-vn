-- Issue 090: retention policy job — guest PII + KYB doc predicate columns + indices.
--
-- Two predicate/idempotency columns (Issue 014: the sweep WHERE-clause field must be
-- a top-level indexed column, never a JSON-payload key) plus their cheap predicate
-- indices. Both indices are non-partial single-column, so per Issue 007 they are ALSO
-- declared as @@index in schema.prisma (DSL ↔ SQL parity).

-- Booking.snapshotAnonymizedAt — non-null = guest PII snapshot scrubbed to masked
-- placeholders. The retention sweeper claims guest bookings WHERE customerId IS NULL
-- AND snapshotAnonymizedAt IS NULL AND the joined Trip departed past the window.
ALTER TABLE "Booking" ADD COLUMN "snapshotAnonymizedAt" TIMESTAMP(3);

-- KybDocument.purgedAt — non-null = backing storage object purged. The sweeper claims
-- docs WHERE purgedAt IS NULL AND owning operator REJECTED/SUSPENDED AND past window.
ALTER TABLE "KybDocument" ADD COLUMN "purgedAt" TIMESTAMP(3);

CREATE INDEX "Booking_snapshotAnonymizedAt_idx" ON "Booking"("snapshotAnonymizedAt");
CREATE INDEX "KybDocument_purgedAt_idx" ON "KybDocument"("purgedAt");
