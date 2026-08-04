# 02 - Root Configuration Files

Exhaustive reference for every root-level configuration file in the Bus-Booking project. Each section lists the file path, purpose, and a key-by-key breakdown.

---

## 1. package.json

**Path:** `package.json`
**Purpose:** Project metadata, dependency manifest, scripts, pnpm overrides, and lint-staged config.

### Project metadata

| Key | Value |
|-----|-------|
| `name` | `bus-booking` |
| `version` | `0.1.0` |
| `private` | `true` |

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Start Next.js dev server (runs on port 3001) |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint (flat config) |
| `test` | `vitest run` | Run unit tests once |
| `test:watch` | `vitest` | Run unit tests in watch mode |
| `test:integration` | `vitest run --config vitest.integration.config.ts --reporter=verbose` | Run integration tests with verbose output |
| `vitest:int` | `vitest run --config vitest.integration.config.ts` | Run integration tests (short alias) |
| `test:all` | `vitest run && vitest run --config vitest.integration.config.ts` | Run unit + integration tests sequentially |
| `test:e2e` | `playwright test` | Run Playwright E2E tests |
| `admin:create-operator` | `tsx --env-file=.env.production scripts/admin/createOperator.ts` | CLI: create operator account |
| `admin:disable-operator` | `tsx --env-file=.env.production scripts/admin/disableOperator.ts` | CLI: disable operator account |
| `admin:reset-operator-admin-password` | `tsx --env-file=.env.production scripts/admin/resetOperatorAdminPassword.ts` | CLI: reset operator admin password |
| `admin:list-operators` | `tsx --env-file=.env.production scripts/admin/listOperators.ts` | CLI: list all operators |
| `admin:bootstrap-super-admin` | `tsx --env-file=.env.production scripts/admin/bootstrapSuperAdmin.ts` | CLI: bootstrap super admin account |
| `admin:reset-admin-totp` | `tsx --env-file=.env.production scripts/admin/resetAdminTotpBreakGlass.ts` | CLI: reset admin TOTP (break-glass) |
| `seed:trips` | `tsx --env-file=.env.local scripts/seed/seed-trips-range.ts` | Seed trip data for a date range |
| `seed:operator` | `tsx --env-file=.env.local scripts/seed/seed-operator.ts` | Seed operator data |
| `seed:admin` | `tsx --env-file=.env.local scripts/seed/seed-admin.ts` | Seed admin data |
| `admin:code` | `tsx --env-file=.env.local scripts/seed/admin-totp-code.ts` | Generate admin TOTP code (dev) |
| `prepare` | `husky` | Install Husky git hooks on `pnpm install` |

### Dependencies (production)

| Package | Version | Purpose |
|---------|---------|---------|
| `@base-ui/react` | `^1.4.1` | Headless UI primitives (Base UI) |
| `@prisma/adapter-pg` | `^7.8.0` | Prisma driver adapter for `pg` (PgBouncer-compatible) |
| `@prisma/client` | `^7.8.0` | Prisma ORM client |
| `@react-pdf/renderer` | `^4.5.1` | PDF ticket generation (React-PDF) |
| `@upstash/ratelimit` | `^2.0.8` | Rate limiting via Upstash Redis |
| `@upstash/redis` | `^1.38.0` | Upstash Redis client (HTTP-based) |
| `class-variance-authority` | `^0.7.1` | Variant-based className utility (CVA) |
| `clsx` | `^2.1.1` | Conditional className builder |
| `date-fns` | `^4.1.0` | Date utility library |
| `date-fns-tz` | `^3.2.0` | Timezone support for date-fns |
| `ioredis` | `^5.11.1` | Self-hosted Redis client (TCP) |
| `jose` | `^6.2.3` | JWT sign/verify (Edge-safe, no native crypto) |
| `lucide-react` | `^1.16.0` | Icon library (Lucide) |
| `next` | `16.2.6` | Next.js framework |
| `pino` | `^10.3.1` | Structured JSON logger |
| `prisma` | `^7.8.0` | Prisma CLI + migration engine |
| `react` | `19.2.4` | React 19 |
| `react-dom` | `19.2.4` | React DOM 19 |
| `resend` | `^6.12.4` | Transactional email provider (Resend) |
| `shadcn` | `^4.7.0` | shadcn/ui CLI for component generation |
| `tailwind-merge` | `^3.6.0` | Merge Tailwind classes without conflicts |
| `tw-animate-css` | `^1.4.0` | Tailwind CSS animation utilities |
| `uuidv7` | `^1.2.1` | UUIDv7 generation (time-sortable) |
| `zod` | `^4.4.3` | Schema validation (Zod 4) |
| `zustand` | `^5.0.13` | Client-side state management |

### Dependencies (dev)

| Package | Version | Purpose |
|---------|---------|---------|
| `@playwright/test` | `^1.60.0` | Playwright E2E testing |
| `@tailwindcss/postcss` | `^4` | Tailwind v4 PostCSS plugin |
| `@testing-library/react` | `^16.3.2` | React Testing Library |
| `@types/node` | `^20` | Node.js type definitions |
| `@types/pg` | `^8.20.0` | pg driver type definitions |
| `@types/react` | `^19` | React 19 type definitions |
| `@types/react-dom` | `^19` | React DOM 19 type definitions |
| `@vitejs/plugin-react` | `^6.0.2` | Vite React plugin (for Vitest) |
| `eslint` | `^9` | ESLint v9 (flat config) |
| `eslint-config-next` | `16.2.6` | Next.js ESLint config |
| `eslint-import-resolver-typescript` | `^4.4.5` | TypeScript import resolution for eslint-plugin-import-x |
| `eslint-plugin-boundaries` | `^6.0.2` | Module boundary enforcement (barrel imports) |
| `eslint-plugin-import-x` | `^4.16.2` | Import cycle detection (ESM-native fork) |
| `happy-dom` | `^20.9.0` | DOM environment for unit tests |
| `husky` | `^9.1.7` | Git hooks manager |
| `lint-staged` | `^17.0.5` | Run linters on staged files |
| `pg` | `^8.20.0` | PostgreSQL driver |
| `prettier` | `^3.8.3` | Code formatter |
| `tailwindcss` | `^4` | Tailwind CSS v4 |
| `tsx` | `^4.22.1` | TypeScript execution (scripts, seed) |
| `typescript` | `^5` | TypeScript compiler |
| `vitest` | `^4.1.6` | Test runner (Vitest 4) |

### Prisma seed config

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

Prisma CLI runs `tsx prisma/seed.ts` when `prisma db seed` is invoked.

### lint-staged

| File pattern | Commands |
|-------------|----------|
| `*.{ts,tsx,js,jsx}` | `eslint --fix`, `prettier --write` |
| `*.{json,md,yaml,yml}` | `prettier --write` |

### pnpm overrides

| Package | Override | Reason |
|---------|----------|--------|
| `@hono/node-server` | `>=1.19.13` | Security/compat fix |
| `postcss` | `>=8.5.10` | Security/compat fix |

---

## 2. tsconfig.json

**Path:** `tsconfig.json`
**Purpose:** TypeScript compiler configuration for the entire project.

### Compiler options

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | `ES2017` | Emit target; no BigInt literal syntax (`1n`), use `BigInt(1)` |
| `lib` | `["dom", "dom.iterable", "esnext"]` | Type libraries: DOM APIs + latest ES features |
| `allowJs` | `true` | Allow JS files alongside TS |
| `skipLibCheck` | `true` | Skip type-checking `.d.ts` files (build speed) |
| `strict` | `true` | Enable all strict type-checking options |
| `noEmit` | `true` | Type-check only; Next.js handles compilation |
| `esModuleInterop` | `true` | CJS/ESM interop for default imports |
| `module` | `esnext` | ESM module system |
| `moduleResolution` | `bundler` | Bundler-style resolution (Next.js Turbopack) |
| `resolveJsonModule` | `true` | Allow importing .json files |
| `isolatedModules` | `true` | Enforce per-file transpilation safety |
| `jsx` | `react-jsx` | React 17+ JSX transform (no `import React`) |
| `incremental` | `true` | Cache type-check results for faster re-checks |
| `plugins` | `[{ "name": "next" }]` | Next.js TypeScript plugin (app router types) |

### Path aliases

| Alias | Maps to |
|-------|---------|
| `@/*` | `./*` (project root) |

### Include / Exclude

- **include:** `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`, `.next/dev/types/**/*.ts`, `**/*.mts`
- **exclude:** `node_modules`

---

## 3. next.config.ts

**Path:** `next.config.ts`
**Purpose:** Next.js 16 framework configuration.

| Option | Value | Purpose |
|--------|-------|---------|
| `output` | `'standalone'` | Standalone build for Docker (copies only needed files to `.next/standalone`) |
| `allowedDevOrigins` | `['93ppgcdj-3001.usw3.devtunnels.ms', '*.devtunnels.ms']` | Allow VS Code devtunnel origins for cross-origin HMR/assets in dev mode |
| `redirects()` | See below | Permanent redirects for moved routes |

### Redirects

| Source | Destination | Type |
|--------|-------------|------|
| `/op/dashboard/:id` | `/op/bookings/:id` | Permanent (301) — booking detail moved from dashboard to bookings |

---

## 4. eslint.config.mjs

**Path:** `eslint.config.mjs`
**Purpose:** ESLint v9 flat config with Next.js, module boundary enforcement, and import cycle detection.

### Base configs

- `eslint-config-next/core-web-vitals` — Next.js Core Web Vitals rules
- `eslint-config-next/typescript` — Next.js TypeScript rules

### Plugins

| Plugin | Purpose |
|--------|---------|
| `eslint-plugin-boundaries` | Cross-domain barrel import enforcement (SYS20 rule 3) |
| `eslint-plugin-import-x` | Import cycle detection (`no-cycle`) |

### Domain list (LIB_DOMAINS)

48 recognized domains under `lib/`: `account`, `admin`, `analytics`, `api`, `audit`, `auth`, `booking`, `catalog`, `charter`, `flags`, `format`, `geo`, `home`, `jobs`, `ledger`, `notification`, `observability`, `onboarding`, `op`, `payment`, `places`, `ratelimit`, `reports`, `search`, `security`, `seo`, `staff`, `state`, `storage`, `text`, `ticketing`, `trips`, `utils`.

### Rule blocks

**Block 1 -- SYS20 rule 2** (`lib/**/*.{ts,tsx}`, ignores `lib/stores/**`):
- `no-restricted-imports`: `lib/<domain>` must not import from `app/` or `components/`.

**Block 2 -- SYS20 rule 4** (`lib/core/**/*.{ts,tsx}`):
- `no-restricted-imports`: `lib/core` must not import any domain barrel (prevents upward cycles). Also inherits rule 2 (no `app/` or `components/`).

**Block 3 -- SYS20 rule 3 + no-cycle** (`app/**`, `components/**`, `lib/**`; ignores `__tests__/**`, `*.test.*`, `app/dev/**`):
- `boundaries/entry-point` (`error`): Cross-domain imports into `lib/<domain>` must go through the barrel (`index.ts`). Exceptions for client-safe deep imports: `csrfClient`, `safeReturnTo`, `consent`, `pickupSelection`, `statusLabels`, `formatRelativeVi`. `lib-core`, `app`, and `components` allow all entry points.
- `import-x/no-cycle` (`error`): No circular import chains (`maxDepth: Infinity`, `ignoreExternal: true`).

### Boundary element types

| Type | Pattern | Description |
|------|---------|-------------|
| `lib-core` | `lib/core` | Core primitives (DB, logger, config) -- matched first |
| `lib-domain` | `lib/*` | Domain modules -- captures `[domain]` name |
| `app` | `app` | Next.js app routes |
| `components` | `components` | Shared React components |

### Global ignores

`.next/**`, `out/**`, `build/**`, `next-env.d.ts`, `playwright-report/**`, `test-results/**`, `coverage/**`

---

## 5. prisma.config.ts

**Path:** `prisma.config.ts`
**Purpose:** Prisma 7.x CLI configuration -- schema path, datasource URLs, and seed command.

| Option | Value | Purpose |
|--------|-------|---------|
| `schema` | `'./prisma/schema.prisma'` | Path to Prisma schema |
| `datasource.url` | `DIRECT_URL ?? DATABASE_URL` | Migration URL; prefers `DIRECT_URL` (bypasses PgBouncer for DDL) |
| `datasource.shadowDatabaseUrl` | `SHADOW_DATABASE_URL` | Shadow DB for migration diffing |
| `migrations.seed` | `'tsx prisma/seed.ts'` | Seed command for `prisma migrate reset` |

---

## 6. vitest.config.ts

**Path:** `vitest.config.ts`
**Purpose:** Vitest configuration for unit tests.

### Test settings

| Option | Value | Purpose |
|--------|-------|---------|
| `environment` | `'happy-dom'` | DOM environment for React component tests |
| `globals` | `true` | `describe/it/expect` available without imports |
| `include` | `['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx']` | Unit test file patterns |
| `exclude` | `['node_modules', '.next', 'e2e', '**/*.int.test.ts']` | Excludes integration tests and E2E |
| `setupFiles` | `['./vitest.setup.ts']` | Global setup (env vars, mocks) |
| `reporters` | `['default']` | Default reporter |
| `coverage.provider` | `'v8'` | V8-based code coverage |
| `coverage.reporter` | `['text', 'lcov']` | Coverage output formats |

### Plugins

- `@vitejs/plugin-react` -- React JSX/refresh support

### Resolve aliases

| Alias | Target | Purpose |
|-------|--------|---------|
| `@` | Project root | Match tsconfig path alias |
| `server-only` | `test/stubs/server-only.ts` | Stub Next.js server-only marker for unit tests |
| `client-only` | `test/stubs/server-only.ts` | Stub Next.js client-only marker for unit tests |

---

## 7. vitest.integration.config.ts

**Path:** `vitest.integration.config.ts`
**Purpose:** Vitest configuration for integration tests (requires live PostgreSQL database).

### Test settings

| Option | Value | Purpose |
|--------|-------|---------|
| `environment` | `'node'` | Node.js environment (no DOM; real DB queries) |
| `globals` | `true` | Global test functions |
| `include` | `['**/__tests__/**/*.int.test.ts']` | Integration test pattern (`*.int.test.ts`) |
| `exclude` | `['node_modules', '.next', 'e2e']` | Standard exclusions |
| `testTimeout` | `30_000` (30s) | Extended timeout for DB operations |
| `reporters` | `['default']` | Default reporter |
| `env` | Loaded from `.env.local` | Injects DATABASE_URL etc. into test workers |
| `maxWorkers` | `1` | Sequential execution -- shared DB has cross-test race conditions |

### Environment loading

A custom `loadEnvLocal()` function reads `.env.local` at config-evaluation time, parsing `KEY=VALUE` pairs with quote stripping. Falls back silently if file is missing (CI sets env vars externally).

### Resolve aliases

Same as `vitest.config.ts`: `@` maps to project root; `server-only` and `client-only` stubbed.

---

## 8. vitest.setup.ts

**Path:** `vitest.setup.ts`
**Purpose:** Global setup file for unit tests -- sets environment variables before any test module loads.

| Variable | Default value | Purpose |
|----------|---------------|---------|
| `DATABASE_URL` | `postgresql://test:test@localhost:5432/test_unit` | Dummy URL so `lib/core/db/client` loads without throwing (pg.Pool is lazy; all queries are mocked) |
| `NOTIFY_STUB` | `'true'` | Keep SMS/email on the stub adapter; prevents real network calls in unit tests |

Both use `??=` (nullish assignment) -- only set if not already defined.

---

## 9. vitest.integration.setup.ts

**Path:** `vitest.integration.setup.ts`
**Purpose:** Global setup for integration tests -- loads `.env.local` into `process.env` before test workers import modules.

Exports a `setup()` function that:

1. Reads `.env.local` from the current working directory
2. Parses `KEY=VALUE` lines (skips comments and blank lines)
3. Strips surrounding single/double quotes from values
4. Sets `process.env[key]` only if the key is not already set (CI env vars take precedence)
5. Silently ignores missing `.env.local` file

---

## 10. playwright.config.ts

**Path:** `playwright.config.ts`
**Purpose:** Playwright E2E test configuration.

### Global settings

| Option | Value | Purpose |
|--------|-------|---------|
| `testDir` | `'./e2e'` | E2E test directory |
| `fullyParallel` | `true` | Run tests in parallel |
| `forbidOnly` | `!!process.env.CI` | Fail if `.only()` left in CI |
| `retries` | CI: `2`, local: `0` | Retry flaky tests in CI |
| `workers` | CI: `1`, local: auto | Single worker in CI for stability |
| `reporter` | `'html'` | HTML test report |

### `use` defaults

| Option | Value | Purpose |
|--------|-------|---------|
| `baseURL` | `PLAYWRIGHT_BASE_URL` or `http://localhost:3000` | Base URL for all page navigations |
| `trace` | `'on-first-retry'` | Collect trace on first retry (debugging) |

### Projects

| Project | Device | Viewport | Purpose |
|---------|--------|----------|---------|
| `chromium` | Desktop Chrome | Default | Desktop browser tests |
| `mobile-390` | iPhone SE base | 390 x 844 | Mobile responsive tests |

### Web server

| Option | Value | Purpose |
|--------|-------|---------|
| `command` | `'pnpm dev'` | Starts Next.js dev server |
| `url` | `http://localhost:3000` | Wait for server readiness |
| `reuseExistingServer` | `!process.env.CI` | Reuse running server locally; start fresh in CI |
| `timeout` | `120_000` (2 min) | Server startup timeout |

Dev mode is used (not production `pnpm start`) because production sets `Secure` cookies that fail over plain `http://localhost` in CI.

---

## 11. docker-compose.dev.yml

**Path:** `docker-compose.dev.yml`
**Purpose:** Local development infrastructure -- PostgreSQL (primary + shadow) and Redis.

### Services

#### `postgres` (primary database)

| Setting | Value |
|---------|-------|
| Image | `postgres:16` |
| Port | `5432:5432` |
| User | `bbvn` |
| Password | `bbvn_dev_password` |
| Database | `bbvn_dev` |
| Volume | `postgres_data:/var/lib/postgresql/data` |
| Healthcheck | `pg_isready -U bbvn -d bbvn_dev` (5s interval, 5 retries) |

#### `postgres_shadow` (Prisma shadow database)

| Setting | Value |
|---------|-------|
| Image | `postgres:16` |
| Port | `5434:5432` |
| User | `bbvn` |
| Password | `bbvn_dev_password` |
| Database | `bbvn_shadow` |
| Volume | `postgres_shadow_data:/var/lib/postgresql/data` |
| Healthcheck | `pg_isready -U bbvn -d bbvn_shadow` (5s interval, 5 retries) |

#### `redis`

| Setting | Value |
|---------|-------|
| Image | `redis:7-alpine` |
| Port | `6379:6379` |
| Volume | `redis_data:/data` |
| Healthcheck | `redis-cli ping` (5s interval, 5 retries) |

### Named volumes

`postgres_data`, `postgres_shadow_data`, `redis_data`

---

## 12. Dockerfile

**Path:** `Dockerfile`
**Purpose:** Multi-stage Docker build for production deployment.

### Stage 1: `deps` (dependency installation)

| Step | Detail |
|------|--------|
| Base image | `node:20-alpine` |
| Enables | `corepack` (pnpm) |
| Copies | `package.json`, `pnpm-lock.yaml` |
| Runs | `pnpm install --frozen-lockfile` |

### Stage 2: `builder` (application build)

| Step | Detail |
|------|--------|
| Base image | `node:20-alpine` |
| Copies | `node_modules` from `deps`, then full source |
| Runs | `pnpm prisma generate && pnpm build` |

### Stage 3: `runner` (production image)

| Setting | Value |
|---------|-------|
| Base image | `node:20-alpine` |
| `NODE_ENV` | `production` |
| User | `nextjs` (uid 1001, group `nodejs` gid 1001) |
| Copies from builder | `public/`, `prisma/schema.prisma`, `prisma/migrations/`, `.next/standalone/`, `.next/static/` |
| Exposed port | `3000` |
| `HOSTNAME` | `0.0.0.0` |
| Healthcheck | `wget -qO- http://localhost:3000/api/health` (10s interval, 5s timeout, 3 retries) |
| Entrypoint | `node server.js` |

---

## 13. vercel.json

**Path:** `vercel.json`
**Purpose:** Vercel deployment configuration -- region and cron job schedules.

### Region

| Key | Value | Purpose |
|-----|-------|---------|
| `regions` | `["sin1"]` | Singapore region (closest to Vietnam) |

### Cron jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/sweep-holds` | `* * * * *` (every minute) | Expire stale seat holds |
| `/api/cron/generate-trips` | `0 1 * * *` (daily 01:00) | Auto-generate scheduled trips |
| `/api/cron/close-sales` | `* * * * *` (every minute) | Close ticket sales for departing trips |
| `/api/cron/complete-trips` | `*/5 * * * *` (every 5 min) | Mark arrived trips as completed |
| `/api/cron/send-reminders` | `*/15 * * * *` (every 15 min) | Send pre-departure reminders |
| `/api/cron/process-payouts` | `0 * * * *` (hourly) | Process T+3 operator payouts |
| `/api/cron/dispatch-notifications` | `* * * * *` (every minute) | Dispatch queued SMS/email notifications |
| `/api/cron/generate-ticket-pdfs` | `*/2 * * * *` (every 2 min) | Generate ticket PDF files |
| `/api/cron/charter-expiry` | `0 * * * *` (hourly) | Expire charter trip requests |
| `/api/cron/retention` | `0 3 * * *` (daily 03:00) | Data retention / PII cleanup |
| `/api/cron/reconcile-payments` | `*/15 * * * *` (every 15 min) | Reconcile payment states with PSP |

---

## 14. .gitleaks.toml

**Path:** `.gitleaks.toml`
**Purpose:** Gitleaks configuration for PII and secret detection in git history.

### Base config

| Key | Value |
|-----|-------|
| `title` | `Bus Booking VN - Gitleaks Config` |
| `extend.useDefault` | `true` (inherits default gitleaks rules) |

### Custom rules

| Rule ID | Regex | Tags | Purpose |
|---------|-------|------|---------|
| `vn-mobile-number` | `\+84[35789]\d{8}` | `phone`, `PII`, `VN` | Detect Vietnamese mobile phone numbers |

### Allowlist -- regex patterns

Exempted literals (not real secrets):

- `+84901234567` -- canonical fake doc-example number
- `+84901230001` -- fabricated seed operator phone
- `MOMOBKUN20180529`, `klm05TvNBzhg7h7j`, `at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa` -- MoMo public sandbox credentials
- CI-only test secrets (`ci-test-jwt-secret-...`, `ci-test-operator-secret-...`, `ci-test-admin-secret-...`, `ci-test-cron-secret-00`)
- CI-only TOTP encryption key (`0123456789abcdef...` 64-char hex)
- VNPay public sandbox defaults (`VNPAYSECRETTEST...`, `VNPAYTEST`)

### Allowlist -- path patterns

Files excluded from scanning:

- `prisma/seed.ts`
- `lib/audit/redactPhone.ts`
- `*__tests__*`, `*.test.ts$`
- `e2e/*`
- `scripts/smoke/*`, `docs/qa/*`
- `.env.example`

---

## 15. .prettierrc.json

**Path:** `.prettierrc.json`
**Purpose:** Prettier code formatting rules.

| Option | Value | Purpose |
|--------|-------|---------|
| `semi` | `true` | Always use semicolons |
| `singleQuote` | `true` | Use single quotes |
| `trailingComma` | `"es5"` | Trailing commas where valid in ES5 (objects, arrays) |
| `tabWidth` | `2` | 2-space indentation |
| `printWidth` | `100` | Line wrap at 100 characters |

---

## 16. components.json

**Path:** `components.json`
**Purpose:** shadcn/ui component library configuration.

| Option | Value | Purpose |
|--------|-------|---------|
| `$schema` | `https://ui.shadcn.com/schema.json` | JSON schema validation |
| `style` | `"base-nova"` | shadcn/ui style variant |
| `rsc` | `true` | React Server Component support enabled |
| `tsx` | `true` | Generate TypeScript components |
| `tailwind.config` | `""` (empty) | No separate Tailwind config file (v4 uses CSS) |
| `tailwind.css` | `"app/globals.css"` | Global CSS file path |
| `tailwind.baseColor` | `"neutral"` | Neutral base color palette |
| `tailwind.cssVariables` | `true` | Use CSS custom properties for theming |
| `tailwind.prefix` | `""` | No Tailwind class prefix |
| `iconLibrary` | `"lucide"` | Icon library: Lucide React |
| `rtl` | `false` | No right-to-left layout support |
| `menuColor` | `"default"` | Default menu color |
| `menuAccent` | `"subtle"` | Subtle menu accent style |

### Path aliases

| Alias | Path |
|-------|------|
| `components` | `@/components` |
| `utils` | `@/lib/utils` |
| `ui` | `@/components/ui` |
| `lib` | `@/lib` |
| `hooks` | `@/hooks` |

---

## 17. postcss.config.mjs

**Path:** `postcss.config.mjs`
**Purpose:** PostCSS configuration -- wires Tailwind CSS v4 as a PostCSS plugin.

| Plugin | Config | Purpose |
|--------|--------|---------|
| `@tailwindcss/postcss` | `{}` (defaults) | Tailwind v4 PostCSS processing |

Tailwind v4 does not use a `tailwind.config.js` file. Configuration is done via CSS (`app/globals.css` with `@theme` directives).

---

## 18. .gitignore

**Path:** `.gitignore`
**Purpose:** Git ignore patterns for the project.

| Category | Patterns | Purpose |
|----------|----------|---------|
| Dependencies | `/node_modules`, `/.pnp`, `.pnp.*`, `.yarn/*` (keeps patches/plugins/releases/versions) | Ignore installed packages |
| Testing | `/coverage`, `/test-results`, `/playwright-report` | Ignore test output |
| Next.js | `/.next/`, `/out/` | Ignore build output |
| Production | `/build` | Ignore prod build artifacts |
| Misc | `.DS_Store`, `*.pem` | OS files, certificates |
| Debug logs | `npm-debug.log*`, `yarn-debug.log*`, `yarn-error.log*`, `.pnpm-debug.log*`, `dev-server*.log` | Ignore log files |
| Env files | `.env*` | All env files (secrets) |
| Vercel | `.vercel` | Vercel CLI state |
| Claude Code | `.claude/scheduled_tasks.lock`, `.agents/`, `.claude/` | Claude Code workspace and junctions (Turbopack-safe) |
| TypeScript | `*.tsbuildinfo`, `next-env.d.ts` | Build artifacts |
| Dev artifacts | `gitdiff.txt`, `docs/dev/screenshots/`, `scripts/dev/` | Throwaway dev files |
| QA screenshots | `docs/qa/**/*-shots/`, `dev3001.log` | Large binary QA artifacts |
| Research data | `docs/research/vexere-operators.json`, `docs/research/vexere-operators.md` | Regenerable competitor data |

---

## 19. .husky/pre-commit

**Path:** `.husky/pre-commit`
**Purpose:** Git pre-commit hook -- runs lint and type-check before every commit.

```sh
#!/usr/bin/env sh
pnpm lint && pnpm tsc --noEmit
```

Runs sequentially: ESLint must pass, then TypeScript type-check must pass. If either fails, the commit is rejected.

---

## 20. instrumentation.ts

**Path:** `instrumentation.ts`
**Purpose:** Next.js 16 instrumentation hook -- server-side observability initialization seam.

| Export | Behavior |
|--------|----------|
| `register()` | Currently empty (no-op). Designed as the wiring point for `@sentry/nextjs` when `SENTRY_DSN` is set. The Sentry SDK is not installed (deferred for go-live). Until then, error reporting uses PII-scrubbed structured-logger fallback via `lib/observability/sentry.ts`. |

The `register()` function runs once per server runtime at startup. A client-side counterpart (`instrumentation-client.ts` or `sentry.client.config.ts`) is also deferred.

---

## 21. .env.example

**Path:** `.env.example`
**Purpose:** Template for `.env.local` -- documents every environment variable the application reads.

### Database

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_dev` | Primary database connection (app queries) |
| `DIRECT_URL` | Same as DATABASE_URL | Direct PG connection (bypasses PgBouncer for migrations) |
| `SHADOW_DATABASE_URL` | `...@localhost:5434/bbvn_shadow` | Shadow database for Prisma migration diffing |

### Rate limiting (Upstash)

| Variable | Default | Purpose |
|----------|---------|---------|
| `UPSTASH_REDIS_REST_URL` | (empty) | Upstash Redis HTTP endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | (empty) | Upstash Redis auth token |

### Self-hosted Redis

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_PROVIDER` | unset/`memory` | Redis backend: `"ioredis"` (self-hosted) or `"upstash"` (Vercel) |
| `REDIS_URL` | `redis://localhost:6379` | Redis TCP connection URL |

### Authentication / JWT

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | (placeholder) | HS256 secret for customer access tokens (min 32 bytes hex) |
| `JWT_OPERATOR_SECRET` | (placeholder) | HS256 secret for operator access tokens |
| `JWT_ADMIN_SECRET` | (placeholder) | HS256 secret for admin access tokens |
| `REFRESH_TOKEN_SECRET` | (placeholder) | HMAC-SHA256 secret for refresh tokens |
| `TOTP_ENCRYPTION_KEY` | (placeholder) | AES-256-GCM key for admin TOTP secrets (64 hex chars) |

### Hold / seat-block (Issue 002)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HOLD_SECRET` | (placeholder) | HMAC-SHA256 signing key for `bb_hold` cookies (min 32 bytes hex) |
| `HOLD_SWEEPER_MODE` | `"count"` | `"count"` = log only; `"update"` = expire holds in DB |

### Cron security

| Variable | Default | Purpose |
|----------|---------|---------|
| `CRON_SECRET` | (placeholder) | Bearer token for Vercel cron Authorization header |

### Feature flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `SEARCH_USE_BLOCKED_SEATS` | `"false"` | When `"true"`, search subtracts active-hold seats from availability |
| `MANUAL_BOOKING_ENABLED` | absent (enabled) | Set `"false"` to disable manual booking endpoint (503) |
| `OTP_PEEK_ENABLED` | absent (disabled) | Set `"true"` to enable OTP test-peek endpoint (dev/CI only) |
| `E2E_DATA_LEAK_ENABLED` | absent (disabled) | Gates the data-leak smoke E2E spec |
| `ADMIN_TOTP_DISABLED` | absent (enabled) | Set `"true"` to skip TOTP step in admin login (dev only, ignored in production) |

### MoMo payment gateway (Issue 004)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOMO_PARTNER_CODE` | `MOMOBKUN20180529` (sandbox) | MoMo partner code |
| `MOMO_ACCESS_KEY` | `klm05TvNBzhg7h7j` (sandbox) | MoMo access key |
| `MOMO_SECRET_KEY` | sandbox value | MoMo HMAC secret (never commit real key) |
| `MOMO_ENDPOINT` | `https://test-payment.momo.vn/v2/gateway/api/create` | MoMo API endpoint |

### VNPay payment gateway (Issue 077)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VNPAY_TMN_CODE` | `VNPAYTEST` (sandbox) | VNPay terminal code |
| `VNPAY_HASH_SECRET` | `VNPAYSECRETTEST...` (sandbox) | VNPay HMAC hash secret |
| `VNPAY_URL` | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` | VNPay payment page URL |
| `VNPAY_RETURN_URL` | `http://localhost:3001/api/payments/vnpay/return` | VNPay return callback URL |

### Object storage (Issue 059)

| Variable | Default | Purpose |
|----------|---------|---------|
| `STORAGE_STUB` | `"true"` | `"true"` = use HMAC-signed stub URLs (no real S3); `"false"` = real S3 |
| `STORAGE_STUB_SECRET` | (placeholder) | HMAC key for stub URL signing (min 16 chars) |
| `STORAGE_BUCKET` | (commented) | Real S3 bucket name |
| `STORAGE_REGION` | (commented) | Real S3 region |
| `STORAGE_ENDPOINT` | (commented) | Real S3 endpoint |
| `STORAGE_ACCESS_KEY` | (commented) | Real S3 access key |
| `STORAGE_SECRET_KEY` | (commented) | Real S3 secret key |

### Notifications / SMS (Issue 058)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOTIFY_STUB` | `"true"` | `"true"` = log SMS/email only; `"false"` = send real SMS via eSMS.vn |
| `ESMS_API_KEY` | (commented) | eSMS.vn API key |
| `ESMS_SECRET_KEY` | (commented) | eSMS.vn secret key |
| `ESMS_BRANDNAME` | (commented) | eSMS.vn sender brandname |
| `ESMS_OTP_SMSTYPE` | `"2"` (commented) | eSMS SMS type for OTP |
| `ESMS_SANDBOX` | `"true"` (commented) | eSMS sandbox mode |
| `ESMS_BASE_URL` | `https://rest.esms.vn` (commented) | eSMS API base URL |

### E-invoice (Issue 074)

| Variable | Default | Purpose |
|----------|---------|---------|
| `EINVOICE_ENABLED` | `"stub"` | `"stub"` = log only; `"misa"` = real MISA meInvoice API |
| `MISA_API_URL` | (commented) | MISA API endpoint |
| `MISA_API_KEY` | (commented) | MISA API key |
| `MISA_COMPANY_CODE` | (commented) | MISA company code |
| `MISA_TEMPLATE_CODE` | (commented) | MISA invoice template code |

### Transactional email (Issue 080)

| Variable | Default | Purpose |
|----------|---------|---------|
| `EMAIL_PROVIDER` | `"stub"` (via NOTIFY_STUB) | `"resend"` for real Resend API |
| `RESEND_API_KEY` | (commented) | Resend API key |
| `EMAIL_FROM` | `noreply@busbookvn.com` (commented) | Sender email address |

### Public site

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SITE_URL` | (commented) | Production domain for metadataBase, robots.txt, sitemap.xml, JSON-LD |

### PgBouncer (Issue 067)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DIRECT_URL` | (commented) | Direct PG URL (port 5432) when DATABASE_URL goes through PgBouncer (port 6432) |
