# Runbook — least-privilege DB runtime role (SEC-DB-LEASTPRIV #558)

**Goal:** the app runtime connects with a role that can read/write rows but CANNOT run DDL
(`DROP`/`TRUNCATE`/`ALTER`), so a leaked `DATABASE_URL` or a future injection can't destroy the
schema or truncate money tables. Migrations keep DDL power via a separate role.

## Why
`DATABASE_URL` today authenticates as the table-**owner** role (Neon default). The
`LedgerEntry` / `AdminAuditLog` immutability triggers protect only those two tables; every other
table (`Booking`, `PaymentEvent`, `Payout`, `Operator`, …) is DROP/UPDATE-able by the owner role.
Defense-in-depth: split runtime (DML) from migrations (DDL).

## Apply (one-time, ~10 min)
1. Neon console → your project → **SQL Editor** (or `psql` with the OWNER connection string).
2. Open `scripts/db/least-privilege-role.sql`, set a strong `app_runtime` password, run it.
   Run it **as the owner role** and **after** the latest migration (so all tables exist).
3. Get the `app_runtime` connection string (Neon: create a new role/endpoint or compose the URL
   with the new user + password, same host/db).
4. Vercel → Project → Settings → Environment Variables → **Production**:
   - `DATABASE_URL` → the `app_runtime` connection string (pooled).
   - `DIRECT_URL` → keep on the **owner** role (migrations need DDL).
5. Redeploy production.

## Verify (before trusting it)
```sql
SELECT has_table_privilege('app_runtime', '"Booking"', 'DELETE');    -- expect t
SELECT has_table_privilege('app_runtime', '"Booking"', 'TRUNCATE');  -- expect f
SELECT has_schema_privilege('app_runtime', 'public', 'CREATE');      -- expect f
```
Smoke: a booking flow (read + write) works; `prisma migrate deploy` still runs (owner via DIRECT_URL).

## After each migration
The `ALTER DEFAULT PRIVILEGES` in the script auto-grants DML on tables/sequences created by the
owner, so new migrations "just work" for `app_runtime`. If a table was created by a different role,
re-run steps 3 (the `GRANT … ON ALL TABLES`) from the SQL file. CI should assert the split (a check
that `has_table_privilege('app_runtime', <table>, 'TRUNCATE')` is false).

## Rollback
Point `DATABASE_URL` back at the owner role + redeploy. `app_runtime` can be left in place (unused)
or `DROP ROLE app_runtime;` after `REASSIGN OWNED`/`DROP OWNED` (it owns nothing, so `DROP ROLE`
succeeds once no session uses it).

Related: #558, HD-013 rule 6.
