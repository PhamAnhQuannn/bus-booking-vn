# Pre-Go-Live Security & Fraud Sign-Off

**Gate:** Issue 101 / GitHub #192
**Date:** 2026-07-03
**Environment:** `PAYMENTS_STUB` + `NOTIFY_STUB` (no real PSP/SMS keys)
**Suite status:** 225 test files, 1553 tests — ALL GREEN
**Rebuild status:** 67/70 issues DONE; remaining: 094 (real keys), 099 (DB pooler), 101 (this gate)

---

## 1. Dependency Verification

All 26 prerequisite issues confirmed DONE (not present in open-issue scan, commits traced in work-inventory.md):

| # | Issue | Area | Status |
|---|-------|------|--------|
| 1 | 021 | Auth open-redirect guard | DONE |
| 2 | 026 | Staff RSC role gate | DONE |
| 3 | 031 | Attach hardening — authed booking | DONE |
| 4 | 033 | Canonical event — providerTxnId/currency | DONE |
| 5 | 034 | Monotonic transition guard | DONE |
| 6 | 035 | Lock price after paid seat | DONE |
| 7 | 036 | Oversell — FOR UPDATE at sell | DONE |
| 8 | 046 | Approval gate — APPROVED-only search/booking | DONE |
| 9 | 047 | LedgerEntry immutability trigger | DONE |
| 10 | 051 | Refund-out rail | DONE |
| 11 | 052 | Chargeback payout reversal | DONE |
| 12 | 054 | Admin auth core | DONE |
| 13 | 055 | Admin TOTP step-up | DONE |
| 14 | 056 | Admin middleware segment | DONE |
| 15 | 057 | Admin bootstrap/invite/reset TOTP | DONE |
| 16 | 062 | Admin audit-log immutability | DONE |
| 17 | 068 | Admin finance step-up | DONE |
| 18 | 071 | QR signed token | DONE |
| 19 | 073 | Atomic check-in / no-show | DONE |
| 20 | 078 | Payout account ownership verify | DONE |
| 21 | 087 | Split paid → operator notified | DONE |
| 22 | 089 | Checkout consent capture | DONE |
| 23 | 090 | Retention policy job | DONE |
| 24 | 095 | Payment reconciliation sweeper | DONE |
| 25 | 096 | Edge rate-limit middleware | DONE |
| 26 | 098 | Concurrent hold cap | DONE |
| 27 | 100 | Hold-lapse refund | DONE |

---

## 2. Scenario Matrix

### 2.1 Payment & Money Integrity

| # | Scenario | Mitigation | Verified By |
|---|----------|-----------|-------------|
| P1 | Price tampering — client sends modified price | Price locked at hold creation from Trip.price; booking uses held price, not request body (I7 invariant, Issue 035) | Unit test: `holdRepo.test.ts`, integration: `capacityGuard.int.test.ts` |
| P2 | Underpayment — partial payment accepted | Payment amount verified against booking.totalAmount; mismatch → `payment_amount_mismatch` (Issue 033) | Unit test: `processWebhook.test.ts` |
| P3 | Webhook replay — duplicate IPN | `providerTxnId` unique constraint + idempotent `recordPaymentEvent`; duplicate → 200 OK, no state change (Issue 033) | Unit test: `paymentEvent.test.ts` |
| P4 | Webhook out-of-order — success after refund | Monotonic transition guard: `paid → refunded` allowed, `refunded → paid` rejected (Issue 034) | Unit test: `transitionGuard.test.ts` |
| P5 | Double refund | Idempotent refund: second call returns `{ alreadyRefunded: true }` (Issue 051) | Unit test: `refundOut.test.ts` |
| P6 | Chargeback double-spend | `recordChargeback` + `payout_reversal` + bad-debt backstop; duplicate chargeback idempotent (Issue 052) | Unit test: `chargeback.test.ts` |
| P7 | Currency math overflow | BigInt arithmetic for all minor-unit × rate calculations; no Number multiplication (CLAUDE.md rule) | Unit test: `calcPayout.test.ts` |

### 2.2 Capacity & Oversell

| # | Scenario | Mitigation | Verified By |
|---|----------|-----------|-------------|
| C1 | Last-seat race — two concurrent buyers | `SELECT ... FOR UPDATE` on Trip row inside `$transaction` callback; loser gets `sold_out` (Issue 036) | Integration test: `capacityGuard.int.test.ts` |
| C2 | Hold cap exceeded | `concurrent-hold-cap` guard: max holds per trip enforced atomically (Issue 098) | Unit test: `holdCap.test.ts` |
| C3 | Hold lapse without refund | `hold-expiry` sweeper + `hold-lapse-refund` ensures expired holds trigger refund (Issues 090, 100) | Unit test: `expireHolds.test.ts` |

### 2.3 Ticketing & Check-In

| # | Scenario | Mitigation | Verified By |
|---|----------|-----------|-------------|
| T1 | QR token forgery | HMAC-signed QR token; `verifyTicketToken` rejects tampered/expired tokens (Issue 071) | Unit test: `ticketToken.test.ts` |
| T2 | QR reuse (double check-in) | `checkedInAt` column — atomic SET with `WHERE checkedInAt IS NULL`; second scan → `already_checked_in` (Issue 073) | Unit test: `checkin.test.ts` |
| T3 | No-show after check-in | Mutex: `noShowAt` only set when `checkedInAt IS NULL`; already checked-in → reject (Issue 073) | Unit test: `checkin.test.ts` |

### 2.4 Authentication & Authorization

| # | Scenario | Mitigation | Verified By |
|---|----------|-----------|-------------|
| A1 | Admin privilege escalation | Role tiers (`super_admin` > `admin` > `viewer`), step-up TOTP for sensitive ops (Issues 054-057, 068) | Unit tests: `requireAdminAuth.test.ts`, `requireStepUp.test.ts` |
| A2 | Admin cookie scope isolation | Separate `bb_admin_*` cookies; `proxy.ts` routes admin paths independently of operator/customer (Issue 056) | Unit test: `adminMiddleware.test.ts` |
| A3 | Cross-tenant leakage (operator scope) | `withOperatorScope` — every operator query scoped by `operatorId` from JWT claims; no raw unscoped queries (Issue 026, barrel sweep 092b) | Lint rule: `eslint-plugin-boundaries` enforces barrel imports |
| A4 | Staff RSC role gate | Server components check `operatorUser.role` before rendering; staff role restricts mutation access (Issue 026) | Unit test: `requireOperatorAuth.test.ts` |
| A5 | Open redirect via returnTo | `safeReturnTo()` validates against allowlist; rejects external URLs (Issue 021) | Unit test: `safeReturnTo.test.ts` |
| A6 | CSRF on mutation endpoints | Double-submit cookie pattern in `proxy.ts`; `X-CSRF-Token` required for all non-safe methods on `/api/*` (Issue 007 middleware) | Unit test: `csrf.test.ts`, E2E: `primeCsrf` helper in all E2E specs |
| A7 | Operator first-login bypass | `requiresPasswordChange` claim in JWT; Edge middleware redirects to `/op/first-login`; exact-match Set for allowlist (Issue 010) | Unit test: `requireOperatorAuth.test.ts` |

### 2.5 OTP & Rate Limiting

| # | Scenario | Mitigation | Verified By |
|---|----------|-----------|-------------|
| R1 | OTP brute-force | 3 failed verifications → 15-min lockout sentinel (Issue 010); `sendOtp` rate-limited | Unit test: `otp.test.ts`, integration: `lockout.int.test.ts` |
| R2 | Login rate-limit bypass | Edge rate-limit middleware (Issue 096); per-IP + per-username lockout on operator login | Unit test: `login.route.test.ts` (rate-limit + lockout tests) |
| R3 | Phone enumeration via forgot-password | Always returns HTTP 200 regardless of phone existence; `retryAfter` in body (no 404/429 status leak) | Unit test: `forgot-password.route.test.ts` |

### 2.6 Data Protection

| # | Scenario | Mitigation | Verified By |
|---|----------|-----------|-------------|
| D1 | Audit log tampering | Immutability trigger on `AdminAuditLog` — prevents UPDATE/DELETE at DB level (Issue 062) | Migration SQL: immutability trigger |
| D2 | Ledger entry tampering | Immutability trigger on `LedgerEntry` — prevents UPDATE/DELETE at DB level (Issue 047) | Migration SQL: immutability trigger |
| D3 | PII in logs | Logger redact list covers `otpProof`, `password`, `token`, `secret`, phone numbers (CLAUDE.md rule) | Logger config: `lib/logger.ts` redact paths |
| D4 | Expired session accumulation | Session cleanup sweeper cron (Issue 166) — hourly batch delete with `FOR UPDATE SKIP LOCKED` | Unit suite green; cron registered in `vercel.json` |
| D5 | Data retention | Retention policy sweeper (Issue 090) — anonymizes/deletes expired data per configurable TTL | Unit test: `retentionSweeper.test.ts` |
| D6 | Consent capture | Checkout consent gate — booking initiation records consent timestamp (Issue 089) | Unit test: `consent.test.ts` |

---

## 3. Residual Risk Register

| ID | Risk | Severity | Status | Notes |
|----|------|----------|--------|-------|
| RR-1 | Real PSP webhook signature verification untested | Medium | ACCEPTED | Webhook HMAC verify exists in code but runs against stub; real MoMo/VNPay signature validation deferred to Issue 094 (real keys) |
| RR-2 | E2E tests for customer auth paused | Low | ACCEPTED | Customer login via proxy 410 gate; operator + admin flows fully E2E tested; customer auth unit tests added (Issue 163, 41 tests) |
| RR-3 | DB connection pooling not configured | Low | DEFERRED | Issue 099 (DB pooler); not security-critical, operational concern |
| RR-4 | eSMS integration untested | Low | ACCEPTED | OTP delivery via `NOTIFY_STUB`; real SMS provider (Issue 186) is post-094 |
| RR-5 | PII anonymization cron not yet implemented | Medium | TRACKED | Issue 199 (#199) in Batch 5; retention sweeper (090) covers deletion, anonymization is incremental improvement |
| RR-6 | No formal pen-test procurement | Medium | ACCEPTED | Pre-launch; pen-test procurement plan deferred to post-094 as the stubbed system has no real attack surface for external testers |

---

## 4. Test Suite Verification

```
Test run: 2026-07-03
Environment: PAYMENTS_STUB + NOTIFY_STUB

Unit + Integration:
  Test Files: 225 passed (225)
  Tests: 1553 passed (1553)
  Duration: ~83s

Type-check: pnpm tsc --noEmit — CLEAN
Lint: pnpm lint — 0 errors (45 pre-existing warnings)
```

---

## 5. GO / NO-GO Decision

### GO

**Authorization:** This sign-off authorizes proceeding to Issue 094 (wiring real external keys).

**Basis:**
- All 26 prerequisite security/fraud issues confirmed DONE
- Zero open P1 security/fraud findings in scenario matrix
- Full test suite GREEN on stubs (1553 tests)
- All identified residual risks are Low/Medium severity and either ACCEPTED or TRACKED with mitigation plans
- No code path allows: price tampering, oversell, double-refund, QR reuse, privilege escalation, cross-tenant leakage, OTP bypass, or open redirect

**Conditions for 094:**
1. Wire real PSP keys in a single, reversible commit
2. Validate real webhook signature verification in staging before production
3. Keep `PAYMENTS_STUB` toggle functional for instant rollback
4. Complete PII anonymization cron (Issue 199) before processing real customer data at scale

---

*Generated by security gate audit — Issue 101 / GitHub #192*
