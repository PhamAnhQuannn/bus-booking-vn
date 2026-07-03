# GL-005: Production Smoke Test Suite

**Status:** READY
**Date:** 2026-07-03
**References:** SI-003 §11.2, SI-006, DS-006

---

## Execution Command

```bash
pnpm run smoke:prod
```

Runs all categories below in sequence. Reports PASS/FAIL per category.

---

## 1. Customer Portal Smoke

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | Homepage loads | `GET /` | HTTP 200 |
| 2 | Trip search returns valid JSON | `GET /api/trips/search?from=...&date=...` | HTTP 200, JSON array with `tripId`, `departureAt`, `price`, `availableSeats` fields |
| 3 | Trip search Cache-Control | Same request | `Cache-Control` header present |
| 4 | Trip search rejects invalid params | `GET /api/trips/search` (no params) | HTTP 400 |
| 5 | Booking flow: search → hold | `POST /api/holds` with valid tripId | HTTP 200, returns `holdId` |
| 6 | Review page renders | `GET /booking/review` with valid `bb_hold` cookie | HTTP 200 |
| 7 | OTP send endpoint responds | `POST /api/auth/otp/send` | HTTP 200 or 429 (rate-limited) |

## 2. Operator Portal Smoke

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | Login page renders | `GET /op/login` | HTTP 200 |
| 2 | Console dashboard | `GET /op` (authed) | HTTP 200 |
| 3 | Bus listing | `GET /op/buses` (authed) | HTTP 200 |
| 4 | Route listing | `GET /op/routes` (authed) | HTTP 200 |
| 5 | Trip listing | `GET /op/trips` (authed) | HTTP 200 |
| 6 | Booking manifest | `GET /op/bookings` (authed) | HTTP 200 |
| 7 | Revenue report | `GET /op/reports/revenue` (authed) | HTTP 200 |
| 8 | All console pages non-500 | Operator crawl script | 0 BROKEN pages |

Existing script: `scripts/smoke/operator-crawl.mts`

## 3. Admin Portal Smoke

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | Admin login page | `GET /admin/login` | HTTP 200 |
| 2 | Admin dashboard | `GET /admin` (authed + TOTP) | HTTP 200 |
| 3 | Operator listing | `GET /admin/operators` (authed) | HTTP 200 |
| 4 | Platform settings | `GET /admin/settings` (authed) | HTTP 200 |

## 4. API Health

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | Health endpoint | `GET /api/health` | HTTP 200 |
| 2 | Response time | Same request | < 1s |

## 5. Cron Endpoint Smoke (DS-006)

| # | Check | Method | Pass Criteria |
|---|-------|--------|---------------|
| 1 | sweep-holds | `GET /api/cron/sweep-holds` with `Authorization: Bearer $CRON_SECRET` | HTTP 200, body matches `{ status, rowsAffected }` |
| 2 | retention | `GET /api/cron/retention` with bearer | HTTP 200, correct contract shape |
| 3 | sweep-sessions | `GET /api/cron/sweep-sessions` with bearer | HTTP 200, correct contract shape |

All cron endpoints must return `{ rowsAffected: number, status: 'success' | 'skipped_locked' }`.

## 6. Security Headers Smoke

Run `curl -I $PROD_URL` and verify presence of:

| # | Header | Expected |
|---|--------|----------|
| 1 | `X-Content-Type-Options` | `nosniff` |
| 2 | `X-Frame-Options` | `DENY` or `SAMEORIGIN` |
| 3 | `Strict-Transport-Security` | `max-age=...` present |
| 4 | `X-XSS-Protection` | `0` (modern browsers) or `1; mode=block` |
| 5 | `Referrer-Policy` | `strict-origin-when-cross-origin` or stricter |
| 6 | `Content-Security-Policy` | Present (any value) |

## 7. Performance Floor

| # | Metric | Target | Method |
|---|--------|--------|--------|
| 1 | Trip search page LCP | < 2.5s | Lighthouse or Web Vitals |
| 2 | `/api/trips/search` p95 | < 300ms | 100 requests, measure p95 |
| 3 | `/api/holds` POST p95 | < 200ms | 10 requests, measure p95 |

## Existing Scripts

| Script | Purpose |
|--------|---------|
| `scripts/fresh-boot-smoke.sh` | Basic health + page load checks |
| `scripts/smoke/operator-crawl.mts` | Playwright crawl of all operator console pages |
| `scripts/smoke/cross-persona-crawl.mts` | Multi-persona (customer + operator) crawl |

---

## Verdict Criteria

**PASS** when:
- All customer, operator, and admin portal pages return HTTP 200
- API health endpoint responds < 1s
- At least 3 cron endpoints respond with correct contract
- All 6 OWASP security headers present
- Performance metrics within targets

**FAIL** triggers:
- Any portal page returns 500
- API health non-200 for > 30s
- Any cron endpoint returns unexpected shape
- Missing security headers
