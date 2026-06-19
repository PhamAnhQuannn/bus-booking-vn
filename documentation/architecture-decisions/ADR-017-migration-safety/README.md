# ADR-017: Schema Evolution & Migration Safety

## Status
ACCEPTED

## Date
2026-06-17

## Context

The platform uses Prisma ORM with PostgreSQL. Schema changes (migrations) are the highest-risk deployments — a bad migration can corrupt data, break running code, or create drift between the Prisma schema DSL and the actual database state. The codebase uses both Prisma-generated migrations and raw SQL for features Prisma's DSL cannot express (partial indexes, CHECK constraints, triggers).

**Sources**: `design/24-disaster-recovery/` §24.2, `design/26-evolution/`, `design/06-data-model/` §6.4

---

## Decisions

### D1: Forward-Only Migrations

All migrations are forward-only. No `DOWN` migration that could lose data.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Forward-only** ✅ | Never write rollback migrations | No risk of data loss from rollback; simpler migration files | Must forward-fix if migration is wrong |
| B. Up/Down migrations | Write reversible migrations | Can undo schema changes | Down migrations can silently lose data (drop column = gone); rarely tested; false confidence |

**Choice**: Option A.

**Rationale**: Down migrations are almost never tested and create a false sense of reversibility. Dropping a column loses its data — there is no true "undo." Forward-fixing (writing a new migration that corrects the mistake) is safer and more explicit.

---

### D2: Two-Phase Destructive Changes

Destructive schema changes (drop column, drop table, rename column) are split into two separate deployments:

- **Phase A**: Remove all code references to the column/table. Deploy. Verify no runtime errors.
- **Phase B**: Separate migration drops the column/table. Deploy.

**Rationale**: If Phase A and Phase B are in the same deployment, a rollback of the code (without rolling back the migration) leaves the code referencing a column that no longer exists. Two-phase ensures the code is already safe before the schema changes.

---

### D3: Dual Declaration for Non-Partial Indexes

Any index that CAN be expressed in the Prisma DSL (plain composite, single-column on a non-`@unique` column) MUST be declared in BOTH `schema.prisma` (as `@@index`) AND the raw SQL migration.

| Location | Example |
|----------|---------|
| `schema.prisma` | `@@index([operatorId, createdAt])` |
| `migration.sql` | `CREATE INDEX "LedgerEntry_operatorId_createdAt_idx" ON "LedgerEntry" ("operatorId", "createdAt");` |

**Rationale**: If the index exists only in SQL, Prisma detects schema-vs-DB drift on the next `prisma migrate dev` and prompts interactively for a follow-up migration — breaking unattended CI/autopilot workflows. If the index exists only in `schema.prisma`, the actual DB may not have it after a manual migration. Both must agree.

---

### D4: Raw SQL for Prisma-Inexpressible Features

Partial indexes (with `WHERE` clause), CHECK constraints, and triggers MUST use raw SQL in the migration file. These stay SQL-only because Prisma's DSL cannot model them.

| Feature | Example | Why SQL-only |
|---------|---------|--------------|
| Partial index | `CREATE UNIQUE INDEX ... WHERE consumed = false` | Prisma DSL has no `WHERE` clause for indexes |
| CHECK constraint | `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` | Prisma DSL has no CHECK support |
| Trigger | `CREATE FUNCTION ledger_entry_immutable() ...` | Prisma DSL has no trigger support |

Prisma silently ignores these in its schema diff — no drift warning. This is acceptable because these features have no DSL equivalent.

---

### D5: NOT NULL Column Checklist

When adding a NOT NULL column to an existing model, grep every call site that creates rows for that model BEFORE merging:

```
grep -r "prisma\.<model>\.create" lib/ app/ e2e/ prisma/seed.ts __tests__/
grep -r "INSERT INTO \"<Model>\"" e2e/ prisma/ __tests__/
```

Every hit must include the new column with a valid value. Sandbox-gated specs that never run in CI rot silently and surface only when the first test executes against a fresh database.

**Rationale**: A NOT NULL column without a default makes every existing `create` call a compile error (caught by tsc) or a runtime PG constraint violation (caught only on execution). Integration tests and e2e specs that are sandbox-gated may not run in CI, so their breakage goes undetected until manual execution.

---

### D6: Committed Migrations Never Edited

Once a migration file is committed to version control, it is never modified. If a migration is wrong, write a new forward migration to correct it.

**Rationale**: Editing a committed migration changes its checksum. Prisma detects the mismatch and refuses to run subsequent migrations, breaking every environment that already applied the original version.

---

### D7: Three-Stage Scaling Path

Schema evolution follows a staged approach aligned with platform growth:

| Stage | Scale | Architecture | Migration approach |
|-------|-------|-------------|-------------------|
| **Stage 0 (now)** | ~200 bookings/day | Modular monolith, single deploy | Standard Prisma migrations |
| **Stage 1** | Jobs >30s latency | Worker process + read replica | Migrations must be replica-safe (no long locks) |
| **Stage 2** | Module >50% CPU or search p95 >200ms | Domain extraction to service | Schema split follows domain boundaries; shared tables require coordination |

**One-way-door decisions** built from day 1 (cannot be retrofitted cheaply): multi-tenancy (`operatorId` on every row), double-entry ledger (append-only), idempotency keys, row-level locking patterns, stateless servers, payment gateway abstraction, async notification boundary, module barrels, forward-only migrations, structured logging.

---

## Consequences

### Positive

- **No data loss from rollbacks** — forward-only means destructive changes are always deliberate
- **No schema drift** — dual declaration keeps Prisma and DB in sync
- **Safe CI** — committed migrations have stable checksums; no surprise prompts
- **Grep checklist** catches NOT NULL breakage before it reaches production

### Negative

- **Two-phase deploys are slower** — destructive changes require two separate releases
- **Dual declaration is redundant** — same index written in two places (schema.prisma + SQL)
- **Raw SQL is not type-checked** — Prisma DSL catches typos; raw SQL does not
- **Forward-fix pressure** — cannot "undo" a bad migration; must write corrective SQL
