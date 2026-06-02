-- Issue 047: Append-only double-entry ledger (money one-way door). MONEY-CRITICAL.
--
-- This slice ships the MODEL + DB-enforced immutability + idempotency only.
-- Wiring entries into booking/payout flows lands in slices 049/050.

-- 1. Enum (all 8 values, order matches schema.prisma)
CREATE TYPE "LedgerEntryType" AS ENUM (
  'booking_credit',
  'platform_fee',
  'refund_debit',
  'refund_out',
  'payout_debit',
  'payout_reversal',
  'chargeback',
  'adjustment'
);

-- 2. Table.
--    amount BIGINT — signed minor units (VND). Sign convention documented in
--    lib/ledger/ledgerRepo.ts (NOT DB-enforced in this slice).
--    bookingId is UUID to match Booking.id (@db.Uuid).
--    payoutId is a plain TEXT column with NO FK — kept decoupled from Payout in
--    this slice (referential integrity deferred to slices 049/050).
CREATE TABLE "LedgerEntry" (
  "id"            TEXT             NOT NULL,
  "operatorId"    TEXT             NOT NULL,
  "bookingId"     UUID,
  "payoutId"      TEXT,
  "type"          "LedgerEntryType" NOT NULL,
  "amount"        BIGINT           NOT NULL,
  "currency"      TEXT             NOT NULL DEFAULT 'VND',
  "sourceEventId" TEXT             NOT NULL,
  "createdAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- 3. Idempotency: unique per sourceEventId. Duplicate appends raise P2002 →
--    the repo treats it as a no-op (returns the existing row).
CREATE UNIQUE INDEX "LedgerEntry_sourceEventId_key" ON "LedgerEntry"("sourceEventId");
CREATE INDEX "LedgerEntry_operatorId_idx" ON "LedgerEntry"("operatorId");
CREATE INDEX "LedgerEntry_bookingId_idx" ON "LedgerEntry"("bookingId");
CREATE INDEX "LedgerEntry_payoutId_idx" ON "LedgerEntry"("payoutId");

-- 4. FK constraints (match the project convention: ON DELETE RESTRICT ON UPDATE CASCADE).
--    No payoutId FK by design (see column comment above).
ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. DB-ENFORCED IMMUTABILITY (the core AC) — append-only.
--    A BEFORE UPDATE / BEFORE DELETE trigger blocks every mutation regardless of
--    the connecting DB role. We deliberately use a trigger and NOT a role-level
--    `REVOKE UPDATE, DELETE` because:
--      - Neon (and most pooled-Postgres providers) connect the app via a single
--        pooled role that frequently has table-owner privileges; a REVOKE on that
--        role is either ineffective or unmaintainable across role rotations.
--      - A trigger is role-INDEPENDENT, portable, and directly testable from the
--        app connection (the integration test asserts the DB error fires).
--    Triggers are SQL-only — the Prisma DSL cannot model them, so this object is
--    invisible to `prisma migrate diff` and never appears in schema.prisma. This
--    is the same Prisma-DSL-invisible exception called out for partial indices
--    (Issue 007) and CHECK constraints (Issue 020).
CREATE OR REPLACE FUNCTION "ledger_entry_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_entry_no_update" BEFORE UPDATE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"();

CREATE TRIGGER "ledger_entry_no_delete" BEFORE DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "ledger_entry_immutable"();
