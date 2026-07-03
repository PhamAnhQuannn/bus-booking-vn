# Security Architecture

This document describes the authentication, authorization, and security architecture of the Bus Booking platform. It is intended for maintainers and security reviewers.

## JWT Dual-Token Architecture

Three isolated signing realms prevent cross-realm token forgery:

| Realm | Secret | Access TTL | Cookie |
|-------|--------|-----------|--------|
| Customer | `JWT_SECRET` | 15 min | `bb_access` |
| Operator | `JWT_OPERATOR_SECRET` | 15 min | `bb_op_access` |
| Admin | `JWT_ADMIN_SECRET` | 10 min | `bb_admin_access` |

- Algorithm: HS256 (HMAC-SHA256) via `jose`
- Each realm verifies a `scope` claim to reject cross-realm tokens
- Operator tokens embed `role`, `operatorId`, and `requiresPasswordChange` claims (Edge-readable, no DB call required for middleware gates)

## Token Refresh

- Refresh tokens stored as hashed rows in the `Session` table with `tokenFamily` and `rotationCount`
- 30-day expiry
- Rotation is atomic (`$transaction`): old token is always invalidated when a new one is minted
- **Theft detection**: reuse of an already-revoked refresh token triggers family-wide revocation (all tokens in that family are invalidated)
- Endpoint: `POST /api/auth/refresh` reads HttpOnly `bb_rt` cookie
- On `SESSION_REUSE` detection: cookie cleared, 401 returned

## OTP Flow

Sequence: send OTP -> verify OTP -> receive proof JWT -> register or login.

| Parameter | Value |
|-----------|-------|
| OTP TTL | 5 minutes |
| Max verify failures | 3 |
| Lockout duration | 15 minutes |
| Send rate limit | 3 per 15 min per phone |

- OTP codes are hashed before storage; verification uses `crypto.timingSafeEqual`
- Lockout implemented via sentinel row: same OTP row repurposed with `consumed=true` and `expiresAt` extended to lockout duration
- Partial unique index enforces one active OTP row per phone
- Proof JWT (HS256, 5-min TTL, single-use via `jti` + Redis SETNX) bridges the verify-to-register/login boundary

## CSRF Protection

Double-submit cookie pattern enforced in Edge middleware (`proxy.ts`):

- Cookie: `bb_csrf` (non-HttpOnly, SameSite=Lax)
- Header: `X-CSRF-Token` (must match cookie value)
- Issued on first safe-method (GET) request
- Required on all non-safe methods (POST/PUT/PATCH/DELETE) to `/api/*`

Exemptions:
- Payment webhook endpoints (authenticated via HMAC signature instead)
- Pre-auth endpoints (forgot-password, refresh) where no cookie exists yet

## Operator Auth

- Separate JWT namespace (`JWT_OPERATOR_SECRET`) from customer auth
- First-login gate: `requiresPasswordChange` claim in JWT; Edge middleware redirects to `/op/first-login` via exact-match path allowlist (no prefix-match, prevents bypass)
- Staff role restrictions enforced at both RSC render and API handler layers
- All operator queries scoped by `operatorId` from JWT claims (`withOperatorScope`)

## Admin Auth

- Third isolated realm (`JWT_ADMIN_SECRET`, `bb_admin_access` cookie)
- Shorter access TTL (10 min) reflecting higher privilege level
- TOTP step-up required for sensitive operations:
  - Step-up token: 5-min TTL, `scope: 'admin_stepup'`, minted after fresh TOTP verification
  - `totpVerified` claim gates finance, user management, and system configuration endpoints
- Invite-only registration; bootstrap via CLI (`bootstrapSuperAdmin`)
- Role tiers: `super_admin` > `admin` > `viewer`

## Rate Limiting

Pluggable backends: in-memory (dev), Upstash (serverless), ioredis+Lua (self-hosted).

| Endpoint | Limit | Key |
|----------|-------|-----|
| Generic API | 60/min | IP |
| Operator login | 10/min | IP |
| Operator login (account) | 5 per 15 min | Username |
| Admin TOTP | 10/min + 5 per 15 min lockout | IP + account |
| Operator register | 5/hr | IP |
| Charter form | 5/hr | IP |

The ioredis backend uses atomic INCR-first Lua scripts to avoid TOCTOU race conditions on counter checks.

## Session Management

- Customer sessions: `Session` table with `refreshTokenHash`, `tokenFamily`, `rotationCount`
- Operator sessions: `OperatorSession` table, similar pattern
- Admin sessions: `AdminSession` table with TOTP state
- Revocation: `revokedAt` timestamp; bulk revocation on account deletion, suspension, or theft detection
- Session cleanup: hourly cron sweeper deletes expired sessions (`FOR UPDATE SKIP LOCKED`)

## Data Protection

- **Immutability triggers**: `LedgerEntry` and `AdminAuditLog` have database-level triggers preventing UPDATE/DELETE
- **PII scrubbing**: immediate anonymization on account deletion (phone, displayName, booking snapshots); 24-month deferred scrub for email, passwordHash, notification logs
- **Logger redaction**: `otpProof`, `password`, `token`, `secret`, and phone numbers are redacted from structured logs
- **Consent capture**: booking initiation records consent timestamp

## Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Price tampering | Price locked at hold creation from Trip.price; I7 invariant on customer-facing endpoints |
| Webhook replay | `providerTxnId` unique constraint; idempotent event recording |
| Payment state regression | Monotonic transition guard (paid->refunded allowed, refunded->paid rejected) |
| Oversell race | `SELECT ... FOR UPDATE` on Trip row inside `$transaction` |
| QR ticket forgery | HMAC-signed tokens; `verifyTicketToken` rejects tampered/expired |
| Double check-in | Atomic `checkedInAt` SET with `WHERE checkedInAt IS NULL` |
| Cross-tenant leakage | `withOperatorScope` on all operator queries; `eslint-plugin-boundaries` enforcement |
| Open redirect | `safeReturnTo()` validates against allowlist |
| Double refund | Idempotent refund returning `{ alreadyRefunded: true }` |

## Incident Response

| Role | Contact |
|------|---------|
| Primary maintainer | phamanhquan4068@gmail.com |
| Security issues | Report via GitHub Security Advisories (private disclosure) |

To report a vulnerability, use GitHub's private vulnerability reporting feature on this repository. Do not open a public issue for security vulnerabilities.
