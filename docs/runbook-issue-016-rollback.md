# Operator Revenue + Payout — Rollback Runbook

> **Scope**: Issue 016 — Operator revenue CSV export + T+3 payout reporting.
> Migration: `20260519182813_op_revenue_payout_role`

---

## 1. What the migration introduces

- `CREATE TYPE "PayoutStatus"` enum: `pending | processing | settled | failed`
- `CREATE TABLE "Payout"` with 11 columns, 2 FKs (Trip, Operator), 3 indices
- `ALTER TYPE "OperatorRole" ADD VALUE 'staff'`

The first two are trivially reversible. **The ALTER TYPE is not.** Postgres does not support `DROP VALUE` from an enum; reverting the `staff` literal requires the rename-and-recreate dance below.

---

## 2. Full rollback SQL

Take a DB snapshot first. Then run in a psql session or via `prisma db execute`:

```sql
BEGIN;

-- 2.1 Drop the Payout table (drops indices + FKs implicitly)
DROP TABLE IF EXISTS "Payout";

-- 2.2 Drop the PayoutStatus enum
DROP TYPE IF EXISTS "PayoutStatus";

COMMIT;
```

### Reverting the OperatorRole enum (only if `staff` rows exist or must be removed)

`ALTER TYPE ... ADD VALUE` cannot be undone directly. Skip this step if no `OperatorUser.role = 'staff'` rows exist — leaving the unused enum value in place is harmless.

If the value MUST be removed:

```sql
BEGIN;

-- 2.3a Refuse if any rows use the value
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "OperatorUser" WHERE role = 'staff') THEN
    RAISE EXCEPTION 'Cannot remove staff role — OperatorUser rows still reference it. Reassign or delete first.';
  END IF;
END $$;

-- 2.3b Rename current enum out of the way
ALTER TYPE "OperatorRole" RENAME TO "OperatorRole_old";

-- 2.3c Recreate without 'staff'
CREATE TYPE "OperatorRole" AS ENUM ('admin');

-- 2.3d Migrate the column to the new type
ALTER TABLE "OperatorUser"
  ALTER COLUMN role TYPE "OperatorRole"
  USING role::text::"OperatorRole";

-- 2.3e Drop the old enum
DROP TYPE "OperatorRole_old";

COMMIT;
```

---

## 3. Prisma rollback steps

After running the SQL above:

```bash
# 3.1 Remove the migration record so Prisma stops treating it as applied
psql "$DATABASE_URL" -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260519182813_op_revenue_payout_role';"

# 3.2 Remove the migration directory
rm -r prisma/migrations/20260519182813_op_revenue_payout_role

# 3.3 Revert the schema.prisma changes (Payout model, PayoutStatus enum, staff role)

# 3.4 Regenerate the client against the rolled-back schema
DATABASE_URL="$DATABASE_URL" npx prisma generate
```

---

## 4. Code revert checklist

After the DB rollback, the codebase will fail to compile (`PayoutStatus` enum + `Payout` model missing from Prisma client).

Files to revert:

- `lib/payouts/**` (entire directory)
- `app/api/op/reports/revenue/route.ts`
- `app/api/op/reports/revenue.csv/route.ts`
- `app/api/op/reports/payouts/route.ts`
- `app/api/op/reports/payouts/[id]/retry/route.ts`
- `app/op/reports/revenue/page.tsx`
- `app/op/reports/revenue/RevenueClient.tsx`
- `app/op/reports/payouts/page.tsx`
- `app/op/reports/payouts/PayoutsClient.tsx`
- `e2e/op-reports.spec.ts`
- `lib/auth/jwt.ts` (revert role claim)
- `lib/auth/operatorSession.ts` (revert role lookup)
- `lib/auth/__tests__/jwt.test.ts`
- `lib/auth/__tests__/operatorSession.test.ts`
- `prisma/schema.prisma` (remove Payout model, PayoutStatus enum, staff role value)

Or revert at git level: `git revert <merge-commit-sha>`.

---

## 5. Verification after rollback

```bash
# 5.1 Confirm enum & table dropped
psql "$DATABASE_URL" -c "\dT" | grep -i payout
psql "$DATABASE_URL" -c "\dt" | grep -i payout
# Both should return nothing.

# 5.2 Confirm Prisma migrate status is clean
pnpm prisma migrate status

# 5.3 Confirm app compiles
pnpm tsc --noEmit
```

---

## 6. Forward-fix (preferred over rollback)

If the issue is a bug in the new code path rather than a fundamental design problem, prefer a forward fix:

- Disable the new operator UI routes via the operator admin UI feature flag (if introduced)
- Hot-patch the offending lib function and redeploy
- Leave the migration in place — Payout rows older than the rollback window are still valid data

Rollback should be reserved for compliance / data-integrity emergencies where the new tables MUST be removed.
