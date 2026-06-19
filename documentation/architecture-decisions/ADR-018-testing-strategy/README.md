# ADR-018: Testing Strategy

## Status
ACCEPTED

## Date
2026-06-17

## Context

The platform handles money, multi-tenant data isolation, and concurrent seat reservations — domains where bugs have direct financial impact. The testing strategy must catch correctness failures (not just type errors) while remaining practical for a small team. Recurring production-adjacent bugs have established a set of hard-learned testing rules.

**Sources**: `design/25-testing/`, `business/domain-model/invariants-catalog.md`

---

## Decisions

### D1: Test Pyramid — E2E, Integration, Unit

| Layer | Tool | What it tests | Database |
|-------|------|---------------|----------|
| **E2E** | Playwright | Full user flows (search → hold → book → pay) across browser | Real (test DB) |
| **Integration** | Vitest | Service functions with real DB (transactions, locks, constraints) | Real (test DB) |
| **Unit** | Vitest | Pure logic (fee calculation, state machine transitions, ref generation) | Mocked |

**Rationale**: Money and concurrency bugs are only caught by tests that hit the real database. A mocked test that passes does not prove the SQL is correct, the transaction boundaries are right, or the constraint enforcement works.

---

### D2: Integration Tests Use Real Database

Integration tests connect to a real PostgreSQL instance (Docker in CI, local in dev). No mocking of the database layer.

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Real DB** ✅ | Tests hit actual PostgreSQL | Catches SQL errors, constraint violations, transaction bugs, lock contention | Slower; requires DB setup; test isolation via transaction rollback or truncation |
| B. Mocked DB | Mock Prisma client | Fast; no DB dependency | Misses constraint violations, lock behavior, transaction semantics; mock/prod divergence |

**Choice**: Option A.

**Rationale**: A mock that returns `{ id: '1', status: 'paid' }` tells you nothing about whether the real `WHERE` clause, `FOR UPDATE` lock, or unique constraint actually works. Integration tests against a real DB are the only way to verify the SQL path.

---

### D3: Mock Method Names Must Match Reality

When a service function changes its Prisma query method (e.g., `findUnique` → `findFirst` due to adding a non-unique `WHERE` predicate), every hand-rolled mock that stubs the OLD method name must be updated in the same commit.

```typescript
// If service changed from:
tx.customer.findUnique({ where: { phone } })
// To:
tx.customer.findFirst({ where: { phone, deletedAt: null } })

// Then the mock MUST change from:
{ customer: { findUnique: vi.fn() } }
// To:
{ customer: { findFirst: vi.fn() } }
```

**Rationale**: Mock objects are string-keyed. Renaming the real call leaves the mock silently missing the new method — it throws `is not a function` only when that specific branch executes. The `where` clause assertion must also be updated to include any new predicates.

---

### D4: Every Error Code Variant Must Have a Test

When an error-code variant is added to a service's error union (e.g., `TripErrorCode`), the service file MUST contain an actual `throw` of that code, AND a test must exercise the negative path.

A union variant declared but never thrown is:
1. Dead code
2. A silently un-enforced acceptance criterion

**Rationale**: If the error code exists in the type but no code path throws it, the business rule it represents is not enforced. The route handler maps it to a status code, but the guard that would trigger it is simply absent.

---

### D5: Test Date Derivation Must Match Filter Timezone

When a test seeds a row with a timestamp and queries it through a timezone-aware filter (e.g., `serviceDate` in Asia/Ho_Chi_Minh), the test's date derivation MUST use the same timezone.

```typescript
// WRONG — UTC date string, but filter uses VN local date:
const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10)

// RIGHT — shift to VN local before extracting date:
const date = new Date(ms + 7 * 3600_000).toISOString().slice(0, 10)
// Or:
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(ms))
```

**Greppable smell**: `.toISOString().slice(0, 10)` paired with a service-date query parameter — UTC-vs-local timezone collision.

---

### D6: Crypto Hex Strings Must Be Valid

Any test that passes a string literal to `Buffer.from(s, 'hex')` MUST use a hex-valid string of the expected byte-width.

```typescript
// WRONG — non-hex chars decode to empty buffer:
Buffer.from('wronghash', 'hex')  // → Buffer.alloc(0)

// RIGHT — valid 64-char hex (32 bytes for SHA-256):
Buffer.from('a'.repeat(64), 'hex')  // → 32-byte buffer
```

**Rationale**: `Buffer.from(nonHex, 'hex')` silently produces an empty 0-byte buffer. `timingSafeEqual(Buffer.alloc(0), Buffer.alloc(0))` returns `true` — so a test using non-hex "wrong hash" strings will pass incorrectly, giving false confidence in the mismatch detection path.

---

### D7: E2E Tests Drive UI via URL State When Possible

E2E tests that are not specifically testing form interaction should bypass the form by navigating directly via URL parameters:

```typescript
// Instead of filling search form fields:
await page.goto('/search?' + new URLSearchParams({ from: 'TPHCM', to: 'Thanh Hoa', date: '2026-07-01' }))
```

**Rationale**: Third-party UI components (Base UI `<Input>`, etc.) own `onChange` internally and expose `onValueChange` as the public API. Playwright `fill()` / `pressSequentially()` routes through a spread `onChange` prop with timing-sensitive merge behavior — flaky across cold workers. URL-driven navigation lands directly on the server-rendered results page, is deterministic, and is faster.

---

## Consequences

### Positive

- **Real DB catches real bugs** — constraint violations, transaction failures, lock contention
- **Mock hygiene prevents false confidence** — method name and predicate drift caught at commit time
- **Error codes are enforced** — every declared error code has a throwing path and a test
- **Timezone bugs caught in test** — date derivation matches filter timezone
- **E2E stability** — URL-driven navigation eliminates form-interaction flakiness

### Negative

- **Integration tests are slower** — real DB setup + teardown per test or suite
- **CI requires Docker** — PostgreSQL container must be available
- **Mock update burden** — every Prisma query change requires grep-and-update of all mocks
- **E2E URL driving doesn't test the form** — form-specific bugs (validation, field interaction) require dedicated form tests
