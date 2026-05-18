# Hold System — Rollback & Operations Runbook

> **Scope**: Issue 002 — seat-hold booking funnel (Phase 4).
> Covers: HOLD_SECRET rotation, DB migration rollback, feature-flag flips (Step 10 / Step 18).

---

## 1. HOLD_SECRET Rotation

`HOLD_SECRET` signs every `bb_hold` cookie. Rotating it immediately invalidates all in-flight holds — users mid-booking will be redirected to `/search`.

### When to rotate

- Suspected key compromise
- Scheduled quarterly key rotation
- After a deployment that exposed the key in logs (check logger redact paths first)

### Procedure

1. Generate a new 32-byte hex key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Set the new value in your secret manager / Vercel environment:
   ```
   HOLD_SECRET=<new-64-char-hex>
   ```
3. Deploy. All cookies signed with the old key fail `timingSafeEqual` → 401 on `GET /api/holds/[id]` → review page redirects to `/search`.
4. No DB cleanup needed — stale Hold rows will be swept by the cron job.

### Zero-downtime rotation (optional)

If user impact must be minimised, keep the old key in `HOLD_SECRET_PREV` and check both keys in `verifyCookieValue` for one deploy cycle, then remove `HOLD_SECRET_PREV` on the next deploy.

---

## 2. Database Migration Rollback

Migration added in Phase 4: `20260518004149_add_hold_model`

Changes:
- `CREATE TYPE "HoldStatus" AS ENUM (...)`
- `ALTER TABLE "Trip" ADD COLUMN "blockedSeats" INTEGER NOT NULL DEFAULT 0`
- `CREATE TABLE "Hold" (...)`
- Two indexes on `Hold`
- `ALTER TABLE "Hold" ADD CONSTRAINT ... FOREIGN KEY ("tripId") REFERENCES "Trip"("id")`

### Full rollback SQL

Run in a psql session or via `prisma db execute`:

```sql
-- 1. Drop FK and table
ALTER TABLE "Hold" DROP CONSTRAINT IF EXISTS "Hold_tripId_fkey";
DROP TABLE IF EXISTS "Hold";

-- 2. Drop enum
DROP TYPE IF EXISTS "HoldStatus";

-- 3. Remove column from Trip
ALTER TABLE "Trip" DROP COLUMN IF EXISTS "blockedSeats";
```

**Warning:** This permanently deletes all Hold rows. Take a DB snapshot before running.

### Prisma rollback steps

```bash
# 1. Run the SQL above manually
# 2. Remove the migration record so Prisma doesn't think it's applied
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260518004149_add_hold_model';

# 3. Remove the migration file
rm prisma/migrations/20260518004149_add_hold_model/migration.sql
rmdir prisma/migrations/20260518004149_add_hold_model

# 4. Re-generate the client against the rolled-back schema
DATABASE_URL="$DATABASE_URL" npx prisma generate
```

### After rollback

- The codebase will fail to compile (`Hold` model missing from Prisma client).
- Revert the code changes from Phase 4 before deploying, or deploy with `SEARCH_USE_BLOCKED_SEATS=false` and `HOLD_SWEEPER_MODE=count` as a safe interim state.

---

## 3. Step 10 — SEARCH_USE_BLOCKED_SEATS Flag Flip

**Default**: `SEARCH_USE_BLOCKED_SEATS=false`

When `false`: search returns `bus.capacity` as `availableSeats`. Hold records do **not** affect search results — users may see seats that are actually held.

When `true`: search subtracts `Trip.blockedSeats` (sum of active hold ticket counts) from `bus.capacity` before filtering. Prevents double-booking visibility.

### Enabling

Pre-conditions:
1. Hold rows are being created and `blockedSeats` is being incremented by `createHold`.
2. The cron sweeper (`sweep-holds`) is running in `update` mode (see Step 18 below) so stale holds don't permanently block seats.
3. Verify `blockedSeats` is consistent: run `scripts/rebuild-blocked-seats.sql` once if unsure.

```bash
# Vercel dashboard: Settings → Environment Variables
SEARCH_USE_BLOCKED_SEATS=true
# Redeploy required
```

### Disabling (rollback)

```bash
SEARCH_USE_BLOCKED_SEATS=false
# Redeploy required
```

No DB changes needed. Setting to `false` reverts to capacity-only availability calculation.

---

## 4. Step 18 — HOLD_SWEEPER_MODE Flag Flip

**Default**: `HOLD_SWEEPER_MODE=count`

| Mode | Behaviour |
|------|-----------|
| `count` | Counts expired-but-active holds, logs, returns `{mode, expiredCount}`. **No mutation.** Safe for monitoring. |
| `update` | Marks up to 500 expired-but-active holds as `status='expired'` per invocation. Uses `FOR UPDATE SKIP LOCKED`. |

The cron runs every minute (`* * * * *` in `vercel.json`).

### Enabling update mode

Pre-conditions:
1. Confirm `count` mode reports a non-zero `expiredCount` (holds are accumulating).
2. Optionally run `rebuild-blocked-seats.sql` to correct `Trip.blockedSeats` before enabling.

```bash
# Vercel dashboard: Settings → Environment Variables
HOLD_SWEEPER_MODE=update
# Redeploy required
```

### Reverting to count mode

```bash
HOLD_SWEEPER_MODE=count
# Redeploy required
```

### Manual sweep (emergency)

If the cron is not running and expired holds are blocking seats:

```sql
WITH expired AS (
  SELECT id FROM "Hold"
  WHERE status = 'active'::"HoldStatus"
    AND "expiresAt" < NOW()
  LIMIT 500
  FOR UPDATE SKIP LOCKED
)
UPDATE "Hold"
SET status = 'expired'::"HoldStatus"
WHERE id IN (SELECT id FROM expired)
RETURNING COUNT(*) AS updated;
```

Run repeatedly until `updated` returns 0.

---

## 5. blockedSeats Drift Recovery

If `Trip.blockedSeats` gets out of sync (e.g., after a partial rollback or data import):

```bash
# Run the idempotent rebuild script
psql "$DATABASE_URL" < scripts/rebuild-blocked-seats.sql
```

This recomputes `blockedSeats` from current active Hold records for all trips.

---

## 6. Monitoring Checklist

| Signal | Source | Threshold |
|--------|--------|-----------|
| `expiredCount` high | `/api/cron/sweep-holds` logs | > 100 → switch to `update` mode |
| `SOLD_OUT` 409 spike | API logs | Investigate capacity vs hold TTL |
| `UNAUTHORIZED` 401 on cron | Vercel cron logs | Verify `CRON_SECRET` env var matches |
| Hold TTL | `holdRepo.ts` `HOLD_TTL_MINUTES=10` | Adjust if abandonment rate is high |
