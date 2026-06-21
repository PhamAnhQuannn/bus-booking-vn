# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles

1. **Think Before Coding** — State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. If something is unclear, stop and ask.
2. **Simplicity First** — Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No error handling for impossible scenarios. If 200 lines could be 50, rewrite it.
3. **Surgical Changes** — Touch only what you must. Don't "improve" adjacent code. Match existing style. Remove imports/variables/functions YOUR changes made unused. Don't remove pre-existing dead code unless asked. Every changed line should trace to the request.
4. **Goal-Driven Execution** — Transform tasks into verifiable goals. State step → verify plans. Strong success criteria let you loop independently.

## Stack

Next.js 16 · React 19 · TypeScript (ES2017 target) · Tailwind v4 · Prisma 7.x · PostgreSQL 16 · Redis 7 · pnpm

## Commands

| Task | Command |
|------|---------|
| Dev server (port 3001) | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Type-check | `pnpm tsc --noEmit` |
| Unit tests | `pnpm test` |
| Integration tests (needs live DB) | `pnpm vitest:int` |
| Unit + integration | `pnpm test:all` |
| E2E (Playwright) | `pnpm test:e2e` |
| Single unit test | `pnpm vitest run path/to/file.test.ts` |
| Single integration test | `pnpm vitest run --config vitest.integration.config.ts path/to/file.int.test.ts` |

Pre-commit hook runs `pnpm lint && pnpm tsc --noEmit`.

## Architecture

```
app/            -->  lib/<domain>/   -->  lib/core/
  (customer)           auth, booking,       db, logger, config
  op/                  payment, ledger,
  admin/               catalog, search,
  api/                 notification, ...
  dev/
components/     -->  lib/<domain>/
proxy.ts             (Edge middleware: auth guards, rate-limit, CSRF)
```

**Dependency flow:** `app/` and `components/` → `lib/<domain>/` → `lib/core/`. No reverse deps. No cycles.

**Module boundaries (ESLint-enforced):**
- Cross-domain imports go through barrel (`lib/<domain>/index.ts`) only
- Intra-domain deep imports are fine
- `lib/core/` and `lib/utils/` are exempt from barrel rule
- **`'use client'` files MUST deep-import client-safe modules** (e.g., `@/lib/auth/csrfClient`, NOT `@/lib/auth` barrel — barrel pulls server-only transitives into client bundle → 500s)

**Path alias:** `@/*` maps to project root.

**Product spec:** `documentation/` — 7 series: ADR (architecture decisions), DS (design specs), FD (frontend design), FI (feature implementation), SI (scaffolding/infra), GL (go-live gates), HD (hardening audits), plus `business/` context. Each spec is a numbered directory with `README.md`. Cross-refs use prefix IDs (ADR-001, DS-006, FI-003, etc.).

## Project Rules

Distilled from the codebase Mistake Log. Full post-mortems in `AGENTS.md`.

### Server Components
- MUST NOT self-fetch own API routes. Extract a lib function; call in-process from both the route handler and the server component.
- RSC render bodies must be pure — no `Date.now()`, `Math.random()`. Extract to module-scope helpers.

### Transactions & Concurrency
- Read-then-write patterns MUST use `prisma.$transaction(async (tx) => ...)` (callback form, not array form) with `SELECT ... FOR UPDATE` on the gating row.
- Timestamp columns for state transitions (`departedAt`, `completedAt`, `cancelledAt`) MUST update the status enum in the same `tx.model.update` call.

### Currency & Math
- All currency math (minor-unit integer × fractional rate) MUST use BigInt. No `Number` multiplication.
- ES2017 target: use `BigInt(n)` constructor, not `1n` literal syntax.

### Timezone
- Business dates use Vietnam UTC+7 (`Asia/Ho_Chi_Minh`).
- Test date derivation must match the timezone the filter uses. Smell: `.toISOString().slice(0, 10)` + service-date query = UTC-vs-local collision.

### Schema Changes
- New NOT NULL column: grep every `prisma.<model>.create` AND every `INSERT INTO "<Model>"` across `e2e/`, `prisma/seed.ts`, `__tests__/` BEFORE merging.
- Raw-SQL indices expressible in Prisma DSL MUST also be declared as `@@index` in `schema.prisma`. Partial/WHERE indices stay SQL-only.
- Committed migrations are never edited. Fix via forward migrations.

### DTOs & Types
- DTO interfaces must mirror every non-relational scalar from the Prisma model in sequence.
- New status enum value → extend DTO union AND add positive test assertion in the same commit.

### Error Handling & Status Codes
- Idempotent operations (AC says 200 + discriminator): use discriminated results from the service layer, not thrown sentinel errors.
- Every error-code variant in a tagged union must have a corresponding `throw` AND a negative-path test.
- Status codes come from issue AC table verbatim, not intuition. When codes change, grep and update every test assertion in the same commit.

### Testing
- `vi.mock()` / `.importActual()` args stay as deep paths after barrel migration. Only rewrite `from '...'` and `import('...')` specifiers.
- When a Prisma query method changes (`findUnique` → `findFirst`, new `where` predicate), update every mock that stubs the old method.
- Hex literals for `Buffer.from(s, 'hex')` must be valid hex of correct byte-width (64 chars for SHA-256).
- E2E: drive form-incidental flows via URL params, not synthetic keystrokes on third-party inputs.
- Assertions on generated output should reference the exported constant/regex, not re-type the pattern.

### Middleware & Cross-Cutting
- New request-gate middleware: grep every non-safe-method caller of `/api/*` (app + lib + e2e) BEFORE merging. Build client-side helper in same commit.
- Cross-cutting gates in Edge middleware encode state into JWT claims (no DB reads). Path allowlists use exact-match `Set`, never prefix-match.

### PII & Secrets
- Phone placeholders: `+8490xxxxxx[N]` format (escapes `.gitleaks.toml` regex).
- New sensitive fields (tokens, proofs): add to logger redact list in the same commit.
- `select` whitelists = exactly the UI contract fields. No filter-only columns.

### Spec Discipline
- Enum/code-list constants driving state machines come from issue AC verbatim. Don't augment from vendor docs.
- Divergent AC status codes for same error: implement both per AC text, add `// SPEC CONFLICT:` comment at each site.
- Cron/sweeper WHERE predicates MUST be top-level indexed columns, never JSON-payload keys.

## Dev Setup

```bash
# 1. Infrastructure
docker compose -f docker-compose.dev.yml up -d   # pg:5432, shadow:5434, redis:6379

# 2. Environment
cp .env.example .env.local

# 3. Database
pnpm prisma migrate deploy
pnpm prisma db seed

# Reseed (LedgerEntry is append-only)
# psql: DROP SCHEMA public CASCADE; CREATE SCHEMA public;
# then re-run migrate deploy + seed
```

Dev server runs on port **3001** (3000 is occupied).

## Working-Track Mistake Log

- **2026-06-21 (WT-20)** — Added `OTP_PEEK_ENABLED` to Zod schema in `lib/config/env.ts`. CI data-leak audit A7 has a scope guard that restricts `OTP_PEEK_ENABLED` references to specific files only (`app/api/auth/otp/test-peek/route.ts`, `lib/auth/operatorOtp.ts`). Adding it to the Zod schema triggered the audit failure. Fix: removed from Zod — it's a runtime dev/test gate, not a boot-time config var. Rule: before adding any env var to the Zod schema, grep the CI audit script (`.github/workflows/`) for scope guards on that var name. Scoped vars stay out of centralized schemas.
- **2026-06-21 (WT-20)** — Added `REFRESH_TOKEN_SECRET` to Zod `superRefine` production-required list but forgot to add it to `.github/workflows/ci.yml` E2E env. CI E2E builds with `NODE_ENV=production` → `next build` prerender hit the Zod gate → build failed. Fix: added `REFRESH_TOKEN_SECRET: ci-test-refresh-secret-not-for-prod-0123` alongside the existing JWT_SECRET/JWT_OPERATOR_SECRET/etc CI vars. Rule: when adding a new var to the Zod production-required superRefine, also add a placeholder value to `.github/workflows/ci.yml` E2E job env in the same commit. Grep `superRefine` production block for the canonical list, then diff against CI env block.

@AGENTS.md
