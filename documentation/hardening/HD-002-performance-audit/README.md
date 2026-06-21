# HD-002: Performance Audit

> Status: NOT_STARTED | References: ADR-002, SI-003 §12, SI-006 §9

## Purpose

Validate that the platform meets NFR latency and throughput targets defined in ADR-002 and SI-006 §9 before production launch. At Stage 0 (single VPS), this is a regression floor -- not a full load test.

## Skill Invocation

- **Primary**: `/perf-audit` -- code-level performance analysis of hot paths
- **Supplementary**: `/ci-perf-gate` -- CI stage configuration for performance regression detection

## Acceptance Criteria

### Latency Targets (SI-006 §9)

| Metric | Target | Alert Threshold | Verified? |
|--------|--------|-----------------|-----------|
| Customer pages LCP | ≤ 2.5s | ≤ 4.0s | [ ] |
| Trip search API p95 | ≤ 300ms | ≤ 500ms | [ ] |
| Hold creation API p95 | ≤ 200ms | ≤ 400ms | [ ] |
| Payment webhook p95 | ≤ 500ms | ≤ 1,000ms | [ ] |
| Concurrent holds (Tet peak) | 2,000 | -- | [ ] (Stage 1) |

### Hot Path Review

- [ ] Trip search query uses indexed columns, no sequential scans on large tables
- [ ] Hold creation uses `SELECT FOR UPDATE` without unnecessary lock contention
- [ ] Payment webhook processes within 500ms p95 (HMAC verify + DB write + response)
- [ ] Cron jobs: hold expiry batch size (500 rows per `FOR UPDATE SKIP LOCKED`) is appropriate
- [ ] No N+1 query patterns in trip listing, booking listing, or manifest pages

### Build Performance

- [ ] Docker image size < 500MB (SI-003 §10.1)
- [ ] Next.js build completes within reasonable time (< 5min on CI runner)
- [ ] Standalone output contains no devDependencies

### Database Performance

- [ ] All query-predicate columns have appropriate indexes
- [ ] Composite indexes match actual query patterns (e.g., `[template, scheduledFor]` on NotificationLog)
- [ ] No `payload->>'` predicates in cron queries (promoted to top-level indexed columns)
- [ ] PgBouncer transaction mode configured for connection pooling
- [ ] PgBouncer port 6432 connectivity verified from application container (SI-006)

### Standalone Output Verification

- [ ] Docker image contains no devDependencies: `docker run --rm <image> ls node_modules/.package-lock.json` — verify no dev-only packages present
- [ ] `next build` standalone output size verified < 500MB

## Stage 0 Verification Method

Run `scripts/fresh-boot-smoke.sh` against deployed instance with added timing assertions:
1. Trip search page LCP < 2.5s (via Lighthouse CLI or `curl` timing)
2. `/api/trips/search` response time < 300ms (via `curl -w '%{time_total}'`)
3. `/api/holds` POST response time < 200ms

## Stage 1 Verification Method

When cron jobs exceed 30-second latency (Stage 1 trigger), introduce k6 or Artillery:
- Sustained load: 100 concurrent users for 5 minutes
- Spike test: 500 concurrent users for 30 seconds (Tet simulation)
- Soak test: 50 concurrent users for 30 minutes (memory leak detection)

## Verdict

**PASS** when all Stage 0 latency targets are met via smoke test. Concurrent-hold target (2,000) deferred to Stage 1.

## Cross-References

- ADR-002 -- NFR targets
- SI-003 §12 -- performance regression gate
- SI-006 §9 -- latency and throughput targets
- DS-006 -- cron job batch sizes and timing
