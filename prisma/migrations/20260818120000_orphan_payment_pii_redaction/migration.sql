-- #332: orphan PaymentEvent PII redaction marker.
-- NULL = not yet redacted. The retention sweeper strips the payer PII keys from an
-- orphan row's rawBody past the retention window and stamps this. The row is never
-- deleted (money evidence); erase != delete (S04).
ALTER TABLE "PaymentEvent" ADD COLUMN "redactedAt" TIMESTAMP(3);

-- Partial index backing the sweeper's daily claim predicate (orphan + not-yet-redacted).
-- Keeps the claim off a full-table scan as PaymentEvent grows. PARTIAL/WHERE index =>
-- SQL-only (Prisma DSL cannot express it); intentionally not declared as @@index.
CREATE INDEX "PaymentEvent_orphan_unredacted_idx"
  ON "PaymentEvent" ("receivedAt")
  WHERE "bookingId" IS NULL AND "redactedAt" IS NULL;
