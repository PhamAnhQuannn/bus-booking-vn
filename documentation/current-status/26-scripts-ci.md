# 26 — Scripts, CI & Infrastructure

---

## Admin CLI Scripts (`scripts/admin/`)

Platform-admin provisioning. All append to `AdminAuditLog` (immutable).

| File | Purpose | Usage |
|------|---------|-------|
| `_client.ts` | Shared Prisma client for CLI scripts | Imported by other admin scripts |
| `bootstrapSuperAdmin.ts` | Create first SUPER_ADMIN account | `npx tsx scripts/admin/bootstrapSuperAdmin.ts` |
| `createOperator.ts` | Provision operator account (username, temp password) | `npx tsx scripts/admin/createOperator.ts <operatorId>` |
| `disableOperator.ts` | Disable operator | `npx tsx scripts/admin/disableOperator.ts <operatorId>` |
| `listOperators.ts` | List all operators with status | `npx tsx scripts/admin/listOperators.ts` |
| `resetOperatorAdminPassword.ts` | Reset operator password | `npx tsx scripts/admin/resetOperatorAdminPassword.ts <operatorUserId>` |
| `resetAdminTotpBreakGlass.ts` | Emergency TOTP reset for locked-out admin | `npx tsx scripts/admin/resetAdminTotpBreakGlass.ts <adminId>` |

---

## Seed Scripts (`scripts/seed/`)

Dev data generation and management.

| File | Purpose | Usage |
|------|---------|-------|
| `seed-operator.ts` | Seed test operator with routes/buses/trips | `npx tsx scripts/seed/seed-operator.ts` |
| `seed-admin.ts` | Seed admin user for dev | `npx tsx scripts/seed/seed-admin.ts` |
| `seed-trips-range.ts` | Generate trips for a date range | `npx tsx scripts/seed/seed-trips-range.ts` |
| `admin-totp-code.ts` | Generate current TOTP code for seeded admin | `npx tsx scripts/seed/admin-totp-code.ts` |
| `reset-operator-password.ts` | Reset seeded operator password | `npx tsx scripts/seed/reset-operator-password.ts` |

---

## Dev Scripts (`scripts/dev/`)

Development utilities and screenshot generation.

| File | Purpose |
|------|---------|
| `createTestCustomer.ts` | Create test customer account |
| `create-test-operator.ts` | Create test operator with full setup |
| `resetSeedOperator.ts` | Reset seeded operator to initial state |
| `capture-console.mjs` | Capture browser console output |
| `probe-fonts.mjs` | Check font loading |
| `screenshot-overview.mjs` | Screenshot operator overview page |
| `screenshot-dashboard.mjs` | Screenshot operator dashboard |
| `shot.mjs` | Quick screenshot utility |
| `shot-op.mjs` | Operator portal screenshot |
| `shot-combo.mjs` | Multi-page screenshot combo |

---

## Smoke Test Scripts (`scripts/smoke/`)

Playwright crawl scripts for user journey validation.

| File | Purpose |
|------|---------|
| `operator-crawl.mts` | Crawl all operator console pages — caught the barrel import 500s (Issue 092b) |
| `traveler-crawl.mts` | Crawl customer-facing pages |
| `cross-persona-crawl.mts` | Cross-persona journey (customer → operator → admin) |
| `route-audit.mts` | Audit all route pages for errors |
| `hero-shot.mjs` | Hero section screenshot |
| `home-full.mjs` | Full home page screenshot |
| `shot-el.mjs` | Element-level screenshot |

---

## Audit Scripts (`scripts/audit/`)

| File | Purpose |
|------|---------|
| `data-leak-grep.sh` | Grep for PII leaks in API responses and logs |

---

## Research Scripts (`scripts/research/`)

| File | Purpose |
|------|---------|
| `vexere-operators.mjs` | Scrape competitor operator data |

---

## Other Scripts

| File | Purpose |
|------|---------|
| `crawl-online-gov.mjs` | Scrape Vietnam government administrative divisions |
| `generate-business-report.py` | Generate business analysis report |
| `gen-legal-report.py` | Generate legal/regulatory report |
| `rebuild-blocked-seats.sql` | SQL script to rebuild blocked seat data |
| `fresh-boot-smoke.sh` | Full fresh boot + smoke test |
| `safe-delete-2026-06-05.ps1` | PowerShell cleanup script (dated) |

---

## CI/CD

### Pre-commit Hook (`.husky/pre-commit`)

```bash
pnpm lint && pnpm tsc --noEmit
```

Runs ESLint + TypeScript type-check on every commit. Configured via `lint-staged` in `package.json` for staged files only.

### lint-staged (from `package.json`)

Runs Prettier + ESLint on staged `.ts`, `.tsx`, `.js`, `.mjs` files.

---

## Docker

### Development (`docker-compose.dev.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16` | 5432 | Primary database |
| `shadow` | `postgres:16` | 5434 | Prisma shadow database (for migrate diff) |
| `redis` | `redis:7` | 6379 | Rate limiting, session cache |

Named volumes: `pgdata`, `shadowdata`, `redisdata`

### Production (`Dockerfile`)

3-stage multi-stage build:
1. **deps** — `node:20-alpine`, install pnpm, copy lockfile, `pnpm install --frozen-lockfile`
2. **builder** — copy source, `pnpm build` (Next.js standalone output)
3. **runner** — `node:20-alpine`, copy standalone output, healthcheck, `node server.js`

### Deployment (`vercel.json`)

Region: `sin1` (Singapore — closest to Vietnam)

Cron schedules:

| Job | Schedule | Path |
|-----|----------|------|
| Sweep holds | `* * * * *` (every min) | `/api/cron/sweep-holds` |
| Close sales | `* * * * *` (every min) | `/api/cron/close-sales` |
| Complete trips | `*/5 * * * *` (every 5 min) | `/api/cron/complete-trips` |
| Send reminders | `*/15 * * * *` (every 15 min) | `/api/cron/send-reminders` |
| Dispatch notifications | `* * * * *` (every min) | `/api/cron/dispatch-notifications` |
| Generate ticket PDFs | `*/2 * * * *` (every 2 min) | `/api/cron/generate-ticket-pdfs` |
| Generate trips | `0 1 * * *` (daily 1am) | `/api/cron/generate-trips` |
| Process payouts | `0 * * * *` (hourly) | `/api/cron/process-payouts` |
| Charter expiry | `0 * * * *` (hourly) | `/api/cron/charter-expiry` |
| Retention sweep | `0 3 * * *` (daily 3am) | `/api/cron/retention` |
| Reconcile payments | `*/15 * * * *` (every 15 min) | `/api/cron/reconcile-payments` |
