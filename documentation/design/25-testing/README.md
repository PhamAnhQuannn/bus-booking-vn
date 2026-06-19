> ← [Previous](../24-disaster-recovery/) | [Index](../README.md) | [Next →](../26-evolution/)

## 25. Testing Strategy

### 25.1 Test Pyramid

```
        ╱ E2E (Playwright) ╲        ← Few: critical user flows
       ╱ Integration Tests   ╲      ← Many: domain logic + DB
      ╱ Unit Tests             ╲    ← Many: pure functions, validators
     ╱─────────────────────────────╲
```

### 25.2 Unit Tests

- Pure functions (fee calculation, booking ref generation, date math)
- Validation schemas
- State machine transitions
- Colocated: `lib/<domain>/__tests__/<fn>.test.ts`

### 25.3 Integration Tests

- Domain functions that touch the database (create booking, process payment, claim charter)
- Use a real PostgreSQL instance (not mocks — per Mistake Log lessons)
- Colocated: `lib/<domain>/__tests__/<fn>.int.test.ts`

### 25.4 E2E Tests (Playwright)

- Critical user flows: search → hold → pay → receive booking
- Operator flows: create trip, view manifest, scan ticket
- Admin flows: approve operator, process payout
- Located: `e2e/`

### 25.5 Key Testing Rules (from Mistake Log)

| Rule | Why |
|------|-----|
| Use real DB, not mocks, for integration tests | Mocks drift from reality (Issue 001) |
| Mock Prisma methods must match the real method name | `findUnique` vs `findFirst` mismatch = silent pass (Issue 008) |
| Every `NOT NULL` column added → grep all test fixtures | Missing columns in test INSERTs crash on first run (Issue 012) |
| Every error code in a union must have a throwing path | Declared-but-never-thrown = dead code + un-enforced AC (Issue 013) |
| Date derivation in tests must match the filter's timezone | UTC vs VN-local mismatch = intermittent failures (Issue 014) |
| Hex strings in crypto tests must be valid hex of correct length | Invalid hex → empty buffer → `timingSafeEqual(0, 0)` = true (Issue 010) |
