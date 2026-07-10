# FI-001: Core Authentication (Xac thuc nguoi dung)

> **Status:** DOCUMENTED
> **Last Updated:** 2026-06-20
> **Related:** ADR-003, ADR-008, DS-001, DS-003, FD-012

## Overview

Core Auth establishes three fully isolated authentication realms -- Customer (OTP-only passwordless via phone), Operator (Nha Xe) (password + OTP hybrid), and Admin (password + TOTP MFA) -- each with independent session lifecycles, JWT secrets, cookie namespaces, and session tables. The architecture uses a hybrid short-lived JWT access token (15 min) plus refresh token rotation to enable Edge middleware auth verification without DB hits while preserving revocability. All state-changing API calls are protected by a stateless double-submit CSRF cookie.

**Auth Provider: Better Auth** (self-hosted in Next.js, Prisma adapter — ADR-003 D8). Better Auth handles password hashing (bcrypt cost 12), session management, refresh token rotation with reuse detection, brute-force rate limiting, TOTP (setup/verify/backup codes/replay protection), and OTP (via custom eSMS adapter). Our app retains responsibility for realm routing, tenant isolation (`withOperatorScope`), CSRF double-submit, Zod validation, IDOR checks, race condition guards, and webhook auth. See ADR-003 D8 for full provider-vs-app responsibility split.

> **Phase 1 Scope:** Staff management deferred to Phase 2 (ADR-003 D12). Phase 1 = single operator user per company (`role='admin'` only). Staff-related auth items (RBAC enforcement, staff-blocked endpoints, StaffTripAssignment) documented here for completeness but not active in Phase 1.

## Scope & Boundaries

### In Scope

- Customer OTP send/verify/register/login/refresh/logout/account-delete flows
- Operator username+password login, first-login forced password change, OTP step-up for sensitive operations
- Admin email+password+TOTP login and TOTP enrollment
- JWT minting (HS256, 15-min access token), cookie setting, refresh token rotation with token-family reuse detection
- CSRF double-submit cookie enforcement in Edge middleware
- Phone-based OTP rate limiting and 15-minute lockout sentinel
- Guest booking backfill (`attachGuestBookingByPhone`) on registration
- `requiresPasswordChange` JWT claim encoding for Edge-level first-login gate
- `requireCustomerAuth`, `requireOperatorAuth`, `requireAdminAuth` guard functions

### Out of Scope

- Consent collection -> [FI-013](../FI-013-customer-account/README.md) / FD-019
- DSAR / account anonymization -> [FI-013](../FI-013-customer-account/README.md) / DS-015
- Operator KYB onboarding, provisioning -> [FI-002](../FI-002-operator-onboarding/README.md)
- Admin invite flow -> [FI-012](../FI-012-admin-console/README.md)
- OTP delivery channel management / eSMS integration -> [FI-014](../FI-014-notifications/README.md)
- TOTP backup codes (documented but NOT IMPLEMENTED)

### Bounded Context(s)

**Auth Context** -- Customer Realm, Operator Realm, Admin Realm. Each realm is isolated within `lib/auth/` with separate JWT secrets, cookie namespaces, session tables, and guard functions.

**Dependencies on other FI features:**
- [FI-013](../FI-013-customer-account/README.md) (Customer Account): `Customer` model, `Session` model, `ConsentRecord` model, account soft-delete
- Notification Context: OTP delivery via `lib/auth/sendOtp.ts` -> `lib/notification/esms.ts`
- Redis (Upstash/FPT Managed): `jti` SETNX for `otpProof` single-use enforcement, IP-based rate limiting

## Key Entities

| Model | Key Columns | Constraints | Notes |
|-------|-------------|-------------|-------|
| Customer | id (CUID PK), phone (String?), email (String?), passwordHash (String?), displayName (String?), createdAt, updatedAt, lastLoginAt (DateTime?), deletedAt (DateTime?), anonymizedAt (DateTime?), suspendedAt (DateTime?) | `@unique` on phone (allows multiple NULLs), partial unique on email WHERE NOT NULL (`Customer_email_key`) | phone set to NULL on soft-delete; `findFirst` (not `findUnique`) required when filtering with `deletedAt: null`; `passwordHash` exists but unused in current auth flow (IMPLEMENTED_DIFFERENTLY) |
| OtpAttempt | id (CUID PK), phone (String NOT NULL), codeHash (String NOT NULL), salt (String NOT NULL), expiresAt (DateTime NOT NULL), consumed (Boolean default false), consumedAt (DateTime?), attemptCount (Int default 0), createdAt, ipAddress (String?) | Partial unique index `OtpAttempt_phone_active_key` WHERE consumed = false (SQL-only) | **Dual semantics**: `consumed=false AND expiresAt>NOW()` = active OTP; `consumed=true AND attemptCount>=3 AND expiresAt>NOW()` = lockout sentinel (expiresAt extended to now+15min). Supersedes on re-send via ON CONFLICT. |
| Session | id (CUID PK), customerId (String NOT NULL FK->Customer), refreshTokenHash (String NOT NULL @unique), tokenFamily (String NOT NULL), rotationCount (Int default 0), expiresAt (DateTime NOT NULL), createdAt, revokedAt (DateTime?) | `@unique` on refreshTokenHash | SHA-256 hash of refresh token; revocation via revokedAt; family rotation for reuse detection |
| OperatorUser | id (CUID PK), operatorId (String NOT NULL FK->Operator), username (String NOT NULL @unique), phone (String NOT NULL @unique), contactPhone (String NOT NULL), notificationPhone (String NOT NULL), passwordHash (String NOT NULL), requiresPasswordChange (Boolean default true), displayName (String NOT NULL), role (OperatorRole default admin), disabledAt (DateTime?), createdAt, updatedAt, lastBookingsViewedAt (DateTime?) | `@unique` on username, `@unique` on phone | username format: `BRAND_ACRONYM-last4phone`; `requiresPasswordChange` encoded into JWT claim for Edge gate |
| OperatorSession | id (CUID PK), operatorUserId (String NOT NULL FK->OperatorUser), refreshTokenHash (String NOT NULL @unique), tokenFamily (String NOT NULL), rotationCount (Int default 0), expiresAt (DateTime NOT NULL), createdAt, revokedAt (DateTime?) | `@unique` on refreshTokenHash | Mirrors Session but for operator realm |
| OperatorOtpAttempt | id (CUID PK), phone (String NOT NULL), codeHash (String NOT NULL), salt (String NOT NULL), expiresAt (DateTime NOT NULL), consumed (Boolean default false), consumedAt (DateTime?), attemptCount (Int default 0), createdAt, ipAddress (String?) | Same structure as OtpAttempt | Operator-specific OTP model; separate from customer OtpAttempt |
| AdminUser | id (CUID PK), email (String NOT NULL @unique), passwordHash (String NOT NULL), role (AdminRole NOT NULL), totpSecret (String?), totpEnabledAt (DateTime?), invitedBy (String?), status (AdminStatus default ACTIVE), createdAt, updatedAt | `@unique` on email | `totpSecret` AES-256-GCM encrypted at rest via `TOTP_ENCRYPTION_KEY` |
| AdminSession | id (CUID PK), adminUserId (String NOT NULL FK->AdminUser), refreshTokenHash (String NOT NULL @unique), tokenFamily (String NOT NULL), rotationCount (Int default 0), expiresAt (DateTime NOT NULL), createdAt, revokedAt (DateTime?) | `@unique` on refreshTokenHash | Admin realm; 24-hour refresh TTL (shorter than customer 7-day) |

**Enums relevant to FI-001:**

| Enum | Values |
|------|--------|
| OperatorRole | `admin`, `staff` |
| AdminRole | `SUPER_ADMIN`, `FINANCE`, `SUPPORT` |
| AdminStatus | `ACTIVE`, `DISABLED` |

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/auth/otp/send` | Public (rate-limited) | Send OTP to Vietnamese phone `+84[35789]\d{8}` | 200, 429 (rate limit: 5 req/15min per IP+phone), 403 (lockout active) |
| POST | `/api/auth/otp/verify` | Public | Verify 6-digit OTP code; returns `otpProof` JWT + `isRegistered` bool | 200, 422 (invalid code, attemptCount++), 403 (lockout: 3 failures -> 15-min sentinel) |
| POST | `/api/auth/register` | Public (otpProof required) | Register new customer with verified phone; `otpProof` JWT single-use (jti via Redis SETNX) | 201 (customer + cookies set), 422 (validation), 400 (expired/consumed proof) |
| POST | `/api/auth/login` | Public (otpProof required) | Login with verified phone; `otpProof` with `purpose:'login'` | 200, 401, 403 |
| POST | `/api/auth/refresh` | HttpOnly cookie | Rotate refresh token, issue new access token | 200, 401 (reuse detected -> family revoked) |
| POST | `/api/auth/logout` | Customer JWT | Revoke current session, clear cookies | 200 |
| DELETE | `/api/auth/account` | Customer JWT | Soft-delete account (PDPL erasure right): deletedAt=now, phone=NULL, sessions revoked | 200 |
| POST | `/api/op/auth/login` | Public (rate-limited) | Operator login: username + password | 200 (if requiresPasswordChange=true -> Edge redirect to /op/first-login), 401 |
| POST | `/api/op/auth/password` | Operator JWT | Change password (first-login or voluntary); mints fresh JWT with requiresPasswordChange=false | 200 |
| POST | `/api/op/auth/refresh` | HttpOnly cookie + X-CSRF-Token | Rotate operator refresh token | 200, 401 |
| POST | `/api/op/auth/logout` | Operator JWT | Revoke operator session | 200 |
| POST | `/api/admin/auth/login` | Public (rate-limited) | Admin email+password; then TOTP step 2 | 200, 401, 403 |
| POST | `/api/admin/auth/refresh` | HttpOnly cookie | Rotate admin refresh token | 200, 401 |

### CSRF Configuration

| Component | Value |
|-----------|-------|
| Cookie | `bb_csrf` (non-HttpOnly, readable by JS) |
| Header | `X-CSRF-Token` |
| Required on | All non-safe methods (POST/PUT/PATCH/DELETE) to `/api/*` |
| Exempt | `/api/payments/*/webhook` (HMAC/bearer authenticated) |
| Client helper | `readCsrfToken()` from `@/lib/auth/csrfClient` (NEVER `@/lib/auth` barrel) |

### Rate Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `/api/auth/otp/send` | 5 req | 15 min | IP + phone |
| `/api/auth/otp/verify` | 3 attempts | Per OTP | Phone (lockout) |
| `/api/auth/login` | 10 req | 15 min | IP |
| `/api/auth/register` | 5 req | 15 min | IP |
| General API | 100 req | 1 min | IP |
| Admin API | 30 req | 1 min | IP |

## State Machine

### OTP Lifecycle

Implicit states derived from `OtpAttempt` row fields (no explicit status enum).

**Logical states:**
- **Active**: `consumed = false`, `expiresAt > NOW()`, `attemptCount < MAX`
- **Consumed (success)**: `consumed = true`, `consumedAt` set (normal verification success)
- **Expired**: `consumed = false`, `expiresAt <= NOW()`
- **Lockout sentinel**: `consumed = true`, `attemptCount >= 3`, `expiresAt = NOW() + 15min` (repurposed row)
- **Attempt-capped**: `consumed = false`, `attemptCount >= MAX_OTP_ATTEMPTS` (5 for auth, 3 for account-management)

**Transition Table:**

| From | To | Trigger | Guard |
|------|----|---------|-------|
| (creation) | Active | `generateCode()` | Salted SHA-256 hash of 6-digit code. `ON CONFLICT (phone) WHERE consumed = false DO UPDATE` supersedes any prior active row for same phone. |
| Active | Consumed | Correct verify | CAS UPDATE: `WHERE consumed = false AND expiresAt > NOW() AND codeHash = $hash` -> `consumed = true, consumedAt = NOW()`. Returns `otpProof` JWT. |
| Active | Active (attempt incremented) | Wrong verify (below cap) | Increment `attemptCount`. Return mismatch error with remaining attempts. |
| Active | Lockout sentinel | Wrong verify (cap reached) | Set `consumed = true`, extend `expiresAt = NOW() + 15min`. Return mismatch with `retryAfter`. |
| Active | Expired | TTL passes (5 minutes) | No explicit transition -- detected by `expiresAt <= NOW()` check on next access. |

**Lockout Detection:** `findLockoutSentinel(phone)` queries `consumed = true AND attemptCount >= 3 AND expiresAt > NOW()`. Called BEFORE both the send-OTP and verify-OTP paths.

**NOTE (ADR-003 correction):** ADR states "3 failed OTP verifications" as lockout threshold. Code uses `MAX_OTP_ATTEMPTS=5`. The 15-minute lockout window is correct.

## Business Rules & Invariants

1. **I1 -- Concurrency Control (SELECT FOR UPDATE)** -- Every read-then-write on shared state runs inside `$transaction` (callback form) with `SELECT ... FOR UPDATE` on the gating row. Enforcement for auth: `lib/ledger/withdrawal.ts` (OperatorUser lock), `lib/admin/disableOperator.ts`, `lib/onboarding/operatorStatus.ts`.

2. **I9 -- No Raw Phone in NotificationLog Payload** -- `NotificationLog.recipient` carries the phone number for OTP delivery. The `payload` JSON field must NOT contain the phone number. Enforcement: `lib/notification/` when creating OTP-delivery notification rows.

3. **CSRF Invariant (ADR-003 D5 / ADR-008 D5)** -- All non-safe methods to `/api/*` require `X-CSRF-Token` header matching the `bb_csrf` cookie. `'use client'` components MUST deep-import `@/lib/auth/csrfClient`, NEVER `@/lib/auth` barrel (barrel pulls server-only modules, causes 500 on all routes). Enforcement: `proxy.ts` middleware.

4. **OTP Lockout Sentinel Invariant (ADR-003 D7)** -- `findLockoutSentinel(phone)` must be called BEFORE both send-OTP and verify-OTP paths. Lockout sentinel is the same OTP row with dual meaning: `consumed=true, attemptCount>=3, expiresAt=now+15min`. Prevents attacker from burning delivery budget by spamming send requests. Enforcement: `lib/auth/otp.ts`.

5. **requiresPasswordChange Edge Gate (ADR-003 D2, ADR-008 D10)** -- Operator `requiresPasswordChange` flag encoded as JWT claim. Edge middleware verifies via `jose.jwtVerify` (zero DB hits) and redirects to `/op/first-login` when true. Allowlist is exact-match `Set` of paths: `{'/op/first-login', '/op/login', '/api/op/auth/refresh'}` -- NOT prefix-match. Fresh JWT with `requiresPasswordChange: false` MUST be minted in same transaction as DB update on password change. Enforcement: `proxy.ts` Edge middleware + `app/api/op/auth/password/route.ts`.

6. **Refresh Token Family Rotation** -- Consumed refresh token reuse triggers entire token family revocation (all sessions in family). Enforcement: `lib/auth/refreshToken.ts`.

7. **otpProof JWT Single-Use** -- `jti` claim consumed via Redis SETNX. TTL: 5 minutes. `purpose: 'register' | 'login'` claim prevents cross-purpose replay. Must be in logger redact list to prevent leaking through structured logs. Enforcement: `lib/auth/otpProof.ts`.

8. **Realm Isolation** -- Tokens from one realm are invalid in another (separate JWT secrets per realm for access tokens). KNOWN GAP: single `REFRESH_TOKEN_SECRET` shared across all three realms -- refresh endpoints must validate the realm claim (PARTIALLY_IMPLEMENTED).

## Frontend Surfaces

| Page | Path | Key Components | Notes |
|------|------|----------------|-------|
| Phone Entry | `/login` | `AuthSplitLayout` (orange gradient left, centered form right); `+84` prefix pre-filled; `type="tel"`, `inputMode="numeric"` | CTA "Nhan ma OTP"; spinner "Dang gui..."; error states for invalid phone, rate limit countdown, lockout |
| OTP Entry | `/login` (step 2) | 6 individual digit boxes, auto-advance, `autocomplete="one-time-code"` | Phone masked `****1234`; resend countdown 60s; max 3 resends per 15-min; auto-submit after 6th digit |
| Operator Login | `/op/login` | `AuthSplitLayout` dark gradient; username+password fields | Error: "Ten dang nhap hoac mat khau khong dung" (no credential-specific leak) |
| First-Login Gate | `/op/first-login` | Current temp password, new password, confirm new password, strength meter | Trigger: `requiresPasswordChange` JWT claim = true; min 8 chars, 1 uppercase, 1 digit, 1 special |
| Admin Login | `/admin/login` | Step 1: email+password; Step 2: 6-digit TOTP | No SMS fallback; no self-service TOTP recovery; device loss requires Operations Manager intervention |
| Guest Booking Path | (no registration gate) | Post-booking CTA "Tao tai khoan" | `attachGuestBookingByPhone` links prior guest bookings |

### Error Message Table

| Code | HTTP | Vietnamese Message |
|------|------|-------------------|
| `invalid_phone` | 422 | "So dien thoai khong hop le" |
| `otp_mismatch` | 422 | "Ma OTP khong dung. Con {n} lan thu." |
| `otp_expired` | 422 | "Ma OTP da het han. Vui long yeu cau ma moi." |
| `locked_out` | 429 | "Tai khoan bi tam khoa. Vui long thu lai sau 15 phut." |
| `rate_limited` | 429 | "Vui long thu lai sau {n} giay" |
| `invalid_credentials` | 401 | "Ten dang nhap hoac mat khau khong dung" |
| `session_expired` | 401 | "Phien lam viec da het han. Vui long dang nhap lai." |
| `csrf_invalid` | 403 | "Phien khong hop le. Vui long tai lai trang." |
| `account_suspended` | 403 | "Tai khoan da bi tam ngung. Lien he quan tri vien." |
| `totp_invalid` | 422 | "Ma xac thuc khong dung" |
| `password_too_weak` | 422 | "Mat khau chua du manh. Can it nhat 8 ky tu, bao gom chu hoa, so va ky tu dac biet." |

### OTP Delivery Hierarchy

**Phase 1:** eSMS (SMS) only. Zalo ZNS deferred to Phase 2 (integration + ZNS template approval timeline).

| Priority | Channel | Timing | Persona Coverage |
|----------|---------|--------|-----------------|
| 1 (Phase 1) | SMS (eSMS brandname) | 5-60s delivery P99 | Universal — all personas |
| 1 (Phase 2) | Zalo ZNS | Instant | "Em Quan" (student, Zalo-native), "Chi Lan" (worker) |
| 2 (Phase 2) | SMS (eSMS brandname) | 5-60s delivery P99 | "Ba Hoa" (elderly), "Marco" (tourist), fallback for all |

OTP TTL: 5 minutes. Auth max attempts: 5. Account management max attempts: 3.

## Regulatory Requirements

| Law/Decree | Requirement | Impact |
|------------|-------------|--------|
| PDPL 2025 (No. 91/2025/QH15) | Phone number = "basic personal data" (T1 tier). Must be redacted in logs, not stored in NotificationLog.payload, retained minimum 24 months after user stops using service. | ADR-007 D2 log redaction; I9 payload rule; OtpAttempt logs 90-day cap |
| PDPL 2025 + Decree 356/2025 | Breach notification: 72 hours to MPS A05; 24 hours for cybersecurity attacks; SBV if payment data involved. | Incident response runbook |
| PDPL 2025 | DPO mandatory at launch. Platform processes payment data (sensitive) -> SME exemption (5-year grace) does NOT apply. | Must appoint DPO before go-live |
| Decree 53/2022 (Data Residency) | All auth data (Customer, Session, OtpAttempt) resides on Neon (Singapore). Redis on Upstash (Singapore). CDTIA filing required and accepted (ADR-020 D11). | CDTIA obligation for auth-related hosting |
| Consumer Protection Law 2023 (No. 19/2023/QH15) | Platform must protect against unauthorized transactions (CSRF, session integrity). | CSRF enforcement in middleware |

## Testing Strategy

### Unit Tests

- OTP proof JWT validation: claims structure, expiry, jti single-use enforcement
- State machine transition logic: `isLegalTransition`, `legalPredecessors`
- OTP attempt count logic: increment below cap, lockout at cap
- Password hashing: correct verification, timing-safe comparison
- TOTP code validation: window tolerance, replay detection

### Integration Tests

- OTP creation with partial unique index `WHERE consumed = false` -- only one active per phone (real DB required)
- OTP supersede: new send clears prior active OTP for same phone (ON CONFLICT update)
- Lockout sentinel: 3rd failed verify -> `consumed=true, expiresAt=now+15min`; subsequent send blocked; lockout expires and OTP can be sent again
- Session refresh token rotation with real DB
- Token family reuse detection: second consume -> family revoked
- `requireCustomerAuth` / `requireOperatorAuth` guard functions with real DB
- `attachGuestBookingByPhone`: registering with phone that has prior guest bookings links them to new customer account

### E2E Tests

- Customer OTP send -> verify -> register -> session active
- Operator login -> first-login redirect -> password change -> redirect to `/op/dashboard`
- CSRF header required on all POST mutations (use `primeCsrf()` from `e2e/helpers/csrf.ts`)
- Hex string validity in crypto mocks: 64-char hex strings for SHA-256 comparisons (not arbitrary strings)

## Cross-References

- **Architecture Decisions:** [ADR-003](../../architecture-decisions/ADR-003-auth-architecture/README.md), [ADR-008](../../architecture-decisions/ADR-008-security-posture/README.md)
- **Design Specifications:** [DS-001](../../design-specifications/DS-001-data-model/README.md) (sections 2.1-2.3), [DS-003](../../design-specifications/DS-003-api-contract/README.md) (sections 3-6.1, 7.1, 11)
- **Frontend Design:** [FD-012](../../frontend-design/FD-012-authentication/README.md)
- **Business/Domain:** [bounded-contexts.md](../../business/domain-model/bounded-contexts.md), [ubiquitous-language.md](../../business/domain-model/ubiquitous-language.md), [customer-personas.md](../../business/personas/customer-personas.md)
- **Regulatory:** [data-privacy.md](../../business/regulatory/data-privacy.md), [consumer-protection.md](../../business/regulatory/consumer-protection.md)
- **Scaffolding:** [SI-005](../../scaffolding-infra/SI-005-testing-strategy/README.md)

## Known Gaps & Open Questions

- **HIGH -- IMPLEMENTED_DIFFERENTLY: passwordHash column** -- Customer model has `passwordHash` column despite OTP-only decision. Column exists but is never used in any auth flow. Resolution needed: remove column or document intended future use.
- **HIGH -- PLANNED: Per-realm signing secrets** -- ADR-003 D10 decided separate JWT signing secrets per realm (customer, operator, admin) for both access and refresh tokens. Current code uses single `REFRESH_TOKEN_SECRET`. Migration: generate 3 new secrets, update env.ts Zod schema, update token mint/verify per realm. Must complete before go-live.
- **HIGH -- PLANNED: Better Auth migration** -- ADR-003 D8 chose Better Auth as auth provider. Current hand-rolled auth (password hashing, session management, token rotation, TOTP) must be migrated to Better Auth plugins. Better Auth handles: bcrypt cost 12, DB-backed sessions, refresh rotation with reuse detection, brute-force rate limiting, TOTP replay protection + backup codes. Migration eliminates the two HALT blockers below.
- **HIGH -- PARTIALLY_IMPLEMENTED: Admin TOTP** -- TOTP is implemented but: (1) no replay protection (same code can be reused within 30-second window -- no SETNX), (2) backup codes not implemented (Mitigations section mentions them but no code exists). Both resolved by Better Auth `twoFactor()` plugin (ADR-003 D8). HALT-level blockers until Better Auth migration completes.
- **HIGH -- NOT_IMPLEMENTED: HTTP Security Headers** -- Zero security headers configured in production (`next.config.ts` has no `headers()` function). HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all absent. Must add before Issue 094 go-live.
- **MEDIUM -- Rate limiter fail-open** -- Redis-based rate limiter fails open on Redis downtime (all requests pass unthrottled). No circuit-breaker or in-memory fallback. Documented as Risk #13.
- **MEDIUM -- OTP lockout threshold discrepancy** -- ADR-003 states "3 failed OTP verifications" as lockout threshold. Code uses `MAX_OTP_ATTEMPTS=5`. Reconcile which value is authoritative.
- **MEDIUM -- FD-012 DEFERRED: OTP step-up for sensitive operator operations** -- Payout withdrawal, staff role changes, payout account edit require OTP step-up modal, but documented without explicit implementation status.
- **LOW -- DSAR: secret rotation runbook absent** -- No documented procedure for rotating JWT secrets, HMAC keys, or API credentials. 6 JWT/HMAC secrets in env with no rotation schedule.
