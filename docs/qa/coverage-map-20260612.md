# Test Coverage Map — Bus-Booking

**Date:** 2026-06-12

## Summary

| Metric | Value |
|--------|-------|
| API routes | 134 total, 75 tested (56%) |
| Pages | 65 total, 0 unit tests, ~18 with E2E (28%) |
| Lib modules | 37 total, 27 with tests (73%), 10 with zero tests |
| Components | 13 dirs, 1 with tests (8%) |
| E2E specs | 18 total, 10 sandbox-gated |

## Critical Gaps (by priority)

### P1 — Untested Financial Operations (6 routes)
| Route | Methods | Status |
|-------|---------|--------|
| `/api/payments/card/webhook` | POST | **UNTESTED** — payment webhook! |
| `/api/payments/zalopay/webhook` | POST | **UNTESTED** — payment webhook! |
| `/api/cron/reconcile-payments` | GET | **UNTESTED** — payment reconciliation |
| `/api/admin/operators/[id]/confirm-payout-account` | POST | **UNTESTED** |
| `/api/op/reports/payouts` | GET | **UNTESTED** |
| `/api/op/reports/payouts/[id]/retry` | POST | **UNTESTED** |

### P2 — Untested Auth Operations (9 routes)
| Route | Methods | Status |
|-------|---------|--------|
| `/api/admin/auth/totp/enroll` | POST | **UNTESTED** — TOTP enrollment |
| `/api/admin/auth/totp/confirm` | POST | **UNTESTED** — TOTP confirm |
| `/api/admin/auth/step-up` | POST | **UNTESTED** — step-up re-auth |
| `/api/admin/auth/logout` | POST | **UNTESTED** |
| `/api/admin/auth/refresh` | POST | **UNTESTED** |
| `/api/auth/forgot-password` | POST | **UNTESTED** (E2E only) |
| `/api/auth/forgot-password/verify` | POST | **UNTESTED** (E2E only) |
| `/api/auth/reset-password` | POST | **UNTESTED** (E2E only) |
| `/api/auth/otp/test-peek` | GET | **UNTESTED** |

### P3 — Untested Booking Flow (4 routes)
| Route | Methods | Status |
|-------|---------|--------|
| `/api/bookings/initiate` | POST | E2E-ONLY — no unit test |
| `/api/trips/search` | GET | E2E-ONLY — no unit test |
| `/api/bookings` | GET | **UNTESTED** |
| `/api/bookings/[id]` | GET | **UNTESTED** |

### P4 — Untested Operator Routes (27 routes, 57% uncovered)
Largest gap. Trip management (11 routes), reports (4), staff (4), routes/pickup areas (5), manifest/bookings (3) — all lack unit tests. Many covered by E2E but no isolated tests.

## Lib Modules with ZERO Tests
- `core/` — shared infrastructure (db, validation, errors, config)
- `config/` — env configuration
- `reports/` — operator KPI/revenue reporting
- `stores/` — Zustand state management
- `format/`, `text/`, `seo/`, `home/`, `utils/`

## E2E Coverage Map

| Spec | Routes Exercised |
|------|-----------------|
| `hold-flow.spec.ts` | POST /api/holds, GET /api/trips/search, POST /api/bookings/initiate |
| `momo-booking.spec.ts` | POST /api/bookings/initiate, POST /api/payments/momo/webhook |
| `op-trips.spec.ts` | POST /api/op/trips, POST /api/op/trips/[id]/cancel, POST /api/op/trip-templates |
| `op-booking-queue.spec.ts` | GET /api/op/bookings, POST /api/op/trips/[id]/depart, /complete, GET /api/op/manifest |
| `op-fleet.spec.ts` | POST /api/op/buses, PATCH /api/op/buses/[id], POST /api/op/buses/[id]/deactivate |
| `op-routes.spec.ts` | POST /api/op/routes, PATCH /api/op/routes/[id], POST deactivate |
| `op-staff.spec.ts` | POST /api/op/staff, POST disable, POST assign-service |
| `auth-otp-roundtrip.spec.ts` | POST /api/auth/otp/send, POST /api/auth/otp/verify, POST register, login, logout |
| `account-settings.spec.ts` | PATCH /api/account/name, POST password, phone/init, phone/confirm, DELETE |
| `cron-recurring.spec.ts` | POST /api/cron/generate-trips |

**10 of 18 E2E specs are sandbox-gated** (require `E2E_*_ENABLED=true`). These don't run in CI by default.

## Top 5 Gaps to Address
1. **Payment webhooks** (card + zalopay) — P1, zero tests, real money at stake
2. **Admin TOTP flow** (enroll + confirm + step-up) — P2, security-critical, zero tests
3. **Booking initiate + search** — P3, revenue-critical, E2E-only (no unit tests)
4. **Operator trip management** — P4, 11 routes untested (largest single gap)
5. **lib/core/** — foundational module with zero tests
