---
name: migration-author
description: ORM-aware migration draft. Detects rename vs drop+add, emits backfill SQL, and writes the reverse migration alongside. Stack-branched (Prisma/Drizzle/Alembic/sqlc). Pairs with `/migration-safety` (deploy gate). Use when user says "draft migration", "rename column", "add column with backfill", "write migration", "/migration-author", or after schema design change.
---

# /migration-author — Safe Schema Change Drafter

## Why you'd care

Hand-written migrations forget the reverse step and miss backfills, then break on a rename you thought was a drop+add. ORM-aware drafting + paired reverse is the difference between a clean migration and a 2 a.m. rollback.

Invoke as `/migration-author <description>`. Authors a migration that does the right thing for the kind of change being made — instead of letting the ORM emit a destructive default.

---

## Pre-flight

1. Read `docs/stack/profile.md`. ORM = `raw / none` → halt.
2. Detect tool by ORM:
   - Prisma → uses `prisma migrate dev --create-only`
   - Drizzle → uses `drizzle-kit generate`
   - Alembic → uses `alembic revision --autogenerate`
   - sqlc → uses raw `db/migrations/<n>.sql`
3. Read `docs/design/data-model.md` if present — diff against current schema to detect intent.
4. If there is no pending schema diff (schema file unchanged) → halt: "no diff to migrate".

---

## Inputs

- Description (kebab-case slug, e.g. "rename-user-email-to-contact-email")
- Detected schema diff
- Optional `--reversible-only` to refuse non-reversible ops

---

## Change-kind detection

Diff schema before vs after. Classify each change:

| Kind                 | Signal                                                  | Safe default                       |
|----------------------|---------------------------------------------------------|------------------------------------|
| Add nullable column  | new field, no `@default`, `?` modifier                  | one-step add                        |
| Add NOT NULL column  | new field, no `?`                                       | **expand-contract**: add nullable → backfill → set NOT NULL (3 migrations) |
| Drop column          | field removed                                           | **expand-contract**: stop writes (deploy) → drop (later)                  |
| Rename column        | new field name + removed field with matching type       | `RENAME COLUMN` (NOT drop+add)     |
| Change type (widen)  | int → bigint, varchar(50) → varchar(200)                | one-step `ALTER TYPE`              |
| Change type (narrow) | bigint → int, text → varchar(50)                        | **REFUSE** unless `--force` + backfill plan |
| Add index            | new `@@index`                                           | `CREATE INDEX CONCURRENTLY` (Postgres) |
| Add unique constraint| new `@unique`                                           | dedupe → add (2 migrations)        |
| Add FK               | new relation field                                      | one-step + check existing rows     |
| Rename table         | model renamed                                           | `RENAME TABLE` (NOT drop+create)   |

---

## Workflow

1. Generate raw migration via ORM tool (e.g. `prisma migrate dev --create-only --name <slug>`).
2. Read the emitted SQL.
3. Re-classify every statement per the change-kind table.
4. If any naive `DROP` paired with a near-identical `ADD` of compatible type → rewrite as `RENAME`.
5. If `ADD COLUMN ... NOT NULL` without default on a non-empty table → split into 3 migrations: add nullable → backfill stub → set NOT NULL.
6. Emit reverse migration (`down.sql` or `db/migrations/<n>_down.sql` — even if ORM doesn't auto-use it; required for `/rollback-plan`).
7. Write a sibling `<slug>.notes.md` describing detected kinds + backfill plan + rollback path.

---

## File templates (Prisma)

`prisma/migrations/<ts>_<slug>/migration.sql` (rename detected):

```sql
-- AUTOGEN replaced DROP/ADD with RENAME (kind: rename column)
ALTER TABLE "user" RENAME COLUMN "email" TO "contact_email";
```

`prisma/migrations/<ts>_<slug>/down.sql`:

```sql
ALTER TABLE "user" RENAME COLUMN "contact_email" TO "email";
```

`prisma/migrations/<ts>_<slug>/notes.md`:

```markdown
# Migration notes — <slug>

## Detected change kinds
- Rename: `user.email` → `user.contact_email`

## Backfill plan
- None needed (rename preserves data).

## Deploy order
1. Apply this migration.
2. Deploy code that reads new column name.

## Rollback
- `down.sql` reverses rename. Safe.
```

---

## Expand-contract pattern (NOT NULL add)

Three sibling migrations under one slug:

```
prisma/migrations/<ts>_<slug>_1_add_nullable/migration.sql
prisma/migrations/<ts>_<slug>_2_backfill/migration.sql
prisma/migrations/<ts>_<slug>_3_set_not_null/migration.sql
```

Step 1 — add nullable:

```sql
ALTER TABLE "order" ADD COLUMN "stripe_intent_id" TEXT;
```

Step 2 — backfill (commit only after code populates it for all new rows):

```sql
UPDATE "order" SET "stripe_intent_id" = 'legacy' WHERE "stripe_intent_id" IS NULL;
```

Step 3 — enforce:

```sql
ALTER TABLE "order" ALTER COLUMN "stripe_intent_id" SET NOT NULL;
```

`notes.md` calls out: "Do not run step 3 until step 2 is verified zero rows."

---

## Zero-downtime expansion → backfill → contraction

For schema changes on hot tables (>10k rows, prod traffic), use the 3-phase template in [`templates/zero-downtime.md`](templates/zero-downtime.md):

1. **Expansion** — additive only, dual-write, read-old. Deploy + observe.
2. **Backfill** — paginated idempotent job. Verify parity.
3. **Contraction** — flip reads → stop dual-write → drop old. Three sub-deploys.

Each phase is its own deploy. Rollback = re-deploy prior commit.

---

### Raw-SQL migration pattern (>1M rows)

When ORM-generated `ALTER TABLE` rewrites the whole table and locks for minutes, bypass the ORM. Use `sqlc`-style raw migration even on Prisma/Drizzle stacks (mark as `--create-only` then hand-edit).

Worked example — add `currency_code` to `payment` (fintech, 40M rows):

```sql
-- 001_expand.sql  (phase 1, instant)
SET LOCAL lock_timeout = '5s';
ALTER TABLE "payment" ADD COLUMN "currency_code" TEXT NULL;  -- cheap: no rewrite

-- 002_backfill.sql  (phase 2, batched job, NOT a single migration)
-- run from job runner, not migration tool:
DO $$
DECLARE
  batch_start BIGINT := 0;
  batch_size  INT    := 10000;
  max_id      BIGINT;
BEGIN
  SELECT MAX(id) INTO max_id FROM "payment";
  WHILE batch_start <= max_id LOOP
    UPDATE "payment"
       SET "currency_code" = 'USD'
     WHERE id BETWEEN batch_start AND batch_start + batch_size
       AND "currency_code" IS NULL;
    batch_start := batch_start + batch_size;
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;

-- 003_index.sql  (phase 1.5, never blocks writes)
CREATE INDEX CONCURRENTLY "idx_payment_currency" ON "payment"("currency_code");

-- 004_contract.sql  (phase 3, after app stops writing NULL)
SET LOCAL lock_timeout = '5s';
ALTER TABLE "payment" ALTER COLUMN "currency_code" SET NOT NULL;
```

Why `SET LOCAL lock_timeout = '5s'`: fail fast instead of queueing behind a long reader and starving every other writer.

---

### Backfill-before-rename library

Catalog of safe rename patterns. Each rename = additive change first, never `RENAME` in flight on hot tables.

**Column rename** — `user.email` → `user.contact_email` (SaaS):

```sql
-- phase 1: add new
ALTER TABLE "user" ADD COLUMN "contact_email" TEXT NULL;
-- phase 2: backfill + dual-write (app writes both)
UPDATE "user" SET "contact_email" = "email" WHERE "contact_email" IS NULL;
-- phase 3: stop writing old, then drop
ALTER TABLE "user" DROP COLUMN "email";
```

**Table rename** — `orders` → `purchase_orders` (commerce), keep reads working:

```sql
-- phase 1: rename + compat view
ALTER TABLE "orders" RENAME TO "purchase_orders";
CREATE VIEW "orders" AS SELECT * FROM "purchase_orders";
-- optional: INSTEAD OF trigger for writes through view
CREATE TRIGGER "orders_compat_ins" INSTEAD OF INSERT ON "orders"
  FOR EACH ROW EXECUTE FUNCTION forward_to_purchase_orders();
-- phase 3 (later deploy): drop view once callers migrated
DROP VIEW "orders";
```

**Enum value rename** — `ride_status` `'cancelled'` → `'rider_cancelled'` (mobility):

```sql
-- phase 1: add new value
ALTER TYPE "ride_status" ADD VALUE 'rider_cancelled';
-- phase 2: migrate writes (deploy app writing new value), then backfill reads
UPDATE "ride" SET "status" = 'rider_cancelled' WHERE "status" = 'cancelled';
-- phase 3: migrate readers, then drop old (Postgres: requires type swap dance)
-- CREATE TYPE ride_status_new AS ENUM(...); ALTER TABLE ... USING; DROP TYPE old;
```

---

### Rollback cross-ref

Every migration ships with a paired `/rollback-plan` entry. For 3-phase migrations, rollback diverges per phase:

| Phase failed | Rollback action | Data loss? |
|--------------|-----------------|------------|
| Phase 1 (expand) | Drop the new column / table / index. App still reads old. | No |
| Phase 2 (backfill) | Stop the backfill job. Leave new column NULL. App keeps dual-writing or falls back to old. | No |
| Phase 3 (contract) | Reverse expansion: re-add old column nullable, backfill from new, restore code reading old. | Possible if writes happened to new-only between drop and re-add — needs WAL/PITR. |

`notes.md` for every 3-phase slug **must** include a `## Rollback by phase` block listing the three reverse SQL snippets. `/rollback-plan` reads this block; missing block = `/rollback-plan` refuses.

---

## Output

Side-effect = migration files + notes. After emit, print:

```
Drafted migration <slug>. Files: <list>. Kinds detected: <list>.
Next: /migration-safety <slug>   (pre-deploy gate)
```

---

## When to re-run

- Per new schema change.
- Do NOT re-run on the same slug — edit in place or supersede.
