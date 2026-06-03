-- Issue 089: checkout consent capture (no-refund + PII-storage).
--
-- One ConsentRecord row per consent the buyer accepted at booking-initiate time.
-- Two rows are written per booking inside the same booking-creation $transaction
-- (consentType = 'no_refund' and 'pii_storage'); see lib/db/bookingRepo.ts.
--
-- bookingId is @db.Uuid in the Prisma model (Booking.id is uuid) — the FK column
-- type matches. FK ON DELETE CASCADE: consent rows are meaningless without their
-- booking, and Booking deletes are an exceptional compensating path only.
--
-- APPEND-ONLY: ConsentRecord is a compliance artifact. Like AdminAuditLog (Issue
-- 062) and LedgerEntry (Issue 047), a BEFORE UPDATE trigger RAISEs so an existing
-- consent row can never be rewritten/tampered — immutability is role-independent
-- and assertable from the single pooled app role. The trigger is a Prisma-DSL-
-- invisible (SQL-only) object — schema.prisma is unchanged by it and schema<->DB
-- stay in parity (same exception class as the partial indices in Issue 007).
--
-- DELETE is intentionally NOT blocked: the gateway-failure compensating path in
-- lib/booking/initiateOnlineBooking.ts deletes the just-created Booking row, and
-- the ON DELETE CASCADE above must be free to remove the orphaned consent rows
-- (a consent has no subject once its booking is gone). A DELETE trigger here would
-- deadlock that compensating $transaction. Tamper-resistance is about UPDATE of a
-- live row, not lifecycle cascade — same stance the booking owns its consents.
--
-- Both @@index declarations (bookingId; consentType+version) are mirrored as plain
-- CREATE INDEX statements below so the DSL and the SQL agree (Issue 007 parity).

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "bookingId" UUID NOT NULL,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsentRecord_bookingId_idx" ON "ConsentRecord"("bookingId");

CREATE INDEX "ConsentRecord_consentType_version_idx" ON "ConsentRecord"("consentType", "version");

ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only immutability trigger (compliance). UPDATE of a live row RAISEs.
-- DELETE is left to the booking ON DELETE CASCADE (see header comment).
CREATE OR REPLACE FUNCTION "consent_record_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ConsentRecord is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "consent_record_no_update" BEFORE UPDATE ON "ConsentRecord"
  FOR EACH ROW EXECUTE FUNCTION "consent_record_immutable"();
