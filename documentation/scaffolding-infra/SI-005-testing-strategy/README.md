# SI-005: Testing Strategy

> Status: DOCUMENTED | References: ADR-018, ADR-009, ADR-017, DS-002

## Purpose

This document consolidates the BenXe platform's testing strategy across all layers -- unit, integration, and end-to-end -- into a single reference that cross-links the source ADRs and design specifications. The platform handles VND-denominated money, concurrent seat reservations, and multi-tenant operator data, where bugs have direct financial and legal consequences. The rules here are derived from hard-learned production-adjacent failures codified in ADR-018 and from the concurrency, migration, and financial-math constraints in ADR-009, ADR-017, and DS-002.

---

## 1. Test Pyramid

The platform uses three testing layers (ADR-018 D1):

| Layer | Tool | Scope | Database |
|-------|------|-------|--------|
| **E2E** | Playwright | Full user flows in a browser (search -> hold -> book -> pay) | Real (test DB) |
| **Integration** | Vitest | Service functions, repository functions, transaction boundaries, constraint enforcement | Real (test DB) |
| **Unit** | Vitest | Pure logic: fee calculation, state machine transitions, reference generation, OTP proof validation | Mocked |

The pyramid is intentionally weighted toward integration tests for this platform. Money and concurrency bugs surface only in code that hits the real database -- a mocked test that passes says nothing about whether the SQL is correct, the transaction boundary is right, or the unique constraint fires (ADR-018 D2).

The E2E layer is thin and covers critical happy paths only. Sandbox-gated E2E specs that require a fresh DB and cannot run in CI are acceptable for payment flows; they are never treated as a substitute for integration test coverage.

Unit coverage thresholds gate CI so the smallest layer still has an explicit floor.

---

## 2. Real Database Mandate for Integration Tests

Integration tests connect to a real PostgreSQL instance -- Docker in CI, local instance in development (ADR-018 D2). Database mocking is explicitly prohibited at the integration layer.

**What real-DB integration tests catch that mocks cannot:**

- SQL syntax errors in raw `$queryRaw` statements
- Unique constraint violations (idempotency key deduplication, partial unique indexes)
- `FOR UPDATE` lock semantics and deadlock behavior
- Advisory lock ordering (`pg_advisory_xact_lock` in hold creation)
- `CHECK` constraint enforcement
- `BEFORE UPDATE OR DELETE` trigger immutability guards on `LedgerEntry`, `ConsentRecord`, `AdminAuditLog`
- Transaction rollback on partial failure
- Conditional INSERT zero-rows result when capacity preconditions fail (ADR-009 D3)

**Test isolation:** Use transaction rollback (wrap each test in a transaction that is rolled back after the test) or table truncation between tests. Immutable tables (`LedgerEntry`, `ConsentRecord`, `AdminAuditLog`) cannot be truncated via the seed -- a `DROP SCHEMA` is required for full dev DB resets (see SI-002 Section 7.3).

**CI requirement:** A PostgreSQL container must be available in CI (see SI-003 Section 3.1). No integration test suite is acceptable when run against a fully mocked Prisma client.

---

## 3. Unit Test Mock Hygiene Rules

Unit tests use Vitest with hand-rolled Prisma client mocks. Four rules govern mock correctness; violations produce false-positive tests that give confidence in broken code (ADR-018 D3-D6).

### 3.1 Prisma Method Names Must Match Reality (ADR-018 D3)

When a service function changes its Prisma query method -- most commonly `findUnique` to `findFirst` when a `WHERE` predicate is added on a non-unique column -- every mock that stubs the old method name must be updated in the same commit.

Mock objects are plain string-keyed JavaScript objects. Renaming the real call leaves the mock silently missing the new method; the test throws `is not a function` only when that specific branch executes, not at mock-construction time.

The `where` clause assertion must also be updated. When a new predicate is added (e.g., `deletedAt: null` for soft-delete filtering), the `toHaveBeenCalledWith({ where: { ... } })` assertion must include the new predicate.

**Greppable smell:** Any unit test asserting `.toHaveBeenCalledWith({ where: { ... } })` on a Prisma mock must be re-checked whenever the source `where` clause gains a column.

### 3.2 Crypto Hex Strings Must Be Valid (ADR-018 D6)

Any test that passes a string literal to `Buffer.from(s, 'hex')` must use a hex-valid string of the expected byte-width:

- SHA-256 hash: 64 hexadecimal characters (32 bytes)
- Non-hex characters silently produce an empty 0-byte buffer
- `timingSafeEqual(Buffer.alloc(0), Buffer.alloc(0))` returns `true` -- a "wrong hash" test using a non-hex string passes incorrectly

Reusable helper: `const hexMock = (byte: 'a' | 'b', len = 32) => byte.repeat(len * 2)` -- produces valid 64-char hex strings for SHA-256 tests.

### 3.3 Test Date Strings Must Match Filter Timezone (ADR-018 D5)

When a test seeds a row with a timestamp and queries it through a timezone-aware filter -- specifically `serviceDate` which is interpreted in `Asia/Ho_Chi_Minh` (UTC+7) -- the test's date derivation must use the same timezone.

Using `.toISOString().slice(0, 10)` produces a UTC date string. When the test instant's UTC date and its Vietnam-local date differ (which occurs for any instant between 00:00 and 07:00 UTC), the filter window does not cover the seeded trip's departure and the test fails intermittently.

Correct approaches:

```typescript
// Shift to VN local before extracting date:
const date = new Date(ms + 7 * 3600_000).toISOString().slice(0, 10)

// Or use Intl explicitly:
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(ms))
```

**Greppable smell:** `.toISOString().slice(0, 10)` paired with a `serviceDate` or `businessDate` query parameter flags a potential UTC-vs-local timezone collision.

### 3.4 Every Declared Error Code Must Have a Throwing Path and a Test (ADR-018 D4)

When an error-code variant is added to a service's tagged error union (e.g., `TripErrorCode`, `BusErrorCode`), the service file must contain an actual `throw` of that code in the same commit. A test must exercise the negative path.

A union variant declared but never thrown is dead code and a silently un-enforced acceptance criterion. When adding an error code variant, grep the service file for an actual `throw` of that code before committing.

---

## 4. End-to-End Tests with Playwright

### 4.1 Drive Form-Incidental E2E via URL Parameters (ADR-018 D7)

E2E tests that are not specifically testing form interaction must bypass forms by navigating directly via URL parameters rather than filling form fields with synthetic keystrokes.

Third-party UI component libraries (Base UI, Radix, etc.) own `onChange` internally and expose `onValueChange` as the public API. Playwright `fill()` and `pressSequentially()` route through timing-sensitive merge behavior and are flaky across cold workers. URL-driven navigation lands directly on the server-rendered results page and is deterministic.

**When to test the form directly:** Only when the test's explicit purpose is validating form behavior -- validation error messages, field interaction, accessibility of form controls.

### 4.2 Sandbox-Gated Specs

Some E2E specs are sandbox-gated: they require a fresh database, cannot run in CI, and are executed manually only. This includes payment flow specs that drive MoMo or VNPay redirect pages.

Rules for sandbox-gated specs:

- They must be clearly marked with a `// @sandbox-only` comment and excluded from CI configuration
- They are not a substitute for integration test coverage
- NOT NULL column breakage and other DB-schema violations in sandbox-gated specs will rot silently until the first manual run -- apply the NOT NULL grep checklist (Section 6.1) to these files equally

The operator flow crawl (`scripts/smoke/operator-crawl.mts`) demonstrated that a dedicated smoke script can surface regressions that unit and integration tests miss because they operate below the HTTP layer.

### 4.3 CSRF Header Threading in E2E

Because the CSRF double-submit middleware gates all non-safe `/api/*` routes, Playwright specs must extract the `bb_csrf` cookie and include the `X-CSRF-Token` header on all POST/PUT/DELETE requests. Use `e2e/helpers/csrf.ts` `primeCsrf()` before any mutation phase. Webhook routes authenticated via HMAC (`/api/payments/momo/webhook`) are exempt from CSRF.

### 4.4 Toolkit and commands

The shared test toolkit lives under `test/helpers/`:

- `hexMock(byte, len)` for valid SHA-256 hex strings in `Buffer.from(..., 'hex')` tests.
- `vnLocalDate(instant)` for Vietnam-local date derivation in service-date assertions.
- `resetIntegrationTables(prisma)` for deterministic integration cleanup.
- `expectNoForbiddenFields(body)` for response-shape assertions.
- `makeOperator`, `makeBus`, `makeRoute`, `makeTrip` for schema-aligned fixtures.

The command surface is:

- `pnpm test:unit` for unit Vitest.
- `pnpm test:cov` for coverage with `coverage/lcov.info`.
- `pnpm vitest:int` or `pnpm test:int` for integration runs after `scripts/test/prepare-int-db.ts` seeds the DB.
- `pnpm test:e2e` for Playwright.

`scripts/test/prepare-int-db.ts` is intentionally separate so local runs and CI both execute the same migrate-and-seed path before integration tests.

---

## 5. Concurrency Testing

Concurrency bugs in seat reservation are not catchable at the unit test layer. Only integration tests with a real database can verify lock semantics (ADR-009 D1, D2, D6).

### 5.1 Transaction + Lock Tests

The canonical `$transaction` + `SELECT FOR UPDATE` pattern is defined in SI-001 §6.3. Integration tests for any capacity-affecting operation must verify:

1. The operation uses `prisma.$transaction(async (tx) => { ... })` callback form -- NOT the array form (ADR-009 D6). The array form provides no `tx` handle and cannot issue `SELECT FOR UPDATE`.
2. A `SELECT ... FOR UPDATE` or `pg_advisory_xact_lock` is acquired on the gating row before reading capacity state.
3. The conditional INSERT produces zero rows when capacity is exhausted -- test the zero-row path explicitly.

### 5.2 Concurrent-Write Integration Tests in Same Commit as Lock Code

When lock logic is added to a service, a concurrent-write integration test must land in the same commit. The lead's own happy-path test will pass without the lock -- only a concurrent-write test exercises it.

Concurrent-write test pattern: use `Promise.all` to fire two service calls against the same trip simultaneously; assert that exactly one succeeds and the other fails with the appropriate error code.

### 5.3 Lock Ordering

Advisory locks in hold creation always acquire phone-level lock first, then trip-level lock (ADR-009 D2). Any integration test that simulates concurrent hold creation from the same phone must use this ordering to avoid deadlock.

### 5.4 Three-Layer Capacity Guard Test Coverage

Each of the three capacity guard layers (ADR-009 D7) requires distinct test coverage:

| Layer | Test Type | What to Assert |
|-------|-----------|---------------|
| Layer 1: Hold creation conditional INSERT | Integration | Zero-row INSERT when capacity exhausted; one row when capacity available |
| Layer 2: Payment webhook re-count | Integration | `SELECT FOR UPDATE` on Trip; `status = 'refunded'` when `paid > capacity` |
| Layer 3: Phone hold cap | Integration | Advisory lock prevents second hold from same phone exceeding `CONCURRENT_HOLD_CAP` |

---

## 6. Migration Testing

### 6.1 NOT NULL Column Grep Checklist (ADR-017 D5, DS-002)

Before merging any migration that adds a NOT NULL column to an existing model, run both greps and fix every hit:

```
grep -r "prisma\.<model>\.create" lib/ app/ e2e/ prisma/seed.ts __tests__/
grep -r "INSERT INTO \"<Model>\"" e2e/ prisma/ __tests__/
```

Every result must include the new column with a valid value. This applies equally to:

- TypeScript `prisma.model.create()` calls in integration test `beforeAll` blocks
- Raw `INSERT INTO` statements in e2e specs
- `prisma/seed.ts` seed fixtures

Sandbox-gated specs that never run in CI rot silently and surface only when the first AC test executes against a fresh DB.

PII column placeholders must escape the project's PII detection regex. Use literal-x mask format `+8490xxxxxx[N]` rather than all-digit placeholders (see SI-004 Section 5.2).

### 6.2 CHECK Constraint Validation Against All Insert Paths

Any CHECK constraint that encodes a domain assumption must be validated against every insert path before the migration ships. A constraint exercised only by sandbox-gated tests is a time-bomb that detonates on the first production-path insert in a later issue (the `OperatorUser_phones_differ` constraint detonated 10 issues after it shipped).

### 6.3 Schema Parity Audit (ADR-017 D3, DS-002)

The `prisma migrate diff` CLI flag names changed in Prisma 7.x -- do not use the `--from-schema-datamodel`/`--to-schema-datasource` invocation from prior documentation without first running `node_modules/.bin/prisma migrate diff --help` to confirm current flags.

The substitute verification is a manual side-by-side audit: read `@@index` declarations in `schema.prisma` alongside `CREATE INDEX` statements in the migration SQL and confirm line-for-line agreement.

### 6.4 Sweeper Predicate Columns

Any field that will be a WHERE-clause predicate in a cron/sweeper query must be a top-level indexed column, never a JSON payload key. Greppable smell: `payload->>'fieldName'` in any `app/api/cron/**` file flags a future sequential scan.

Integration tests for sweeper functions must assert both the column value and that the payload object does NOT contain the same field as a JSON key (to guard against dual-source drift).

---

## 7. NOT NULL Column Rule Summary

This rule appears across ADR-017 D5, DS-002, and the project mistake log. It is consolidated here as a single actionable statement:

**Before merging a migration that adds a NOT NULL column to any model, grep every `prisma.<model>.create` call and every `INSERT INTO "<Model>"` statement across `e2e/**`, `prisma/seed.ts`, and `**/__tests__/**` and update every hit to include the new column. This step is not optional and is not covered by `tsc --noEmit` alone -- raw SQL `INSERT INTO` statements are not type-checked.**

The same rule extends to `prisma.model.update` calls when a NOT NULL column is added without a database-level default.

---

## 8. Financial Math Testing

All monetary values in BenXe are VND integers with no decimal component. Platform fee computation multiplies an integer minor-unit gross amount by a fractional rate (e.g., 6% = 0.06).

### 8.1 BigInt Domain for Currency Computation

Any test for currency math must verify the computation is done in the BigInt domain. Floating-point multiplication of VND integer amounts introduces representation drift before reaching the 2^53 safe-integer ceiling.

Correct pattern: encode `platformFeePct` as BigInt arithmetic with `BigInt(Math.round(pct * 10**10))`, perform all multiplication in BigInt domain, detect exact ties via `remainder * BigInt(2) === denominator`, then `Number(...)` the final integer result only at the end. Since the project targets ES2017, use `BigInt(n)` constructor calls throughout -- the `n` literal suffix (`1n`, `2n`) is a parser error under `--target es2017`.

### 8.2 Greppable Smell for Money-Handling Modules

The following patterns in `lib/payouts/**` or any other money-handling module are bugs:

- `Math.round(<int> * <fractional>)` -- must be promoted to BigInt arithmetic
- `Math.floor(<minor-unit-int> * <rate>)` -- must be promoted to BigInt arithmetic
- `Number(<bigint>) * <rate>` -- converts back to floating-point before rate multiplication

Unit tests for payout calculation functions must include edge cases where the Number and BigInt results diverge.

### 8.3 RSC Render Purity

Server component render bodies must not call `Date.now()`, `Math.random()`, or `crypto.randomUUID()` -- these violate RSC render purity and defeat RSC caching. Compute time-derived defaults in a module-scope helper outside the component function. Greppable smell: `Date.now()` inside `export default async function <Name>Page(...)` body in any `app/**/page.tsx`.

---

## Cross-References

- **ADR-018** -- Testing Strategy: test pyramid, real DB mandate, mock hygiene, E2E URL-driving
- **ADR-009** -- Concurrency and Seat Holding: advisory locks, conditional INSERT, three-layer capacity guard, `$transaction` callback form
- **ADR-017** -- Schema Evolution and Migration Safety: forward-only, dual declaration, NOT NULL checklist, committed migrations immutable
- **DS-002** -- Migration Strategy: operationalizes ADR-017; adds regulatory constraints, NOT NULL grep commands, CHECK constraint validation, sweeper predicate rules
- **SI-002** -- Developer Environment: local database setup, seed data, LedgerEntry reseed constraint
- **SI-003** -- CI/CD Pipeline: test database provisioning in CI, E2E sandbox gating
- **SI-004** -- Linting and Formatting: test-related lint rules, PII placeholder patterns
- **SI-006** -- Deployment Configuration: cron sidecar testing, load test infrastructure gaps, production NFR targets that tests should validate

---

## Known Gaps

- No documented strategy for load testing the advisory lock contention path under Tet-surge conditions (2,000 concurrent booking attempts, ADR-009 context). Load test thresholds and tooling are not specified.
- Sandbox-gated E2E specs for MoMo and VNPay payment flows are excluded from CI with no documented schedule or owner for manual execution.
- `HOLD_SWEEPER_MODE` defaults to `'update'` (active sweep). Dev overrides to `'count'` (dry-run). No integration test currently validates the live sweep path end-to-end.
- The concurrent-write integration test requirement (Section 5.2) has no CI enforcement mechanism -- it is a code-review rule only.
- Financial math BigInt tests are required by rule but there is no linter or static-analysis check enforcing the absence of `Math.round(<int> * <fractional>)` patterns in money-handling modules.
