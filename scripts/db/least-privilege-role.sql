-- SEC-DB-LEASTPRIV (#558) — provision a DML-only runtime role for the app.
--
-- Problem: the app currently connects (DATABASE_URL) as a role that OWNS its tables, so a leaked
-- connection string or any future injection yields unrestricted DDL (DROP TABLE, TRUNCATE) and
-- arbitrary writes (UPDATE "Booking" SET status='paid'). The LedgerEntry/AdminAuditLog immutability
-- triggers cover only those two tables. This script separates privilege:
--   - migrations keep running as the OWNER role via DIRECT_URL
--   - the app runtime connects as app_runtime: SELECT/INSERT/UPDATE/DELETE only, NO DDL
--
-- APPLY (Neon console / psql), connected as the OWNER role, AFTER a migration so all tables exist:
--   1. Set a strong password below (or ALTER ROLE ... PASSWORD after creation).
--   2. Run this whole script.
--   3. Point Vercel Production DATABASE_URL at app_runtime; keep DIRECT_URL on the owner.
--   4. Re-run the GRANTs (steps marked "re-run after each migration") whenever a migration adds a
--      new table/sequence — or rely on the ALTER DEFAULT PRIVILEGES below to auto-grant future ones.
--
-- Verify: `SELECT has_table_privilege('app_runtime','"Booking"','DELETE');`  -> t
--         `SELECT has_table_privilege('app_runtime','"Booking"','TRUNCATE');` -> f  (no DDL)

-- 1. The runtime role (LOGIN, no superuser, no createdb, no createrole).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

-- 2. Connect + schema usage (no CREATE on the schema → cannot add/drop objects).
GRANT CONNECT ON DATABASE CURRENT_CATALOG TO app_runtime;  -- if this errors, name the DB explicitly
GRANT USAGE ON SCHEMA public TO app_runtime;
REVOKE CREATE ON SCHEMA public FROM app_runtime;

-- 3. DML on all existing tables + sequence usage (re-run after each migration, or rely on step 4).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- 4. Auto-grant the same on tables/sequences created by FUTURE migrations (run as the owner role,
--    so "created by this role" covers Prisma migrations executed via DIRECT_URL/owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- NOTE: app_runtime is deliberately NOT granted TRUNCATE, REFERENCES, TRIGGER, or any DDL. The
-- immutability triggers on "LedgerEntry"/"AdminAuditLog" still apply (they fire regardless of role);
-- this simply removes the role's ability to drop/rename/truncate the rest of the schema.
