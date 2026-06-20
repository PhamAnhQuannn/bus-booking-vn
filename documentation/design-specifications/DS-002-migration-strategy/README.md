# DS-002 -- Migration Strategy

## 1. Overview

This document is the authoritative migration strategy for the BusBooking platform. The persistence layer is PostgreSQL 16+ accessed via Prisma ORM (Prisma 7.x). Migrations use both Prisma-generated DDL and raw SQL for features the Prisma DSL cannot express (partial indexes, CHECK constraints, triggers). All migrations are forward-only -- no DOWN migration that could lose data. The schema file (`prisma/schema.prisma`) and the raw SQL migration files must agree on every construct that can be expressed in both; this is the schema-parity invariant. See ADR-017 for the foundational decisions; this document operationalizes them alongside regulatory and deployment constraints.

**Scaling path.** Schema evolution follows three stages aligned with platform growth (ADR-017 D7, ADR-020):

| Stage | Trigger | Architecture | Migration Approach |
|-------|---------|-------------|-------------------|
| Stage 0 (current) | ~200 bookings/day | Modular monolith, single deploy | Standard Prisma migrations; 3.6 hr/month downtime budget |
| Stage 1 | Jobs >30 s latency | Worker process + read replica | Replica-safe migrations; no long table locks |
| Stage 2 | Module >50% CPU or search p95 >200 ms | Domain extraction to service | Schema splits follow module boundaries; shared tables need coordination |

**One-way-door decisions** already embedded in the schema (cannot be retrofitted cheaply): multi-tenancy (`operatorId` on every tenant-scoped row), double-entry ledger (append-only with immutability trigger), idempotency keys, row-level locking via `SELECT ... FOR UPDATE`, forward-only migrations, `ratePpm` (parts-per-million) fee encoding, advisory locks for capacity serialization, stateless servers, payment gateway abstraction, async notification boundary, module barrels.

---

## 2. Migration Authoring Rules

### 2.1 Forward-Only Policy

All migrations are forward-only. No DOWN migration is ever written (ADR-017 D1).

| Scenario | Action |
|----------|--------|
| Migration is wrong | Write a new forward migration that corrects it |
| Column was dropped by mistake | Write a new migration to re-add it (data is lost -- accept or restore from backup) |
| Need to "undo" a rename | Write a new migration with the reverse rename |

**Rationale.** Down migrations are almost never tested and create a false sense of reversibility. Dropping a column loses its data -- there is no true "undo." Forward-fixing is safer and more explicit.

### 2.2 Committed Migrations Are Immutable

Once a migration file is committed to version control, it is never modified (ADR-017 D6). If a migration is wrong, write a new forward migration to correct it.

**Rule.** Editing a committed migration changes its checksum. Prisma detects the mismatch and refuses to run subsequent migrations, breaking every environment that already applied the original version. The Issue 020 `OperatorUser_phones_differ` CHECK constraint fix demonstrates this: the dormant constraint was removed via a new `DROP CONSTRAINT` migration, not by editing the original Issue 010 migration.

### 2.3 DSL vs Raw SQL Dual Declaration

Every schema construct falls into one of two categories (ADR-017 D3, D4):

| Construct | Where Declared | Why |
|-----------|---------------|-----|
| Tables, columns, relations | `schema.prisma` + auto-generated `migration.sql` | Prisma generates both |
| Non-partial indexes (plain composite, single-column on non-`@unique`) | **Both** `schema.prisma` (`@@index`) **and** `migration.sql` (`CREATE INDEX`) | If SQL-only, Prisma detects drift and prompts interactively -- breaks CI. If DSL-only, DB may lack the index after manual migration |
| Partial indexes (`WHERE` clause) | `migration.sql` only | Prisma DSL has no `WHERE` for indexes |
| CHECK constraints | `migration.sql` only | Prisma DSL has no CHECK support |
| Triggers / functions | `migration.sql` only | Prisma DSL has no trigger support |

Prisma silently ignores SQL-only constructs in its schema diff -- no drift warning. This is acceptable because these features have no DSL equivalent.

**Verification.** The `prisma migrate diff --from-schema-datamodel --to-schema-datasource` command was removed in Prisma 7.x (Issue 012 lesson). Before quoting any CLI verification command, read `node_modules/.bin/prisma migrate diff --help` for current flag names. The substitute is a manual side-by-side audit: read `@@index` declarations in `schema.prisma` alongside `CREATE INDEX` statements in the migration SQL and confirm line-for-line agreement.

### 2.4 NOT NULL Column Checklist

When adding a NOT NULL column to an existing model, grep every call site that creates rows for that model **before** merging (ADR-017 D5):

```
grep -r "prisma\.<model>\.create" lib/ app/ e2e/ prisma/seed.ts __tests__/
grep -r "INSERT INTO \"<Model>\"" e2e/ prisma/ __tests__/
```

Every hit must include the new column with a valid value. This applies equally to `prisma.model.create` calls in TypeScript fixtures and raw `INSERT INTO` statements in e2e specs.

**Why.** A NOT NULL column without a default makes every existing `create` call a compile error (caught by tsc) or a runtime PG constraint violation (caught only on execution). Sandbox-gated specs that never run in CI rot silently. Issues 012 and 013 each surfaced this pattern: Issue 012 added `contactPhone` + `notificationPhone` to `OperatorUser` without updating two e2e specs; Issue 013 added `operatorId` to `Trip` and broke four integration test `beforeAll` blocks plus `prisma/seed.ts`.

### 2.5 CHECK Constraint Validation

Any CHECK constraint that encodes a domain assumption must be validated against **every** insert path before it ships (Issue 020 lesson).

```
grep -r "prisma\.<model>\.create" lib/ app/ e2e/ prisma/seed.ts __tests__/
```

Confirm the constraint holds for each call site's data shape. A constraint exercised only by sandbox-gated tests is a time-bomb that detonates on the first production-path insert N issues later.

**Example.** The `OperatorUser_phones_differ` CHECK constraint (Issue 010) rejected every operator/staff provisioning insert because both `createStaff` and `createOperator` seed `contactPhone` and `notificationPhone` identically from the single login phone. The constraint was raw-SQL-only, shipped dormant, and detonated on the first real provisioning path in Issue 020.

### 2.6 Two-Phase Destructive Changes

Destructive schema changes (drop column, drop table, rename column) are split into two separate deployments (ADR-017 D2):

| Phase | What Ships | Verification |
|-------|-----------|-------------|
| **Phase A** | Remove all code references to the column/table | Deploy. Verify no runtime errors referencing the dropped construct |
| **Phase B** | New migration drops the column/table | Deploy. The schema change is safe because no code references the construct |

**Rationale.** If Phase A and Phase B are in the same deployment, a rollback of the code (without rolling back the migration) leaves the code referencing a column that no longer exists. Two-phase ensures the code is already safe before the schema changes.

---

## 3. Data Integrity Invariants

Migrations must never violate these invariants. Each is enforced at the database level, application level, or both.

### 3.1 Immutable Tables

Four tables are append-only. Migrations touching them must preserve their immutability enforcement.

| Table | Enforcement | Migration Constraint |
|-------|------------|---------------------|
| `LedgerEntry` | PostgreSQL `BEFORE UPDATE OR DELETE` trigger (`ledger_entry_immutable`) | Never drop or recreate this trigger. Adding columns is safe (non-breaking append). Never use `DROP TABLE ... CREATE TABLE` pattern. `DROP SCHEMA` required for dev DB resets because the seed cannot clear immutable rows |
| `ConsentRecord` | Same trigger pattern as `LedgerEntry` | Same constraints. Per-purpose granular consent rows (PDPL 2025 Art. 9) must not be retroactively altered |
| `AdminAuditLog` | Same trigger pattern as `LedgerEntry` | Same constraints. Provides forensic trail for 72-hour breach notification playbook (PDPL 2025) |
| `EInvoice` | Application-level policy (not trigger) | Cancellation/correction creates a new row, never modifies existing. Decree 70/2025 abolished e-invoice cancellation -- only adjustment and replacement procedures remain |

**Rule.** Any migration that includes `ALTER TABLE` on an immutable table must explicitly verify the trigger survives. Table-rename and `CREATE TABLE ... AS SELECT` operations can silently drop triggers.

### 3.2 Idempotency Constraints

The following unique constraints are load-bearing for payment and booking idempotency. They must survive every migration without exception.

| Table | Constraint | Purpose |
|-------|-----------|---------|
| `PaymentEvent` | `@@unique([adapter, providerTxnId])` | Webhook deduplication -- duplicate deliveries return 200 no-op via Prisma P2002 |
| `LedgerEntry` | `sourceEventId` unique | Prevents double-crediting from webhook replays |
| `OtpAttempt` | Partial unique `(phone) WHERE consumed = false` | OTP supersession -- raw SQL only, Prisma DSL cannot express WHERE clause |
| `Booking` | FK on `holdId` with `ON CONFLICT DO NOTHING` | Booking deduplication |

**Rule.** Dropping or rebuilding any of these indexes without atomically re-creating the constraint would break idempotency for in-flight webhooks/requests. Migrations that touch these tables must verify the constraint survives in the same migration file.

### 3.3 State Machine Co-Write Rule

Any service that writes a timestamp column corresponding to a state transition must update the status enum in the same `tx.model.update` call (ADR-019, Issue 014 lesson).

| Timestamp Column | Required Status Write | DTO Union Must Include |
|-----------------|----------------------|----------------------|
| `departedAt` | `status: 'departed'` | `'departed'` |
| `completedAt` | `status: 'completed'` | `'completed'` |
| `cancelledAt` | `status: 'cancelled'` | `'cancelled'` |

**Greppable invariant.** Every `<verb>At` column write should appear within 3 lines of a `status:` write in the same update call. The DTO's status type union and a positive test assertion on the new status value must land in the same commit.

**Migration implication.** When a migration adds a new timestamp column for a state transition (e.g., `departedAt`), the corresponding status enum value must also be added to the Prisma enum in the same migration, and the `LEGAL_*_TRANSITIONS` map in application code must be updated in the same PR.

### 3.4 Capacity Guard Compatibility

Hold creation uses two sequential PostgreSQL advisory locks within a single `$transaction` callback (ADR-009):

1. `pg_advisory_xact_lock(hashtext('hold-phone:' || phone))` -- phone cap
2. `pg_advisory_xact_lock(hashtext('hold:' || tripId))` -- trip serialization

The capacity guard itself is a conditional INSERT using raw SQL that references `Bus.capacity`, `Hold.expiresAt`, `Hold.status`, `Booking.status`, and `Booking.createdAt`. This raw SQL is not type-checked by Prisma.

**Migration constraints:**
- Column renames, type changes, or enum value changes on `Hold.status` or `Booking.status` will silently break the raw SQL capacity guard. Grep every `$queryRaw` call referencing these columns before merging.
- DDL that acquires exclusive table locks on `Trip` or `Hold` during peak operations competes with in-flight advisory locks, potentially serializing all concurrent booking attempts.
- CUIDs are TEXT -- no `::uuid` cast in raw SQL (Issue 011 lesson).
- Always use `$transaction(async (tx) => {...})` callback form, never array form -- the array form provides no `tx` handle for `SELECT FOR UPDATE` or advisory locks.

### 3.5 Currency Column Types

All monetary values are stored as VND (Vietnamese Dong) integers with no decimal component (section 1 of 01-data-model-design). Migrations must never change monetary column types.

| Column Type | Usage | Migration Rule |
|------------|-------|---------------|
| `Int` (32-bit) | Per-record amounts (max ~2.1 billion VND) | Never change to `Float` or `Decimal` |
| `BigInt` (64-bit) | Aggregates, signed ledger entries | Never change to `Float` or `Decimal` |
| `ratePpm` (Int) | Platform fee rate in parts-per-million | Avoids floating-point in database; never store rates as `Float` |

**Rule.** Any currency math that multiplies an integer minor-unit value by a fractional rate must be done in the BigInt domain at the application level (Issue 016 lesson). ES2017 target requires `BigInt(n)` constructor calls -- `n` literal suffix is a parser error. Greppable smell: any `Math.round(<int> * <fractional>)` or `Math.floor(<minor-unit-int> * <rate>)` in money-handling modules is a bug.

---

## 4. Regulatory Constraints on Schema Changes

Schema changes are subject to Vietnamese regulatory requirements. These constraints affect what columns can be dropped, how long data must live, and where it must be stored.

### 4.1 Data Retention Minimums

Migrations must never reduce retention capacity for these models. Columns cannot be dropped if doing so would destroy data within the retention window.

| Model / Data | Minimum Retention | Legal Basis | Hard Constraint |
|-------------|-------------------|-------------|----------------|
| `EInvoice` | 10 years | Decree 123/2020, Decree 70/2025 | YES -- immutable original in electronic form |
| `LedgerEntry` | 10 years | Accounting Law, Decree 123/2020 | YES -- trigger-enforced immutable |
| `PaymentEvent` | 10 years | Accounting Law | YES |
| `Booking` | 5 years | Accounting Law, Decree 158/2024 | YES -- PII anonymized after retention via sweeper |
| Financial transaction logs | 5-10 years | AML/CTF regulations | YES |
| `AdminAuditLog` | 5 years | PDPL 2025 (breach forensics) | YES -- trigger-enforced immutable |
| `ConsentRecord` | Duration of consent + 1 year | PDPL 2025 Art. 9 | YES -- trigger-enforced immutable |
| Customer PII post-churn | 24 months | Decree 53/2022 | YES -- `Customer.deletedAt` + anonymization sweeper |
| Promotional records | 3 years | MOIT rules | YES |
| Support tickets | 2 years post-resolution | Internal policy | Soft |
| `OtpAttempt` | 90 days | Internal policy | Soft |

**Note.** PII columns on `Customer` and `Booking` must remain nullable to support the anonymization sweeper (referenced as issue 090 in risk-register). Migrations must not add NOT NULL constraints without defaults to PII columns on these models.

### 4.2 Data Residency

Vietnamese user PII must be stored on servers physically in Vietnam (Decree 53/2022, Cybersecurity Law 2018, Law 116/2025 effective 1 July 2026). Decree 356/2025 expressly categorizes use of foreign cloud services as cross-border transfer regardless of physical server location.

**Current state.** PostgreSQL is hosted outside Vietnam (Vercel Singapore). This is a known compliance violation. Migration to Vietnam-hosted infrastructure (FPT Cloud, Viettel IDC, or VNG Cloud) is planned. The existing Prisma `directUrl` PgBouncer configuration is a compatibility bridge for the infrastructure migration.

**Migration implications:**
- Any migration adding a new PII column to an existing table expands the data residency violation scope until the Vietnam-hosted DB is in place.
- The infrastructure migration (overseas PG to Vietnam PG) must preserve all data -- especially immutable `LedgerEntry` rows and 10-year `EInvoice` archive. No truncate-and-repopulate approach.
- Minimum retention in Vietnam: 24 months post-churn, combined with residency.

### 4.3 PII Column Rules

Under PDPL 2025 (Law No. 91/2025/QH15, effective 1 January 2026), schema changes involving PII carry procedural obligations.

| PII Action | Obligation | Timeline |
|-----------|-----------|----------|
| Add new PII column | DPIA amendment required | Within 10 days of material change |
| Add new sensitive data column (financial, location, national ID) | Separate explicit consent gate + column-level encryption | Before production deploy |
| New data category to overseas processor (Vercel, Upstash, Resend) | CDTIA amendment | Before production deploy |
| PII column on any model | Add to logger redaction list | Same commit as column introduction |
| Phone number in new table | Exclude from application-level log output; never duplicate in JSON payload fields (I9 invariant) | Same commit |

**Sensitive data classifications** (ADR-008): `@pii:T1` (personal identifiers -- name, phone, email) and `@pii:T2` (financial -- payment details, bank account numbers, CCCD). T2 fields require AES-256-GCM encryption at rest. New T2 fields must include encryption from the moment of introduction, not retroactively.

**Anonymization compatibility.** The `Customer` soft-delete flow uses `deletedAt` + `anonymizedAt` timestamps. The anonymization sweeper nullifies PII columns after the 24-month post-churn retention window while preserving the row and its financial foreign key relationships for the 5-year booking retention period. Migrations must not break this flow by adding non-nullable PII columns without defaults.

### 4.4 Compliance-Driven Schema Debt

The following schema changes are required by regulation but not yet implemented. Migrations must not remove or rename columns that serve as placeholders for these obligations.

| Pending Migration | Regulatory Driver | Current State |
|------------------|-------------------|--------------|
| Add transport e-invoice fields: `vehiclePlateNumber`, `departureCityCode`, `destinationCityCode` to `EInvoice` | Decree 70/2025 (effective 1 June 2025) | **OVERDUE** -- MISA integrated for generic invoices but transport-specific fields missing |
| Add `taxCode` (MST) column to `Operator` | Decree 70/2025 | Missing |
| Add `chargeback` to `BookingStatus` enum + ledger entry automation | VNPay/MoMo contract terms (45-90 day chargeback window) | No operational workflow exists |
| Column-level encryption for `PayoutAccount.accountNumber` | PDPL 2025 (sensitive financial PII) | Stored in plaintext -- encryption pending |
| Add `licenseExpiry` to `KybDocument` or `Operator` | Transport license compliance (Giay phep kinh doanh van tai) | Missing -- needed for 60-day expiry alert cron |
| Implement tax withholding service functions | Decree 117/2025, E-Commerce Law 2025 (effective 1 July 2026) | Schema exists (`Payout.taxVat`/`taxPit`/`taxTotal`, `TaxClassification` enum) but zero service functions |

**Rule.** Do not remove `Payout.taxVat`, `Payout.taxPit`, `Payout.taxTotal`, or `TaxClassification` enum -- these columns are legally required even though service implementation is pending.

---

## 5. Deployment and Timing

### 5.1 Stage 0 -- Current

Single Next.js app deploys with schema migrations as part of the same pipeline. No separate migration deployment step. The 99.5% monthly uptime target (ADR-002) provides ~3.6 hours/month downtime budget, explicitly sized to cover one planned maintenance window (schema migration) plus one unplanned incident (ADR-020).

**Constraint.** The database (single PG instance + daily backups) is the single point of failure. A failed migration during business hours could consume most of the monthly downtime budget. PgBouncer connection pooling is mandatory -- serverless instances each need a DB connection.

### 5.2 Tet Freeze

During the 2-week Tet window, the availability target escalates to 99.9% (ADR-002). Deployments are frozen, pre-provisioned read replica is active, 2-minute detection monitoring is enabled.

**Rule.** No schema migrations during the Tet window. Pre-Tet cutoff is when all pending schema changes must be deployed or deferred to post-Tet. Plan accordingly -- the Tet window is the highest-revenue period.

### 5.3 Stage 1 -- Read Replica

When a read replica is added (triggered by jobs exceeding 30 s latency), migrations must be replica-safe: no long table locks that would cause replication lag.

| Migration Type | Stage 0 | Stage 1+ |
|---------------|---------|---------|
| `ALTER TABLE ADD COLUMN` (nullable) | Safe | Safe -- no table rewrite |
| `ALTER TABLE ADD COLUMN` (NOT NULL + default) | Safe | Safe in PG 11+ -- metadata-only |
| `CREATE INDEX` | Locks table | Use `CREATE INDEX CONCURRENTLY` |
| `ALTER TABLE DROP COLUMN` | Two-phase | Two-phase + verify replica has caught up |
| Full table rewrite (`ALTER COLUMN TYPE`) | Acceptable with downtime | Schedule during maintenance window |

**Advisory lock interaction.** Hold creation and capacity guards use `pg_advisory_xact_lock` on `Trip` and `Hold` tables (ADR-009). DDL that acquires `ACCESS EXCLUSIVE` locks on these tables during peak booking times will serialize against in-flight advisory lock transactions. Schedule DDL on capacity-critical tables during low-traffic windows.

### 5.4 Stage 2 -- Domain Extraction

When a domain module is extracted to a separate service (triggered by module exceeding 50% CPU or search p95 exceeding 200 ms), schema splits follow the module boundaries established by `eslint-plugin-boundaries` (ADR-016). Shared tables (e.g., `Customer`, `Place`) require cross-service coordination for schema changes.

**Rule.** The barrel-based module boundaries are designed to make this extraction mechanical. Migrations at this stage must coordinate across service teams -- a migration on a shared table affects all consuming services.

---

## 6. Sweeper and Cron Table Rules

Background sweepers (hold expiry, payout settlement, notification dispatch) use `FOR UPDATE SKIP LOCKED` in batches of 500 (ADR-012). Schema changes to swept tables must preserve this pattern.

### 6.1 Predicate Columns Must Be Top-Level

Any field used as a WHERE-clause predicate for a cron/sweeper/sentinel-poll query must be a top-level indexed column on its model, never a JSON-payload key (Issue 014 lesson).

| Sweeper | Predicate | Required Index |
|---------|-----------|---------------|
| `settlePayout` | `status = 'requested' AND scheduledAt <= NOW()` | `@@index([status, scheduledAt])` on `Payout` |
| `notificationDispatch` | `template = X AND scheduledFor <= NOW()` | `@@index([template, scheduledFor])` on `NotificationLog` |
| `holdExpiry` | `status = 'active' AND expiresAt <= NOW()` | `@@index([status, expiresAt])` on `Hold` |

**Rule.** When introducing a "scheduled work" log row, declare the predicate column and its composite index `@@index([template, <predicateColumn>])` in the same migration. Greppable smell: `payload->>'fieldName'` in any `app/api/cron/**` file flags a future sequential scan that should be promoted to a column.

### 6.2 Sweeper Table Schema Changes

New tables polled by sweepers must have composite indexes covering the sweeper's WHERE clause predicates to ensure index-scan queries (not sequential scans) when no work exists. The `JobRunLog` table (cron execution audit trail) is append-friendly and must never be truncated.

**Batch sizing.** The 500-row batch limit bounds transaction duration, preventing long-running transactions from blocking DDL. This is a favorable property for migrations: sweeper transactions are short-lived, so DDL waits are bounded.

---

## 7. Pre-Merge Verification Checklist

Every migration PR must pass these checks before merge.

| # | Check | How to Verify |
|---|-------|--------------|
| 1 | Schema-parity: non-partial indexes declared in both DSL and SQL | Manual side-by-side audit of `@@index` in `schema.prisma` vs `CREATE INDEX` in `migration.sql` |
| 2 | NOT NULL column: all create call sites include new column | `grep -r "prisma\.<model>\.create" lib/ app/ e2e/ prisma/seed.ts __tests__/` and `grep -r "INSERT INTO \"<Model>\"" e2e/ prisma/ __tests__/` |
| 3 | CHECK constraint: validated against every insert path | Same grep as #2; confirm constraint holds for each call site's data shape |
| 4 | Timestamp + status co-write: new timestamp columns paired with status enum | Grep for `<verb>At` writes; verify `status:` write within 3 lines in same `tx.model.update` |
| 5 | DTO union update: new status values added to DTO type union | tsc `--noEmit` must pass; positive test assertion on new status value in same commit |
| 6 | Immutability triggers survive: `LedgerEntry`, `ConsentRecord`, `AdminAuditLog` | Verify trigger exists after migration via `\dS+ <table>` or `SELECT tgname FROM pg_trigger WHERE tgrelid = '<table>'::regclass` |
| 7 | Idempotency constraints preserved | Verify `@@unique` and partial unique indexes exist after migration |
| 8 | PII column: added to logger redaction list | Grep logger configuration for new column name; must appear in redaction list |
| 9 | PII column: DPIA amendment filed | Procedural -- confirm with DPO within 10 days of material change |
| 10 | No Tet-window deployment | Calendar check -- no merge during 2-week Tet freeze |
| 11 | Committed migration checksum integrity | Never edit a committed migration file; only forward-fix |
| 12 | Prisma 7.x CLI awareness | Read `node_modules/.bin/prisma migrate diff --help` before quoting any verification command |
| 13 | Capacity-guard raw SQL compatibility | Grep `$queryRaw` references to affected columns; verify raw SQL still valid after rename/type change |
| 14 | Sweeper predicate columns top-level | No `payload->>'field'` predicates in cron queries; predicate column + composite index in same migration |
