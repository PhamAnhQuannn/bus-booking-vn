-- STEP 2 (auth-audit): Customer.emailVerifiedAt (P13, #436) + narrow the email
-- partial unique index to free deleted-account emails (P2, #426).
--
-- P13 — emailVerifiedAt:
--   The email+password register flow (app/api/auth/register/route.ts) already proves
--   email ownership via a single-use OTP proof BEFORE authService.register runs, so
--   every existing password customer's email was proven at signup even though no
--   column recorded it. Backfill approximates that time with createdAt (the OTP proof
--   is not retained). The column is nullable → additive, no lock concern.
ALTER TABLE "Customer" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

UPDATE "Customer"
  SET "emailVerifiedAt" = "createdAt"
  WHERE "passwordHash" IS NOT NULL;

-- P2 — delete->re-register lockout:
--   The original index (migration 20260519003311_issue_007_auth) reserves an email on
--   any non-null row, including soft-deleted ones (deleteAccount nulls phone but keeps
--   email until the 730-day anonymization sweep). With email as the identity anchor
--   (ADR-021), that locks a deleted customer out of re-registering their own email for
--   up to 2 years. Adding `AND "deletedAt" IS NULL` scopes uniqueness to LIVE accounts,
--   so a fresh registration no longer collides with the retired row — and it fixes every
--   already-deleted prod row the instant this lands, with no PII-mutating backfill.
--
--   Plain DROP/CREATE (not CONCURRENTLY): safe by construction, not merely by low traffic.
--   The whole migration file runs inside Prisma's implicit transaction, and both DDL
--   statements take ACCESS EXCLUSIVE on "Customer", so any concurrent duplicate-email insert
--   simply queues behind the lock — there is no unlocked window where uniqueness is
--   unenforced. On a tiny early-launch table the lock is also millisecond-scale. NOTE:
--   CONCURRENTLY is NOT a drop-in upgrade here — it cannot run inside a transaction and
--   would REINTRODUCE an unenforced window; only reach for it if this table grows large
--   enough that the ACCESS EXCLUSIVE hold becomes a latency problem.
--
--   SQL-only by necessity: Prisma DSL cannot express a WHERE-clause partial unique index,
--   so it stays out of schema.prisma (documented on the Customer.email field) and Prisma
--   ignores it when diffing.
DROP INDEX "Customer_email_key";

CREATE UNIQUE INDEX "Customer_email_key"
  ON "Customer" ("email")
  WHERE "email" IS NOT NULL AND "deletedAt" IS NULL;
