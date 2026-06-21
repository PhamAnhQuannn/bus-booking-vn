# GL-005: Smoke Test Suite

> Status: NOT_STARTED | References: SI-003 §11.2, SI-006, DS-006

## Purpose

Define and verify the production smoke test suite that runs post-deploy to validate critical user paths are functional. Covers customer, operator, and admin portals.

## Skill Invocation

- **Primary**: `/prod-smoke` -- production smoke test execution and validation

## Acceptance Criteria

### Customer Portal Smoke

- [ ] Homepage loads with HTTP 200
- [ ] Trip search returns JSON array with correct field shape
- [ ] Trip search Cache-Control header present
- [ ] Trip search returns 400 on invalid parameters
- [ ] Booking flow: search → select → hold creation → review page renders
- [ ] OTP send endpoint responds (stub or real, depending on config)

### Operator Portal Smoke

- [ ] Operator login page renders
- [ ] Operator console dashboard loads after auth
- [ ] Bus listing page loads
- [ ] Route listing page loads
- [ ] Trip listing page loads
- [ ] Booking manifest page loads
- [ ] Revenue report page loads
- [ ] All console pages return HTTP 200 (not 500) -- prevents Issue 092b recurrence

### Admin Portal Smoke

- [ ] Admin login page renders
- [ ] Admin dashboard loads after auth
- [ ] Operator listing page loads
- [ ] Platform settings page loads

### API Health

- [ ] `/api/health` returns HTTP 200
- [ ] Response time < 1s

### Cron Endpoint Smoke (DS-006)

- [ ] `/api/cron/sweep-holds` responds with correct contract shape
- [ ] At least 3 cron endpoints verified with `Authorization: Bearer <CRON_SECRET>`
- [ ] Response matches DS-006 §2.3 contract: `{ job, status, rowsAffected, durationMs }`

### Security Headers Smoke

- [ ] `curl -I` against production URL returns all 6 OWASP headers (Section 2.6 of SI-003)

### Existing Scripts

- [ ] `scripts/fresh-boot-smoke.sh` passes against production URL
- [ ] `scripts/smoke/operator-crawl.mts` passes with 0 BROKEN pages (if deployed)

### Performance Floor

- [ ] Trip search page LCP < 2.5s
- [ ] `/api/trips/search` p95 < 300ms
- [ ] `/api/holds` POST p95 < 200ms

## Automated Execution

Target: a single `pnpm run smoke:prod` command that:
1. Runs `scripts/fresh-boot-smoke.sh` (existing)
2. Runs operator crawl (existing Playwright script)
3. Runs cron endpoint checks (new)
4. Runs security header checks (new)
5. Reports PASS/FAIL per category

## Verdict

**PASS** when all customer, operator, and admin portal pages return 200, API health passes, cron endpoints respond correctly, and security headers are present.

## Cross-References

- SI-003 §11 -- post-deploy verification
- SI-003 §12 -- performance regression gate
- SI-006 §9 -- NFR targets
- DS-006 §2.3 -- cron response contract
- Mistake Log Issue 092b -- operator portal barrel crash (operator crawl catches this class)
