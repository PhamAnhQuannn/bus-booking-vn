# SI-003: CI/CD Pipeline

> Status: DOCUMENTED | References: ADR-008, ADR-016, ADR-017, ADR-018, ADR-020, DS-002, DS-006, DS-017

## Purpose

This document consolidates the CI/CD pipeline design for the BenXe platform: how code moves from a developer's branch to production on Vercel. It covers the full pipeline stage sequence, security gate requirements, Docker build configuration, container registry selection, deployment flow, migration safety checks in CI, infrastructure-as-code setup, branch strategy, and skills-based review gates. For detailed linting rules see SI-004; for detailed testing strategy see SI-005; for full deployment architecture see SI-006.

---

## 0. Pre-Pipeline Gate -- Pre-Commit Hooks

Before code reaches the CI pipeline, a local pre-commit hook sequence runs on every `git commit`. This is the developer's first-line gate.

| Step | Tool / Command | What It Catches |
|------|---------------|-----------------|
| 1 | Prettier | Formatting violations |
| 2 | ESLint (boundaries + no-cycle) | Module boundary violations, circular imports |
| 3 | `tsc --noEmit` | Type errors, missing NOT NULL fields in `prisma.<model>.create` |
| 4 | Gitleaks | Secrets, Vietnamese mobile PII patterns |

Pre-commit hooks are the local equivalent of CI Stages 1 and 6. They prevent bad commits from entering version history but do **NOT** replace CI -- hooks can be bypassed with `--no-verify`.

See SI-004 Section 5 for full hook configuration.

---

## 1. Pipeline Stage Sequence

The CI pipeline is defined in `.github/workflows/ci.yml`. It runs on every push to `master`/`main` and every pull request targeting those branches. A stage failure blocks the deploy path.

| Stage | CI Job Name | Tool / Command | Gate Type | Blocks Deploy? |
|-------|------------|----------------|-----------|---------------|
| **1. Lint + Type-check** | `lint-typecheck` | `pnpm lint` then `pnpm tsc --noEmit` (sequential, single job) | Static analysis + compile-time safety | Yes |
| **2. Unit tests** | `unit-tests` | `pnpm test` (Vitest, mocked DB) | Correctness -- pure logic | Yes |
| **3. Integration tests** | `integration-tests` | `pnpm vitest:int` (real PostgreSQL 16) | Correctness -- DB path | Yes |
| **4. E2E tests** | `e2e-tests` | Playwright `mobile-390` project (real PG + Next.js build) | Full user flows | Yes |
| **5. Data leak audit** | `data-leak-audit` | `scripts/audit/data-leak-grep.sh` (7 checks) | PII / security invariants | Yes |
| **6. Secret scanning** | `gitleaks` | Gitleaks action v2 + `.gitleaks.toml` | Secret / PII detection | Yes |
| **7. Dependency audit** | **TO ADD** | `pnpm audit --audit-level=high` | Supply-chain vulnerability | Yes |
| **8. Docker build** | **TO ADD** | `docker build` (multi-stage, Next.js standalone) | Artifact production | Yes |
| **9. Deploy** | automatic | Vercel deploy (on main push) | Delivery | Production only |
| **10. Post-deploy verify** | **TO ADD** | Health check + smoke test | Deployment validation | Production only |

### 1.1 Stage Dependencies

Stages 1-6 run as independent GitHub Actions jobs with no `needs:` dependencies -- they execute in parallel. Stage 7 (dependency audit) will run in parallel with the others when added. Stage 8 (Docker build) should depend on Stages 1-7 passing. Stage 9 (deploy) is manual. Stage 10 (post-deploy) follows Stage 9.

Concurrency: `cancel-in-progress: true` is set per branch, so a new push cancels any in-flight CI run for the same branch.

### 1.2 Lint Content

The lint stage enforces three distinct rule sets (ADR-008 D8). See SI-004 for the full configuration, module boundary enforcement details, and client component guard:

1. **ESLint standard rules** -- code quality, unused variables, React hooks
2. **eslint-plugin-boundaries `entry-point`** -- cross-domain imports must go through barrels
3. **eslint-plugin-import-x `no-cycle`** -- circular imports across module boundaries are blocked

Both boundary and cycle rules are at error severity (not warn), gating the entire pipeline.

---

## 2. Security Checks

Security enforcement is distributed across ADR-008 Layer 5 (CI pipeline layer) and applies to every merged commit.

### 2.1 Dependency Vulnerability Scanning

**Tool**: `pnpm audit --audit-level=high` (ADR-008 D6)

- Queries the npm advisory database against the exact lockfile
- Blocks CI on **high** and **critical** severity advisories only; low/moderate are informational
- `pnpm install --frozen-lockfile` runs before audit -- the lockfile is immutable in CI, preventing phantom dependency changes

**Automated PR creation**: GitHub Dependabot with `security-updates-only` mode and weekly cadence (ADR-008 D6). Dependabot PRs for version updates are disabled; only security advisories trigger automated PRs. These PRs are human-reviewed before merge.

**Implementation status**: As of 2026-06-20, neither `.github/dependabot.yml` nor the `pnpm audit` CI step exist. Both must be added before Issue 094 go-live.

### 2.2 Secret and PII Scanning -- Gitleaks

**Tool**: Gitleaks action v2 (ADR-008 Layer 5)

**CI job**: `gitleaks` (job 6 in `ci.yml`). Runs on every push and PR with `fetch-depth: 0` to scan the full commit history. Uses the project `.gitleaks.toml` which includes a regex for Vietnamese mobile numbers (`\+84[35789]\d{8}`). PII placeholders in seed data and test fixtures must use literal-mask placeholders with non-digit characters (e.g., `+8490xxxxxx1`) -- see SI-004 Section 5.2 for details.

### 2.3 HTTP Security Headers

The full OWASP header set is defined in ADR-008 D4: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. The CSP `connect-src` must include PSP redirect origins (MoMo, VNPay) per environment. **Status**: NOT_IMPLEMENTED as of 2026-06-20. **Severity**: **Go-live blocker** (Issue 094) -- ADR-008 classifies this as mandatory.

### 2.4 Five-Layer Security Model -- Pipeline Role

The CI pipeline constitutes Layer 5 in the ADR-008 five-layer defense-in-depth model. The pipeline layer independently enforces: Gitleaks secret scanning, data leak audit grep, `pnpm audit` dependency gate (when added), `pnpm lint` with eslint-plugin-boundaries, `tsc --noEmit`, and unit/integration/E2E test suites.

No single layer bypass grants full access. Even if a PR passes lint and type-check, the integration tests running against a real database can catch constraint violations, TOCTOU races, and lock contention that mocked tests cannot detect (ADR-018 D2).

### 2.5 Data Leak Audit

**CI job**: `data-leak-audit` (job 5 in `ci.yml`). Runs `scripts/audit/data-leak-grep.sh` -- a bash script that performs 7 static grep checks against the source tree. Exits nonzero on any FAIL, blocking the pipeline.

| Check | What It Catches | Severity |
|-------|----------------|----------|
| **A1**: `tempPasswordPlain` scope | Dev-only column leaking outside allowlisted files | FAIL |
| **A2**: `accessToken` in response body | Access tokens returned in unexpected API responses | FAIL |
| **A3**: `use client` importing server barrel | Client components importing `@/lib/auth`, `@/lib/booking`, or `@/lib/payment` barrels (causes 500 errors; see Issue 092b) | FAIL |
| **A4**: `sameSite: 'lax'` baseline | Cookie sameSite=lax count exceeding baseline threshold | FAIL |
| **A5**: Referrer-Policy existence | Missing Referrer-Policy / referrerPolicy in codebase | WARN |
| **A6**: devtunnels reference | Dev tunnel references in `next.config.ts` (must be removed before prod) | WARN |
| **A7**: `OTP_PEEK_ENABLED` scope | Dev-only OTP peek flag referenced outside allowlisted files | FAIL |

Check A3 is the critical guard that prevented the Issue 092b class of incident where a barrel import sweep rewrote client-safe deep imports to domain barrels, causing 88 broken routes across the entire operator portal.

### 2.6 HTTP Security Headers Validation

After security headers are implemented (ADR-008 D4), a post-deploy verification step should assert the presence of all 6 OWASP headers via curl against the deployed instance:

1. `Strict-Transport-Security` (production only; HSTS preload)
2. `X-Content-Type-Options: nosniff`
3. `X-Frame-Options: DENY`
4. `Referrer-Policy: strict-origin-when-cross-origin`
5. `Permissions-Policy: camera=(), microphone=(), geolocation=()`
6. `Content-Security-Policy` (must include PSP-specific `connect-src` origins per environment)

The `data-leak-grep.sh` check A5 provides code-level detection (warns if no Referrer-Policy found in source). The post-deploy curl provides response-level verification. Both are needed.

**Status**: NOT_IMPLEMENTED -- headers themselves do not exist yet.

---

## 3. Test Execution in CI

The platform uses three test layers (ADR-018 D1). For detailed test strategy, mock hygiene rules, and concurrency testing requirements, see SI-005.

### 3.1 Test Database Provisioning in CI

- **PostgreSQL**: Docker container (`postgres:16`) started as a CI service for both integration and E2E test jobs
- **Connection**: `DATABASE_URL` points to the CI test container (no PgBouncer in CI -- transaction mode pooling is production-only). `SHADOW_DATABASE_URL` is created for Prisma shadow database
- **Migrations**: `pnpm prisma migrate deploy` runs against the CI test DB before tests execute, applying all committed migrations in order
- **Seeding**: `pnpm prisma db seed` populates test fixtures after migrations
- **Isolation**: Each integration test suite uses either transaction rollback (fast) or explicit table truncation (for tests that span multiple transactions)
- **Redis**: Not provisioned as a CI service. Unit tests mock the `@/lib/ratelimit` module via `vi.mock`; integration tests use `vi.spyOn` on the ratelimit export. No test suite currently requires a live Redis connection. If a future test needs real Redis (e.g., testing Upstash REST or ioredis directly), add a Redis 7 service container to the CI job

### 3.2 E2E Tests in CI

Playwright E2E tests run on every PR as CI job `e2e-tests`. The job provisions a real PostgreSQL database, runs migrations, seeds data, builds the Next.js app (`pnpm build`), and executes the `mobile-390` Playwright project (iPhone SE viewport via WebKit).

The E2E job installs Chromium and WebKit browsers. On failure, the Playwright HTML report is uploaded as a CI artifact (retained 7 days).

Environment: `PAYMENTS_STUB=true` routes online payments through the local stub gateway. JWT secrets use CI-only test values (not production secrets).

See SI-005 Section 4 for E2E test rules (URL-driving for form-incidental tests, PSP sandbox credentials).

---

## 4. Docker Build

### 4.1 Multi-Stage Dockerfile

The build uses a three-stage Dockerfile (ADR-020 D3):

| Stage | Base Image | Purpose |
|-------|-----------|--------|
| `deps` | `node:20-alpine` | Install production + dev dependencies from frozen lockfile |
| `builder` | `node:20-alpine` | Run `next build` with `output: 'standalone'` -- produces self-contained bundle |
| `runner` | `node:20-alpine` | Copy only the standalone output; run as non-root user |

The `runner` stage contains no source code, no devDependencies, and no secrets. It holds only the Next.js standalone output -- a Node.js server with all required node_modules inlined.

### 4.2 Next.js Standalone Output

`next.config.ts` sets `output: 'standalone'`. This produces:

- `.next/standalone/` -- the complete server bundle including all required `node_modules`
- `.next/static/` -- static assets served via CDN, not through the Node.js process
- `public/` -- public assets

The standalone output is the only artifact copied into the `runner` stage.

### 4.3 Non-Root User

The runner container executes as a non-root user (`USER node`).

### 4.4 Environment Variables at Runtime

No secrets are baked into the Docker image. All credentials are injected at runtime via environment variables (Vercel dashboard, `docker run --env-file`, or equivalent). Environment validation runs at boot (`lib/config/env.ts` Zod schema) -- the application fails fast if required credentials are missing. See SI-006 Section 4 for the full environment validation design.

---

## 5. Container Registry -- GHCR

**Registry choice**: GitHub Container Registry (GHCR) -- free tier (DS-017, ADR-020 D7).

**Images are deploy-time-only artifacts**: Container images contain no PII, no user data, no production secrets.

**Image tagging strategy**:
- `ghcr.io/org/busbooking:sha-<git-sha>` -- immutable, tied to a specific commit; used for production deployments
- `ghcr.io/org/busbooking:latest` -- mutable, points to most recent main branch build; used for staging pulls

**Future alternative**: Self-hosted Harbor if Vietnam-residency for container images becomes a compliance requirement.

---

## 6. Deployment Overview

For full deployment architecture, hosting details, and provider migration playbooks, see SI-006.

### 6.1 Primary Host -- Vercel Pro sin1

Vercel Pro sin1 is the primary production host (ADR-020 D2/D11). Database on Neon (Singapore), cache on Upstash (Singapore). CDTIA filing accepted for cross-border transfer under PDPL 2025 Art. 25.

### 6.2 Staging -- Vercel Preview

Vercel Pro (Singapore region `sin1`) is the primary production AND staging host (ADR-020 D2/D11). Per-PR preview deploys use Neon database branching for isolated preview databases. CDTIA filing is required and accepted for production user PII processed on Vercel+Neon+Upstash (PDPL 2025 Art. 25).

### 6.3 Deployment Contract

Any hosting provider meeting the eight-requirement contract (C1-C8) can run the platform with zero application code changes. See SI-006 Section 2 for the full contract table.

---

## 7. Migration Safety in CI

### 7.1 Forward-Only Migrations (ADR-017 D1)

No `DOWN` migration scripts exist in the codebase. All schema changes are forward-only. Committed migration files are never edited after commit -- editing changes the Prisma checksum and breaks every environment that already applied the original version (ADR-017 D6).

### 7.2 Prisma Drift Detection

CI runs `pnpm prisma migrate deploy` against the test database before integration tests execute. This command compares the migration history against committed files, detects checksum mismatches (edited migrations), and applies pending migrations.

**Dual declaration requirement** (ADR-017 D3): Any index expressible in the Prisma DSL must be declared in BOTH `schema.prisma` (as `@@index`) AND the raw SQL migration. An index only in SQL causes Prisma to detect schema-vs-DB drift and prompt interactively -- breaking unattended CI.

**Exceptions**: Partial indexes (with `WHERE` clause), CHECK constraints, and triggers use raw SQL only. Prisma silently ignores these in schema diff.

### 7.3 Two-Phase Destructive Changes (ADR-017 D2)

Dropping a column or table requires two separate deployments:
- **Phase A**: Remove all code references. Deploy. Verify no runtime errors.
- **Phase B**: Migration drops the column/table. Deploy.

### 7.4 NOT NULL Column Checklist (ADR-017 D5)

When adding a NOT NULL column to an existing model, every call site that creates rows for that model must include the new column. `tsc --noEmit` catches `prisma.<model>.create` call sites at compile time. Raw SQL `INSERT INTO` statements in e2e fixtures and seed files are NOT checked by tsc -- these must be manually grepped. See SI-005 Section 6.1 for the full grep commands.

### 7.5 Tet Freeze Window

Schema migrations are frozen during the Vietnamese Lunar New Year (Tet) deployment freeze period defined in DS-002. During the freeze window, no migrations are deployed to production.

### 7.6 Migration Safety CI Automation (Future)

Three migration safety checks are currently manual. Automation targets for Stage 1:

**7.6.1 NOT NULL Column Grep**: When `prisma/migrations/` files change, extract model names from `ALTER TABLE ... ADD COLUMN ... NOT NULL`, then grep all `prisma.<Model>.create` and `INSERT INTO "<Model>"` call sites across `lib/`, `app/`, `e2e/`, `prisma/seed.ts`, and `__tests__/`. See SI-005 Section 6.1 for exact commands.

**7.6.2 Schema-Parity Audit**: Manual side-by-side audit of `@@index` declarations in `schema.prisma` vs `CREATE INDEX` statements in migration SQL. **WARNING**: The `prisma migrate diff --from-schema-datamodel --to-schema-datasource` command cited in earlier Mistake Log entries (Issue 007) was removed in Prisma 7.8. Those flags no longer exist. Always run `pnpm prisma migrate diff --help` to verify current flag names before scripting. Until verified, use manual side-by-side comparison.

**7.6.3 CHECK Constraint Insert-Path Verification**: When a CHECK constraint appears in a new migration, grep all `prisma.<Model>.create` call sites to verify the constraint holds for each insert path. A constraint exercised only by sandbox-gated tests is a time-bomb (Mistake Log Issue 020: `OperatorUser_phones_differ`).

**Status**: Manual checklist sufficient at team size 1; CI automation deferred to Stage 1.

### 7.7 Cron Schedule Verification (Future)

`vercel.json` cron entries define the production schedule (DS-006 Section 2.1). The canonical cron schedule source is DS-006 Section 4.1.

**Status**: NOT_AUTOMATED.

---

## 8. Infrastructure as Code

Vercel configuration is managed via `vercel.json` (cron schedules, headers, rewrites) and the Vercel dashboard (environment variables, domain settings). Cloudflare DNS and WAF are managed via the `cloudflare/cloudflare` Terraform provider. Secrets are injected as Vercel environment variables and validated by Zod at boot (SI-006 Section 4).

---

## 9. Branch Strategy and PR Review Gates

### 9.1 Branch Protection Rules

GitHub branch protection for `master`/`main`:

| Rule | Setting |
|------|---------|
| Required status checks | `lint-typecheck`, `unit-tests`, `integration-tests`, `e2e-tests`, `data-leak-audit`, `gitleaks` |
| Required reviewers | 1 minimum (scale to 2 post-Series A) |
| Up-to-date before merge | Yes |
| Force push | Blocked |
| Dismiss stale reviews | Yes (on new commits) |

**Status**: NOT_CONFIGURED as of 2026-06-20. Must be applied in GitHub repository settings before Issue 094 go-live.

### 9.2 CODEOWNERS

Recommended `.github/CODEOWNERS` for critical paths requiring explicit review:

| Path Pattern | Why |
|-------------|-----|
| `prisma/migrations/**` | Migration safety (ADR-017) |
| `lib/config/env.ts` | Boot-time env validation (SI-006 §8) |
| `.github/workflows/**` | CI pipeline changes |
| `lib/payment/**` | Financial paths -- money handling |
| `lib/ledger/**` | Append-only ledger -- immutability invariant |
| `lib/core/db/**` | Database access layer |
| `.gitleaks.toml` | Secret detection rules |

### 9.3 Branch Naming Convention

Pattern: `issue-NNN-short-description` (matching the rebuild-plan issue numbering).

Feature branches from `main`, merged via squash-merge PR.

### 9.4 Release Tagging

`v0.Y.Z` semver tags on `main` for production deployments. The tag points at the Docker image SHA (`ghcr.io/org/busbooking:sha-<git-sha>` from Section 5).

### 9.5 Hotfix Process

1. Branch from the release tag
2. Apply fix
3. Run full CI
4. Merge to `main`
5. Tag new release

Two-phase destructive change rule (ADR-017 D2) still applies even for hotfixes.

### 9.6 Skills-Based Review Gates

Claude Code skills provide structured review checklists that surface issues a human reviewer might miss. These are **PR review aids, not CI gates** -- they require human invocation and interpretation, and must not block PRs on AI tool availability.

| Review Gate | Skill | When to Invoke | Priority |
|-------------|-------|---------------|----------|
| Code review | `/code-review` | Every PR | Recommended |
| Security review | `/security-review` | PRs touching `lib/auth/`, `lib/payment/`, JWT, CSRF | Recommended |
| Migration safety | `/migration-safety` | PRs with `prisma/migrations/` changes | Recommended |
| Architecture review | `/architect-review` | PRs adding new domains or barrel exports | Optional |
| Type safety audit | `/type-safety-audit` | PRs changing DTOs or Prisma model fields | Optional |
| Performance audit | `/perf-audit` | PRs touching hot paths (trip search, hold creation, payment webhook) | Optional |
| Consistency audit | `/consistency-audit` | PRs changing error codes, status codes, or API response shapes | Optional |
| Coverage map | `/coverage-map` | Weekly or when test gaps are suspected | Optional |
| Debt scan | `/debt-scan` | Monthly or at milestone boundaries | Optional |
| Observability review | `/observability-review` | PRs adding cron jobs, background processes, or state machines | Optional |

---

## 10. Build Artifact Validation

### 10.1 Docker Image Size Gate

After Docker build, assert the image size stays below a threshold (target: 500 MB for standalone Next.js). Prevents accidental inclusion of devDependencies or source code in the runner stage.

**Status**: NOT_IMPLEMENTED.

### 10.2 Boot-Time Environment Validation Smoke

After `docker build`, run the container with CI test env vars (`PAYMENTS_STUB=true`, CI-safe JWT secrets) and verify it boots successfully -- Zod validation in `lib/config/env.ts` passes and the process starts without error. This catches missing env var definitions before deploy.

**Status**: NOT_IMPLEMENTED. See SI-006 Section 8 for the environment validation design.

### 10.3 Container Security Scan

Trivy or Grype scan on the built Docker image for OS-level CVEs. Currently only `pnpm audit` (when added) covers npm-level vulnerabilities.

**Status**: DEFERRED to post-Series A (same rationale as Snyk deferral in ADR-008 D6).

---

## 11. Post-Deploy Verification

### 11.1 Health Check

After Vercel deployment completes, verify `curl https://<domain>/api/health` returns HTTP 200. See SI-006 Section 2.1 (deployment contract verification checklist).

### 11.2 Smoke Test

Run `scripts/fresh-boot-smoke.sh` against the deployed URL. This script verifies: HTTP 200 on trip search, JSON array response, Cache-Control header, contract field shape, 400 on invalid parameters.

### 11.3 Migration Verification

Confirm `pnpm prisma migrate deploy` completed without errors. Check the `_prisma_migrations` table for the latest migration timestamp matching the deployed commit.

### 11.4 Cron Endpoint Health

Fire one cron endpoint (`/api/cron/sweep-holds`) with the `Authorization: Bearer <CRON_SECRET>` header and verify the response shape matches the DS-006 Section 2.3 contract: `{ job, status: 'success'|'failed'|'skipped_locked', rowsAffected, durationMs }`.

### 11.5 Rollback Trigger Definition

Conditions that trigger a rollback to the previous deployment:

| Trigger | Threshold |
|---------|-----------|
| Health check non-200 | 2 consecutive minutes after deploy |
| 5xx error rate | Exceeds 5% of requests in the first 10 minutes |
| Prisma migration failure | Forward-fix required (ADR-017 D1 -- no rollback of migrations) |
| Cron endpoint failure | Response does not match DS-006 contract shape |

Rollback procedure: redeploy the previous commit via Vercel dashboard or `vercel rollback`. Migration rollback is NOT possible (forward-only) -- if a migration is the cause, a forward-fix migration must be authored.

**Status**: NOT_DOCUMENTED operationally. Must be documented before Issue 094 go-live. See SI-006 Section 9 (provider migration playbook).

---

## 12. Performance Regression Gate

### 12.1 NFR Targets

SI-006 Section 5 defines latency and throughput targets:

| Metric | Target | Alert threshold |
|--------|--------|-----------------|
| Customer pages (LCP) | ≤ 2.5s | ≤ 4.0s |
| Trip search API p95 | ≤ 300ms | ≤ 500ms |
| Hold creation API p95 | ≤ 200ms | ≤ 400ms |
| Payment webhook p95 | ≤ 500ms | ≤ 1,000ms |
| Concurrent holds (Tet peak) | 2,000 | -- |

No performance testing infrastructure exists as of 2026-06-20 (SI-006 Known Gaps).

### 12.2 Stage 0 Performance Gate

For Stage 0 (current), extend the post-deploy smoke test (`scripts/fresh-boot-smoke.sh`) to assert LCP < 2.5s on the trip search page and API response time < 300ms on `/api/trips/search`. This provides a regression floor, not a load test.

### 12.3 Stage 1+ Performance Gate

When BullMQ worker is added (Stage 1 trigger: cron jobs exceed 30-second latency), introduce k6 or Artillery load testing as a CI stage. Targets from SI-006 Section 9.

**Status**: DEFERRED. Not a go-live blocker at Stage 0 scale.

---

## 13. Greppable Invariant Enforcement

The Mistake Log and SI-005 codify approximately 20 greppable invariants. They fall into three enforcement categories.

### 13.1 Already Automated in CI

These are enforced by the `data-leak-audit` CI job (`scripts/audit/data-leak-grep.sh`):

| Check | Invariant |
|-------|-----------|
| A1 | `tempPasswordPlain` must not leak outside allowlisted files |
| A2 | `accessToken` must not appear in unexpected `NextResponse.json` calls |
| A3 | `'use client'` components must not import server-only barrels (`@/lib/auth`, `@/lib/booking`, `@/lib/payment`) |
| A4 | `sameSite: 'lax'` count must not exceed baseline |
| A5 | Referrer-Policy must exist in codebase |
| A6 | `devtunnels` must not appear in `next.config.ts` |
| A7 | `OTP_PEEK_ENABLED` must not be referenced outside allowlisted files |

### 13.2 Automatable as Future CI Grep Checks

Target: consolidate into `scripts/audit/invariants.sh` and add as CI stage alongside `data-leak-audit`. See Section 14.3 for the `pnpm run invariants` specification.

| ID | Invariant | Grep Pattern | Source |
|----|-----------|-------------|--------|
| G1 | No `operatorId` from request body in operator routes | `grep -rn "body.*operatorId" app/api/op/` must return zero | ADR-008 D8 |
| G2 | No server-component self-fetch | `grep -rn "fetch.*localhost\|fetch.*NEXT_PUBLIC_BASE_URL" app/` in server components | Mistake Log Issue 002/003 |
| G3 | No JSON payload cron predicates | `grep -rn "payload->>" app/api/cron/` must return zero | Mistake Log Issue 014 |
| G4 | No `Math.round` in money modules | `grep -rn "Math\.round\|Math\.floor" lib/payouts/ lib/ledger/` | Mistake Log Issue 016 |
| G5 | No `Date.now()` in RSC render bodies | `grep -rn "Date\.now()\|Math\.random()" app/**/page.tsx` must not appear inside component function bodies | Mistake Log Issue 016 |
| G6 | No `'use client'` barrel imports (redundant with A3 but different scope) | `grep -rln "from ['\"]@/lib/auth['\"]" app/ components/ \| xargs head -1 \| grep "use client"` must return zero | Mistake Log Issue 092b |
| G7 | PII redaction coverage | `grep -rn "otpProof\|tempPassword\|accessToken\|refreshToken" lib/ app/ --include="*.ts" \| grep -v "redact\|REDACT\|sanitize"` must return zero (excluding type definitions) | ADR-007, Mistake Log Issue 007 |
| G8 | Mock method parity (semi-automatable) | `grep -rn "findUnique" __tests__/ \| grep "mock\|Mock"` → cross-check each against actual service call method | Mistake Log Issue 008 |
| G9 | Cron schedule parity | Verify `vercel.json` cron endpoints match DS-006 canonical schedule | DS-006 §2.1 |
| G10 | Hex mock validity | `grep -rn "Buffer\.from.*hex" __tests__/ \| grep -v "[0-9a-f]\{64\}"` should return zero | Mistake Log Issue 010 |
| G11 | `findFirst` vs `findUnique` — soft-delete models must use `findFirst` | `grep -rn "\.findUnique" lib/ app/ \| grep -i "customer\|operator"` should be checked against models with `deletedAt` | Mistake Log Issue 008 |

### 13.3 Code-Review-Only Invariants

These cannot be automated via simple grep and require human review:

- Timestamp-status pairing: every `<verb>At` column write must have a sibling `status:` update within 3 lines
- Error code throw coverage: every declared error-code union variant must have an actual `throw` + test
- Transaction + `FOR UPDATE` serialization: state-read-then-write must be inside `$transaction` with `SELECT ... FOR UPDATE`
- Concurrent-write integration test in same commit as lock code
- Discriminated result for idempotent operations (not thrown sentinel errors)
- Status codes match AC table verbatim (not "feels like a conflict" intuition)

---

## 14. PR Review Gates & Automated Quality Enforcement

### 14.1 Skills-Based PR Review Gates — Enforcement Model

All review gate skills operate in **advisory mode** (non-blocking, comment-only) during the current development phase. They become **blocking required checks** after the hardening phase is complete (all HD-001 through HD-005 audits pass). The escalation trigger is documented in the hardening index (`documentation/hardening/README.md`).

**Advisory mode behavior**: The skill runs on PR creation or update, posts findings as a PR comment, and does NOT block merge. The reviewer reads the findings alongside their manual review.

**Blocking mode behavior** (post-hardening): The skill runs as a GitHub Actions required status check. A finding tagged `FAIL` or `CRITICAL` blocks merge until resolved or explicitly overridden by a CODEOWNER.

### 14.2 Review Gate Skill Matrix

| Trigger Condition | Skill | Purpose | Priority |
|---|---|---|---|
| Every PR | `/code-review` | Automated code quality, pattern consistency, OWASP checks | Required |
| Every PR | `/security-review` | Security vulnerability scan, auth/CSRF/injection analysis | Required |
| Files in `prisma/migrations/` changed | `/migration-safety` | NOT NULL checklist, dual-declaration audit, CHECK constraint validation | Required |
| Files in `lib/payment/` or `lib/payout/` changed | `/ledger-invariants` | Financial integrity, BigInt math, append-only ledger guards | Required |
| Files in `app/api/cron/` or `lib/cron/` changed | `/observability-review` | Cron job health, idempotency, `SKIP LOCKED` pattern | Recommended |
| Files in `docker*`, `vercel.json`, or `deploy/` changed | `/rollback-plan` | Rollback procedure review, deployment strategy | Recommended |
| Files in `app/**/page.tsx` or `components/` changed | `/design-review` | UI consistency, accessibility, responsive design | Recommended |
| Release branch or `v*` tag | `/launch-checklist` | Go-live readiness gate (references GL-001) | Required |
| Files in `lib/auth/` or JWT-related | `/threat-model` | Auth flow threat analysis, token handling review | Recommended |
| Monthly or milestone boundary | `/debt-scan` | Technical debt inventory, deferred-work audit | Optional |

### 14.3 Consolidated Invariants Script (`pnpm run invariants`)

All greppable invariants from Section 13.1 (already automated) and Section 13.2 (future) should be consolidated into a single script: `scripts/audit/invariants.sh`. This script:

1. Runs all 7 existing data-leak-audit checks (A1-A7)
2. Runs all 11 new greppable checks (G1-G11)
3. Exits nonzero on any FAIL
4. Outputs a summary table: `PASS / FAIL / WARN` per check

**CI integration**: Add as pipeline Stage 1 (parallel with lint + typecheck). The `package.json` script entry:

```json
"invariants": "bash scripts/audit/invariants.sh"
```

**Pre-commit hook integration**: Optionally add after Gitleaks (Step 5 in the pre-commit sequence) for developers who want fast local feedback. Not mandatory — CI enforcement is the gate.

### 14.4 PR Template Specification

Create `.github/pull_request_template.md` with a mandatory checklist:

```markdown
## PR Checklist

### Always
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm run invariants` passes (or CI will catch it)

### If migration files changed
- [ ] NOT NULL column grep: `prisma.<Model>.create` + `INSERT INTO "<Model>"` across `lib/`, `app/`, `e2e/`, `prisma/seed.ts`, `__tests__/`
- [ ] Dual-declaration audit: every non-partial index in both `schema.prisma` and migration SQL
- [ ] CHECK constraint validation: grep all insert paths

### If status enum or state machine changed
- [ ] `LEGAL_*_TRANSITIONS` map updated (ADR-019 D2)
- [ ] DTO status union extended in same commit
- [ ] Timestamp + status written together (Mistake Log Issue 014)

### If error union extended
- [ ] Every new error code variant has a `throw` path AND a test
- [ ] HTTP status code matches AC table verbatim (Mistake Log Issue 011)

### If Prisma query method changed
- [ ] Mock method names updated in all `__tests__/` files
- [ ] `where` clause assertions updated (Mistake Log Issue 008)
```

### 14.5 Hardening & Go-Live Pipeline Gates

Two new gate categories reference the hardening (`documentation/hardening/`) and go-live (`documentation/go-live/`) documentation:

**Hardening gates** (run once before first production deploy, re-run on major changes):

| Gate | Document | Skill | Automated? |
|------|----------|-------|-----------|
| Security review | HD-001 | `/security-review` + `/threat-model` | Partially (skill + manual penetration test) |
| Performance audit | HD-002 | `/perf-audit` + `/ci-perf-gate` | Partially (no load test infra at Stage 0) |
| Error handling audit | HD-003 | `/observability-review` | Skill-assisted, manual verification |
| Barrel import hygiene | HD-004 | ESLint `boundaries/entry-point` + data-leak-audit A3 | Yes — CI-enforced |
| Tenant isolation audit | HD-005 | Grep `withOperatorScope` coverage | Partially (grep + manual review) |

**Go-live gates** (must all pass before Issue 094 production launch):

| Gate | Document | Skill | Automated? |
|------|----------|-------|-----------|
| Launch checklist | GL-001 | `/launch-checklist` | Manual checklist |
| Monitoring setup | GL-002 | `/observability-design` output as acceptance criteria | Manual verification |
| Backup & DR | GL-003 | `/backup-restore` + `/dr-drill` | Manual drill + script validation |
| Rollback plan | GL-004 | `/rollback-plan` | Manual procedure + documented |
| Smoke test suite | GL-005 | `/prod-smoke` + operator crawl script | Automated script |

### 14.6 Updated Pipeline Stage Sequence

With all enhancements, the target pipeline becomes:

| Stage | CI Job Name | Tool / Command | Gate Type | Blocks Deploy? |
|-------|------------|----------------|-----------|---------------|
| **1a. Lint + Type-check** | `lint-typecheck` | `pnpm lint` then `pnpm tsc --noEmit` | Static analysis | Yes |
| **1b. Invariants** | `invariants` | `pnpm run invariants` (§13.1 + §13.2) | Greppable rules | Yes |
| **2. Unit tests** | `unit-tests` | `pnpm test` (Vitest, mocked DB) | Correctness | Yes |
| **3. Integration tests** | `integration-tests` | `pnpm vitest:int` (real PG 16) | DB correctness | Yes |
| **4. Migration dry-run** | `migration-check` | `pnpm prisma migrate deploy` on shadow DB | Schema safety | Yes |
| **5. Security scan** | `security-scan` | Gitleaks + `pnpm audit --audit-level=high` | Supply chain + secrets | Yes |
| **6. SBOM generation** | `sbom` | `npx @cyclonedx/cyclonedx-npm --output-file sbom.json` | Supply chain inventory | No (informational) |
| **7. E2E tests** | `e2e-tests` | Playwright `mobile-390` project | Full user flows | Yes |
| **8. Docker build + size gate** | `docker-build` | `docker build` + assert size < 500MB | Artifact validation | Yes |
| **9. Deploy** | automatic | Vercel deploy (on main push) | Delivery | Production only |
| **10. Post-deploy verify** | `post-deploy` | Health check + smoke + cron endpoint + headers | Deployment validation | Production only |
| **11. Review gate skills** | PR comments | Skills from §14.2 (advisory → blocking post-hardening) | Quality review | Advisory initially |

Stages 1a, 1b, 2, 3, 4, 5, 6 run in parallel. Stage 7 depends on 1-6. Stage 8 depends on 7. Stage 11 runs async on PR creation independently of the main pipeline.

---

## Cross-References

- **ADR-007** -- Observability: P4 alert for missed cron runs
- **ADR-008** -- Security Posture: five-layer defense-in-depth (D1); Dependabot + `pnpm audit` (D6); secret management (D7); tenant isolation lint enforcement (D8)
- **ADR-016** -- Module Boundaries: client component deep-import rule (D3); barrel-as-public-API (D4); `data-leak-grep.sh` check A3
- **ADR-017** -- Schema Evolution: forward-only migrations (D1); two-phase destructive changes (D2); dual declaration (D3); NOT NULL checklist (D5); committed migrations immutable (D6)
- **ADR-018** -- Testing Strategy: test pyramid (D1); real DB mandate (D2); mock hygiene (D3-D6); E2E URL-driving (D7)
- **ADR-020** -- Deployment: Vercel Pro primary (D2/D11); Docker build (D3); Zod env validation (D4); standalone output (D8)
- **DS-002** -- Migration Strategy: Tet deployment freeze window; NOT NULL grep commands; CHECK constraint validation
- **DS-006** -- Background Jobs Design: canonical cron schedule source; dual-config maintenance; cron response contract
- **DS-017** -- Deployment Portability: deployment contract C1-C8; GHCR registry
- **SI-001** -- Project Scaffold: stack overview, toolchain baseline (§0), module architecture, multi-tenancy model, SDLC process overview (§9)
- **SI-002** -- Developer Environment: local toolchain, env vars, stub modes, Prisma workflow, dev port convention (3001)
- **SI-004** -- Linting and Formatting: full ESLint configuration, module boundary enforcement, pre-commit hooks, client component guard
- **SI-005** -- Testing Strategy: test pyramid details, mock hygiene rules, concurrency testing, NOT NULL checklist, financial math testing
- **SI-006** -- Deployment Configuration: full hosting architecture, deployment contract, staged evolution, post-deploy verification

---

## Known Gaps

### Go-Live Blockers (Issue 094)

| ID | Gap | Status | Source |
|----|-----|--------|--------|
| KG-01 | Dependabot + `pnpm audit` not in CI | NOT_IMPLEMENTED | ADR-008 D6 |
| KG-02 | HTTP security headers not configured | NOT_IMPLEMENTED | ADR-008 D4, Section 2.3 |
| KG-03 | PayoutAccount bank details stored plaintext | NOT_IMPLEMENTED | ADR-008 D3 |
| KG-04 | Branch protection rules not configured | NOT_CONFIGURED | Section 9.1 |
| KG-05 | Post-deploy health check + rollback definition | NOT_DOCUMENTED | Section 11 |
| KG-06 | No secrets rotation runbook (6 JWT/HMAC secrets) | NOT_IMPLEMENTED | ADR-008 D7 |

### Pipeline Gaps (non-blocker, enhance before Stage 1)

| ID | Gap | Status | Source |
|----|-----|--------|--------|
| KG-09 | Cron schedule parity check | NOT_AUTOMATED | Section 7.7, G9 |
| KG-10 | Migration safety CI automation | NOT_AUTOMATED | Section 7.6 |
| KG-11 | Performance / load testing | DEFERRED | Section 12 |
| KG-12 | Container security scan (Trivy/Grype) | DEFERRED | Section 10.3 |
| KG-14 | Greppable invariant CI enforcement (§13.2 items) | NOT_AUTOMATED | Section 13.2 |
| KG-15 | No hardening gate stage in pipeline — HD-001 through HD-005 audits undefined | NOT_DOCUMENTED | Section 14.5, `documentation/hardening/` |
| KG-16 | No go-live gate stage in pipeline — GL-001 through GL-005 checklists undefined | NOT_DOCUMENTED | Section 14.5, `documentation/go-live/` |
| KG-17 | State machine transition completeness — only 3/8 have `LEGAL_*_TRANSITIONS` maps, no CI check | NOT_ENFORCED | ADR-019 D2 |
| KG-18 | Cron job manifest — DS-006 defines 16 jobs but no CI step verifies all endpoints respond | NOT_AUTOMATED | DS-006 §4.1 |
| KG-19 | `after()` misuse detection — no lint rule preventing `after()` outside exempted paths | NOT_ENFORCED | ADR-013, DS-006 |
| KG-20 | Client barrel import guard — automated in A3 but greppable CI guard in G6 not yet in `invariants.sh` | PARTIALLY_AUTOMATED | ADR-016 D3, Mistake Log 092b |
| KG-21 | No dependency license audit in CI (GPL contamination risk) | NOT_IMPLEMENTED | ADR-008 |
| KG-22 | No SBOM generation in pipeline | NOT_IMPLEMENTED | Section 14.6 Stage 6 |
| KG-23 | No migration dry-run against shadow DB in CI | NOT_IMPLEMENTED | ADR-017, Section 14.6 Stage 4 |
| KG-24 | PII redaction coverage — no CI check that redact list covers all sensitive fields | NOT_AUTOMATED | ADR-007, G7 |
| KG-25 | BigInt/currency math lint — `Math.round` in money modules not CI-gated | NOT_AUTOMATED | Mistake Log Issue 016, G4 |

### Resolved

| ID | Gap | Resolution |
|----|-----|-----------|
| KG-07 | Data-leak-audit CI job undocumented | Documented in Section 2.5 |
| KG-08 | E2E suite runs on PRs (doc was stale) | Corrected in Section 3.2 |
