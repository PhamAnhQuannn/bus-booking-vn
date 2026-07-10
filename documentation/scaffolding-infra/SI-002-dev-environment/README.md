# SI-002: Developer Environment Setup

> Status: DOCUMENTED | References: ADR-001, ADR-005, ADR-007, ADR-008, ADR-012, ADR-013, ADR-016, ADR-020, DS-002, DS-004, DS-006, DS-008, DS-009, DS-012, DS-013, DS-017

## Purpose

This document consolidates everything a developer needs to bring up a fully functional local environment for the BenXe bus booking platform. It covers the prerequisite toolchain, local database and cache setup, dev server configuration, environment variable schema, stub/real mode switching for all external integrations, the Prisma migration workflow, seed data management, and known pitfalls specific to this codebase. Rather than duplicating the rationale in the referenced ADRs, this guide cross-references their decision IDs and adds the practical "how to run it" layer that ADRs intentionally omit.

---

## 1. Prerequisites

| Tool | Minimum Version | Purpose |
|------|----------------|--------|
| Node.js | 20 (LTS) | Runtime; matches the production Docker image (`node:20-alpine`, ADR-020 D8) |
| pnpm | 9+ | Package manager; workspace protocol used throughout |
| Docker Desktop | 24+ | Runs the local PostgreSQL and Redis containers (ADR-020 D3) |
| Git | 2.39+ | Source control; Windows-specific constraints apply (see Section 8) |

PostgreSQL and Redis are **not** installed locally as native services. Both run inside Docker Compose to match the production database configuration. Do not install native PostgreSQL on the dev machine -- port conflicts with the Docker container will occur.

---

## 2. Local Database Setup

### 2.1 Docker Compose Services

The repository ships a `docker-compose.dev.yml` that starts two services:

- **PostgreSQL** -- exposed on `localhost:5432` with a second PgBouncer sidecar on `localhost:6432`
- **Redis** -- exposed on `localhost:6379`

Start the dev stack:

```
docker compose -f docker-compose.dev.yml up -d
```

Stop without removing volumes:

```
docker compose -f docker-compose.dev.yml stop
```

The dev stack uses local named Docker volumes so that data persists between `docker compose stop` / `up` cycles. Data is intentionally lost when volumes are explicitly removed.

### 2.2 Connection URLs

The application uses two PostgreSQL connection strings (ADR-020 D8):

| Variable | Port | Purpose |
|----------|------|--------|
| `DATABASE_URL` | `localhost:6432` (PgBouncer) | All runtime Prisma queries; connection-pooled |
| `DIRECT_URL` | `localhost:5432` (direct PG) | Prisma CLI migrations and schema introspection only |

Both must be set in `.env.local`. Prisma migrations (`prisma migrate dev`) use `DIRECT_URL` internally so that DDL runs outside the connection pool -- PgBouncer transaction mode does not support the multi-statement DDL that migrations emit.

### 2.3 Creating `.env.local`

Copy the example file and fill in values:

```
cp .env.local.example .env.local
```

The Zod boot-time validator (`lib/config/env.ts`, described in Section 4) will print a structured error listing every missing variable on first run. Start the dev server, read the error, and fill in the gaps iteratively.

---

## 3. Dev Server

### 3.1 Port

The dev server runs on **port 3001**, not the Next.js default of 3000. Port 3000 is occupied by a separate local application on this machine (documented in project memory). Starting on 3001 is enforced via the `dev` script in `package.json`:

```
pnpm dev
```

This launches Next.js with Turbopack in development mode on `:3001`.

### 3.2 Turbopack

The `dev` script passes `--turbopack`. Turbopack is the incremental bundler used in development. Two known Turbopack constraints apply to this repo:

1. The `.claude/` directory must remain in `.gitignore`. If `.claude/` is ever committed or made visible to Turbopack's file watcher, the Tailwind CSS crawler escapes the project root and causes a 500 error on every route (see Section 8.1).
2. Turbopack does not pick up Prisma client changes made after the server started. After every `prisma generate` invocation, the dev server must be restarted and the `.next/dev` cache must be cleared (see Section 6.4).

### 3.3 Three Surfaces

All three user-facing surfaces are served from the single Next.js process:

| URL path | Surface |
|----------|--------|
| `http://localhost:3001/` | Customer booking (search, seat selection, payment, tickets) |
| `http://localhost:3001/op/` | Operator console (fleet, trips, bookings, reports) |
| `http://localhost:3001/admin/` | Admin portal (approvals, finance, moderation) |

This mirrors the production topology (ADR-020 D1) where a single app serves all three route groups.

---

## 4. Environment Variables

### 4.1 Zod Boot Validation (ADR-020 D4)

All environment variables are declared and validated in `lib/config/env.ts` using a Zod schema with `superRefine` guards. The application **fails immediately at startup** if required variables are missing or malformed. This is intentional -- runtime credential errors that surface only when a specific code path is hit are far harder to debug than a structured startup error.

Key behavior:

- Switching any integration from stub to real mode (e.g., `PAYMENTS_STUB=false`) causes the validator to require the corresponding real credentials. If those credentials are absent, the server refuses to start with a clear error message.
- The Zod validator also detects sandbox/test credentials being used in a production context (e.g., VNPay sandbox `tmnCode` in a non-stub environment) -- partially implemented; full audit required before Issue 094 go-live (ADR-020 D4).

### 4.2 Variable Groups

| Group | Key Variables | Notes |
|-------|--------------|------|
| Database | `DATABASE_URL`, `DIRECT_URL` | PgBouncer pooled and direct PG respectively |
| Redis | `REDIS_PROVIDER`, `REDIS_URL` | `memory` provider for single-node dev; `ioredis` + `REDIS_URL` for Docker Redis |
| Auth and Signing | `JWT_SECRET`, `CSRF_SECRET`, `HOLD_SECRET`, `CRON_SECRET`, `REFRESH_TOKEN_SECRET`, `TOTP_ENCRYPTION_KEY` | 6 distinct secrets; all must be set even in local dev. `REFRESH_TOKEN_SECRET` is shared across all three realms (FI-001 Known Gap: per-realm split pending). `TOTP_ENCRYPTION_KEY` encrypts admin TOTP secrets at rest (AES-256-GCM) |
| Payments | `PAYMENTS_STUB`, `MOMO_*`, `VNPAY_*` | Stub mode bypasses real PSP (Section 5.1) |
| Payments (SePay/VietQR) | `SEPAY_API_KEY`, `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NUMBER`, `VIETQR_ACCOUNT_NAME`, `VIETQR_TEMPLATE` | Bank-transfer webhook + QR generation (DS-013). Stub-bypassed when `PAYMENTS_STUB=true` |
| Payments (ZaloPay) | `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_ENDPOINT`, `ZALOPAY_ENABLED` | P2 feature (DS-008). Not required for local dev |
| Payments (Feature Flags) | `SPLIT_SETTLEMENT_ENABLED` | Split-settlement feature flag (DS-009). Default off; not yet implemented |
| Notifications | `NOTIFY_STUB`, `ESMS_API_KEY`, `ESMS_SECRET_KEY`, `ESMS_BRAND_NAME`, `ESMS_SANDBOX`, `ESMS_OTP_SMSTYPE`, `ESMS_BASE_URL` | Stub mode suppresses all SMS dispatch (Section 5.2). For real-mode activation see `guides/esms-registration-guide.md` |
| Email | `EMAIL_PROVIDER`, `RESEND_API_KEY` | `stub` provider for dev (Section 5.3) |
| E-Invoice | `EINVOICE_ENABLED`, `MISA_CLIENT_ID`, `MISA_CLIENT_SECRET`, `MISA_INVOICE_TEMPLATE_CODE`, `MISA_TRANSPORT_TEMPLATE_ID` | `stub` skips MISA meInvoice API calls (Section 5.4). `MISA_TRANSPORT_TEMPLATE_ID` selects Decree 70/2025 transport template (DS-012 §6.4) |
| Storage | `STORAGE_STUB`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Stub returns local signed URLs (Section 5.5) |
| Cron and Jobs | `CRON_SECRET`, `HOLD_SWEEPER_MODE` | `CRON_SECRET` required for cron endpoint auth. `HOLD_SWEEPER_MODE` defaults to `'update'` (active sweep). Dev `.env.local` overrides to `'count'` (dry-run). Verify production does not override to `'count'` (DS-006 §23) |
| Observability | `SENTRY_DSN` | Sentry SDK not yet integrated; variable accepted by Zod but unused (ADR-007 D1) |

### 4.3 Secrets Management in Dev

In local development, secrets are stored in `.env.local` which is gitignored. Never commit `.env.local` or any file containing real credentials. The `.env.local.example` file contains placeholder values safe to commit.

For the seed admin password, see Section 7.2: the seed script (`scripts/seed/seed-admin.ts`) now uses `genTempPassword()` instead of the former hardcoded `123456`. This go-live blocker (Issue 113) is resolved.

---

## 5. Stub / Real Mode Switching (ADR-020 D5)

All external integrations support a stub mode that provides the same programmatic interface with no-op or local implementations. This allows the complete booking flow -- including payment, notification, e-invoice, and file upload -- to run in local development without real PSP credentials, SMS costs, or API subscriptions.

The stub/real boundary is enforced at the interface level: every integration exposes the same TypeScript interface in both modes. Swapping a toggle does not change application logic, only the underlying implementation.

### 5.1 Payments (`PAYMENTS_STUB`)

| Value | Behavior |
|-------|--------|
| `PAYMENTS_STUB=true` (default for dev) | Local stub gateway returns configurable payment outcomes; no real money moved; MoMo and VNPay adapters are bypassed |
| `PAYMENTS_STUB=false` | Real VNPay and MoMo adapters active; requires `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` to be set or server refuses to start |

The payment architecture (ADR-005 D1) describes the split-settlement model, but this is **not yet implemented** -- the current model is central collection (ADR-004 D2, ADR-010 D4). The `SPLIT_SETTLEMENT_ENABLED` feature flag (DS-009) controls the future transition. In stub mode, ledger writes still execute using the central-collection schema -- only the PSP HTTP calls are suppressed. This means ledger behavior is testable in stub mode without a PSP merchant account.

The full defense stack (HMAC verification, idempotency unique constraint, amount guard -- ADR-005 D4) is exercised in integration tests even in stub mode. The stub gateway emits correctly signed webhook payloads for test realism.

### 5.2 Notifications (`NOTIFY_STUB`)

| Value | Behavior |
|-------|--------|
| `NOTIFY_STUB=true` (default for dev) | NotificationLog rows are written with `status='pending'` but the dispatch cron does not call eSMS or Zalo ZNS; log output shows what would have been sent |
| `NOTIFY_STUB=false` | Real eSMS dispatch active; requires `ESMS_API_KEY`, `ESMS_SECRET_KEY`, `ESMS_BRAND_NAME`; charges apply per SMS sent |

For step-by-step eSMS activation (sandbox testing, credential setup, common errors), see [`guides/esms-registration-guide.md`](../../guides/esms-registration-guide.md).

The notification architecture uses a cron-based outbox (ADR-013 D4). In stub mode the outbox rows still accumulate correctly, allowing end-to-end testing of the notification pipeline without incurring eSMS costs. The `after()` acceleration path for time-critical notifications (OTP, booking confirmation SMS, trip cancellation SMS -- ADR-013 D4 exemption) is also suppressed in stub mode.

The I9 invariant (ADR-013 D7) -- phone number stored in `recipient` column only, never in JSON payload -- is enforced regardless of stub mode, since the NotificationLog rows are written identically in both modes.

### 5.3 Email (`EMAIL_PROVIDER`)

| Value | Behavior |
|-------|--------|
| `EMAIL_PROVIDER=stub` (default for dev) | Email dispatch is a no-op; no HTTP call to Resend; log line shows template and recipient |
| `EMAIL_PROVIDER=resend` | Real Resend API calls; requires `RESEND_API_KEY` |

Email is the tertiary notification channel for Vietnamese travelers (ADR-013 D3) -- used primarily for PDF ticket attachments and VAT invoice delivery. In local dev, stub mode is always sufficient.

### 5.4 E-Invoice (`EINVOICE_ENABLED`)

| Value | Behavior |
|-------|--------|
| `EINVOICE_ENABLED=stub` (default for dev) | MISA meInvoice API calls are suppressed; EInvoice rows are written to the database with `status='stub'` |
| `EINVOICE_ENABLED=misa` | Real MISA meInvoice API active; requires `MISA_CLIENT_ID`, `MISA_CLIENT_SECRET`, `MISA_INVOICE_TEMPLATE_CODE` |

E-invoice integration is mandatory under Decree 123/2020 and Decree 70/2025 for production. In local dev, stub mode avoids the need for a MISA test account. Transport-specific e-invoice fields (`vehiclePlateNumber`, `departureCityCode`, `destinationCityCode`) required by Decree 70/2025 are tracked as pending schema work in DS-012.

### 5.5 Storage (`STORAGE_STUB`)

| Value | Behavior |
|-------|--------|
| `STORAGE_STUB=true` (default for dev) | Pre-signed URLs are generated locally without calling an S3-compatible endpoint; uploaded files are not persisted |
| `STORAGE_STUB=false` | Real S3-compatible calls; requires `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` |

In production, storage targets Cloudflare R2 (S3-compatible). In stub mode the SDK is not invoked.

### 5.6 Switching Rules

- Switching any toggle from stub to real mode requires restarting the dev server so the Zod boot validator re-reads `.env.local`. Clear `.next/dev` before restarting (same as Section 6.4 Prisma workflow) to avoid stale cached behavior.
- The validator's `superRefine` guards fail fast if real mode is requested without the corresponding credentials -- the error message names the specific missing variable.
- Never set `PAYMENTS_STUB=false` or `NOTIFY_STUB=false` in a shared or CI environment without ensuring the corresponding credentials are set in that environment's secret store.

---

## 6. Prisma Workflow

### 6.1 Schema as Source of Truth

`prisma/schema.prisma` is the single source of truth for the domain model (ADR-001 D3). The schema file defines tables, columns, relations, enums, and non-partial indexes. Raw SQL migration files supplement the schema for constructs the Prisma DSL cannot express (partial indexes, CHECK constraints, database triggers).

The schema-parity invariant (DS-002) requires that every non-partial index appear in **both** `schema.prisma` as `@@index(...)` and in the corresponding `migration.sql` as `CREATE INDEX`. Partial indexes (`WHERE` clause) and CHECK constraints are SQL-only; Prisma silently ignores them in its schema diff.

### 6.2 Running Migrations

Apply pending migrations to the local dev database:

```
pnpm prisma migrate dev
```

This command uses `DIRECT_URL` (not `DATABASE_URL`) to connect directly to PostgreSQL, bypassing PgBouncer. It applies any unapplied migration files in `prisma/migrations/` in order, then regenerates the Prisma client.

To create a new migration after editing `schema.prisma`:

```
pnpm prisma migrate dev --name descriptive-name-here
```

### 6.3 Generating the Prisma Client

After any schema change -- whether applying a migration or editing `schema.prisma` directly -- regenerate the typed Prisma client:

```
pnpm prisma generate
```

This is also run automatically by `migrate dev`, but must be run manually if you edit `schema.prisma` without running a migration.

### 6.4 Restarting the Dev Server After Schema Changes

After `prisma generate`, the dev server **must be restarted** and the `.next/dev` cache must be cleared. Without this step, the running Next.js process continues using the old generated client from memory, causing `Unknown field` runtime errors even though `tsc --noEmit` and test runs see the updated types.

```
# Stop the dev server (Ctrl+C in the terminal running pnpm dev)
# Clear the Turbopack dev cache
rm -rf .next/dev
# Restart
pnpm dev
```

### 6.5 Migration Authoring Rules (DS-002)

Key rules from DS-002 that affect day-to-day development:

- **Forward-only**: never write a DOWN migration. If a migration is wrong, write a new forward migration to correct it. Never edit a committed migration file -- Prisma detects the checksum mismatch and refuses to run subsequent migrations.
- **NOT NULL column checklist**: when adding a NOT NULL column to any existing model, grep every `prisma.<model>.create` call site and every raw `INSERT INTO` statement across `lib/`, `app/`, `e2e/`, `prisma/seed.ts`, and `__tests__/` before merging. Every hit must include the new column. See SI-005 Section 6.1 for the full checklist.
- **Timestamp + status co-write**: any service writing a `<verb>At` timestamp column must also write the corresponding `status` enum value in the same `tx.model.update` call.
- **Prisma 7.x CLI awareness**: the `prisma migrate diff --from-schema-datamodel --to-schema-datasource` flags were removed in Prisma 7.x. Before quoting any CLI verification command, read `node_modules/.bin/prisma migrate diff --help` for current flag names.

### 6.6 Immutability Triggers

Four tables (`LedgerEntry`, `ConsentRecord`, `AdminAuditLog`, `EInvoice`) are append-only and protected by PostgreSQL `BEFORE UPDATE OR DELETE` triggers. See SI-001 §6.8 for the canonical list and invariant details.

**Dev-specific concern:** any `ALTER TABLE` migration on these tables must verify the trigger survives. Table-rename and `CREATE TABLE ... AS SELECT` patterns can silently drop triggers (DS-002).

---

## 7. Seed Data

### 7.1 Running the Seed

The seed script populates the database with development fixtures: operators, buses, routes, trips, and a default admin user.

```
pnpm prisma db seed
```

The seed is defined in `prisma/seed.ts` and uses `prisma.<model>.create` calls. It is **not** run automatically by `migrate dev` -- it must be invoked separately.

### 7.2 Admin Seed Password

The seed creates an admin user using `genTempPassword()` (in `scripts/seed/seed-admin.ts`), which generates a random temporary password logged to the console on first run. The former hardcoded `123456` has been removed. Do not reintroduce hardcoded passwords in any environment.

### 7.3 LedgerEntry Append-Only Constraint Requires DROP SCHEMA for Reseed

The `LedgerEntry` table is protected by a `BEFORE UPDATE OR DELETE` immutability trigger at the PostgreSQL level. Because the trigger prevents deletion, the standard `prisma migrate reset` command (which truncates tables) **cannot** clear the ledger. If the ledger accumulates data from a destructive crawl or test run that you need to remove, the only path is:

```
# Drop the entire schema and recreate it
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
pnpm prisma migrate dev
pnpm prisma db seed
```

This drops all Docker volumes, recreating a fresh PostgreSQL instance. Plan accordingly when running end-to-end tests or automated scripts that write ledger entries.

### 7.4 PII-Safe Seed Placeholders

Phone number placeholders in seed data must use a format that does not match the project's PII detection regex (`.gitleaks.toml` pattern `\+84[35789]\d{8}`). Valid mobile-prefix all-digit strings trip the detection rule. Use literal-x masks such as `+8490xxxxxx1` -- the `\d{8}` pattern cannot consume `x` characters.

---

## 8. Known Pitfalls

### 8.1 `.claude/` Junction Causes Turbopack Panic

The `.claude/` directory at the project root must remain listed in `.gitignore`. If `.claude/` is committed or otherwise made visible to Turbopack's file crawler, the Tailwind CSS content scan escapes the project root and follows symlinks/junctions into unrelated directories. This causes a 500 error on every route with no actionable stack trace.

Fix: ensure `.claude/` is in `.gitignore`, restart the dev server, and clear `.next/dev`.

### 8.2 `git mv` Fails While Dev Server Runs (Windows)

On Windows, `git mv app/<dir>` for Next.js route group directories fails with `Permission denied` while the dev server process has those directories open.

Workaround:

1. Stop the dev server (Ctrl+C in the terminal running `pnpm dev`).
2. Use PowerShell `Move-Item` (not `git mv`) to move the directory.
3. Stage the result with `git add -A` and commit normally.
4. After the move, clear `.next/dev` before restarting the dev server to avoid stale route caches.

### 8.3 Port 3000 Conflicts

Port 3000 is occupied by a separate application on the primary dev machine. The `pnpm dev` script passes `--port 3001` explicitly. If you see errors about port 3001 also being in use, check for a zombie Next.js process from a previous session.

### 8.4 Server Component Self-Fetch Anti-Pattern

Server components must not self-fetch their own API routes (e.g., `fetch('http://localhost:3001/api/...')`). The mandatory pattern: extract a shared `lib/` function and call it from both the route handler and the server component in-process. Header-derived base URLs (`x-forwarded-proto`/`host`) are not an acceptable long-term solution. See Mistake Log Issues 002 and 003 for the full history and hardened rule.

### 8.5 BigInt in Currency Computations

All monetary values are VND integers. Fractional-rate multiplication must use BigInt arithmetic with `BigInt(n)` constructor calls (not the `n` literal suffix, which is a parser error under `--target es2017`). See SI-001 §1 for the canonical rule and the `calcPayout` encoding pattern.

### 8.6 Client Component Barrel Import Rule (ADR-016 D3)

`'use client'` components must deep-import client-safe modules — never the domain barrel. Importing `@/lib/auth` (barrel) instead of `@/lib/auth/csrfClient` (deep, client-safe) pulls server-only transitive dependencies (`pg`, `server-only`, `next/server after()`) into the client bundle, causing a **500 error on every route** served by that layout or page. This is the highest-severity dev pitfall in the codebase — the entire operator console (`/op/**`) went down when a codemod accidentally barrel-converted client components (Mistake Log: operator-smoke).

Greppable CI guard (must return zero matches):

```
grep -rln "from ['\"]@/lib/auth['\"]" app components | while read f; do head -1 "$f" | grep -q "use client" && echo "$f"; done
```

The established pattern: all `app/op/(console)/**` and `app/admin/(console)/**` client components import `readCsrfToken` from `@/lib/auth/csrfClient`, never from `@/lib/auth`. See ADR-016 D3 for the full rule.

### 8.7 Tet Deployment Freeze

A 2-week deployment freeze applies annually during the Tet holiday period. No non-critical merges or deployments during this window. A pre-freeze checklist is required before the window opens. See DS-004 §9.1 for the full checklist and freeze rules.

---

## 9. Redis Configuration

The Redis provider is selected via `REDIS_PROVIDER`:

| Value | When to use |
|-------|------------|
| `memory` | Single-process dev; no Docker Redis needed; state is lost on restart |
| `ioredis` | Docker Redis running; requires `REDIS_URL=redis://localhost:6379`; state persists between restarts |
| `upstash` | Upstash HTTP REST (Vercel/edge-compatible); not used for local dev |

For BullMQ (job queue, Stage 1+) the `ioredis` provider is mandatory -- BullMQ requires a TCP Redis connection and does not work with the `memory` or `upstash` providers.

---

## 10. Cron Endpoints in Development

Background cron jobs are triggered by HTTP calls to `/api/cron/*` endpoints authenticated with `Authorization: Bearer <CRON_SECRET>` (ADR-020 D9). In local dev, you can trigger cron jobs manually:

```
curl -H "Authorization: Bearer <your_CRON_SECRET>" http://localhost:3001/api/cron/hold-expiry
```

Replace `<your_CRON_SECRET>` with the value from `.env.local`. Manual curl invocations are sufficient for testing individual job handlers. In production, Vercel Cron triggers these endpoints on schedule (see `vercel.json`). See SI-006 Section 5 for the complete job catalog.

**`HOLD_SWEEPER_MODE` note:** The hold-expiry cron (`/api/cron/hold-expiry`) defaults to `HOLD_SWEEPER_MODE='update'` (active sweep — expires holds and releases capacity). Dev `.env.local` overrides to `'count'` (dry-run — counts but does not transition). To test actual hold expiry in local dev, set `HOLD_SWEEPER_MODE='update'` in `.env.local`. Production deploys use the default `'update'` — verify it is not overridden to `'count'` (DS-006 §23, FI-005, FI-006).

---

## Cross-References

### Architecture Decision Records

- **ADR-001** -- Stack decisions: Next.js App Router, PostgreSQL, Prisma, hosting rationale
- **ADR-005** -- Payment architecture: PSP stub/real modes, BigInt currency math, ledger design (D1 split-settlement NOT_IMPLEMENTED)
- **ADR-007** -- Observability: Sentry SDK not yet integrated (D1)
- **ADR-008** -- Security posture: CSRF double-submit, HTTP security headers (NOT_CONFIGURED), tenant isolation
- **ADR-012** -- Cron architecture: hybrid `after()`+cron model, partially implemented job catalog
- **ADR-013** -- Notification architecture: `NOTIFY_STUB`, eSMS provider selection, I9 PII invariant, cron outbox
- **ADR-016** -- Module boundaries: barrel import rule, `'use client'` deep-import mandate (D3 — Section 8.6)
- **ADR-020** -- Deployment and infrastructure: Zod boot validation (D4), stub/real mode table (D5), provider-agnostic deployment contract (D8)

### Design Specifications

- **DS-002** -- Migration strategy: forward-only policy, schema-parity invariant, NOT NULL checklist, immutability triggers
- **DS-004** -- Operations: Tet deployment freeze (§9.1)
- **DS-006** -- Background jobs: `HOLD_SWEEPER_MODE` dry-run default, cron catalog (§23 go-live blocker)
- **DS-008** -- ZaloPay integration: env vars for P2 PSP (deferred)
- **DS-009** -- Split-settlement: `SPLIT_SETTLEMENT_ENABLED` feature flag (not implemented)
- **DS-012** -- Transport e-invoice: Decree 70/2025 field requirements, `MISA_TRANSPORT_TEMPLATE_ID`
- **DS-013** -- SePay/VietQR: bank-transfer webhook, QR generation env vars
- **DS-017** -- Deployment portability: `DIRECT_URL` vs `DATABASE_URL`, `REDIS_PROVIDER`

### Scaffolding and Infrastructure

- **SI-001** -- Project Scaffold: stack overview, module architecture, multi-tenancy model
- **SI-003** -- CI/CD Pipeline: how lint, type-check, and tests run in the pipeline
- **SI-005** -- Testing Strategy: NOT NULL column checklist, migration testing details
- **SI-006** -- Deployment Configuration: production environment setup

### Guides

- **[eSMS Registration Guide](../../guides/esms-registration-guide.md)** -- Step-by-step eSMS activation: sandbox testing, credential setup, common errors

---

## Known Gaps

| ID | Gap | Go-Live Blocker? | Status | Source |
|----|-----|-----------------|--------|--------|
| KG-01 | `superRefine` production guard does not enforce minimum-length requirements for all secrets (e.g., `HOLD_SECRET`) | Yes (Issue 094) | NOT_IMPLEMENTED | ADR-020 D4; see also SI-006 Known Gaps |
| KG-03 | `OperatorUser.tempPasswordPlain` column — removed via migration 20260615000000 | No | RESOLVED | SI-001 |
| KG-04 | ZNS (Zalo ZNS) integration documented in ADR-013 D1 not yet implemented. SMS via eSMS is the actual primary channel. `NOTIFY_STUB` controls eSMS only | No (deferred) | DEFERRED | ADR-013 D1 |
| KG-05 | `HOLD_SWEEPER_MODE` defaults to `'update'` (active sweep). Dev overrides to `'count'`. Verify production does not override. | No | IMPLEMENTED | DS-006 §23, FI-005, FI-006 |
| KG-06 | Sentry SDK not yet integrated — `SENTRY_DSN` accepted by Zod but unused | No | NOT_IMPLEMENTED | ADR-007 D1 |
| KG-07 | 3 cron jobs not yet implemented: `paymentReconSweeper`, `operatorLicenseAlert`, `piiAnonymization` | Medium | NOT_IMPLEMENTED | ADR-012, SI-006 §5.2 |
| KG-08 | Shared `REFRESH_TOKEN_SECRET` across all three auth realms — per-realm split pending | No (security hardening) | PARTIALLY_IMPLEMENTED | FI-001 |
