# FI-016: Customer Email Auth Un-Gate + Google Sign-In

> **Status:** DOCUMENTED (implementation is a follow-up PR)
> **Last Updated:** 2026-08-06
> **Related:** ADR-021, ADR-003, ADR-008, DS-001, DS-033, DS-003, FD-012, FI-001, FI-013, HD-012

## Overview

Implementation plan to (1) **lift the Phase-1 `410` customer-auth gate** so the already-built
email+password customer auth goes live, (2) **add email verification**, and (3) **add "Sign in with
Google"** (hand-rolled OAuth via `arctic`, reusing the existing customer JWT + `Session`). Per ADR-021,
this reuses shipped infrastructure; most work is un-gating, one migration, one route pair, one email
template, and UI restoration.

This document is written so the follow-up PR can be executed without re-deriving the design.

## Scope & Boundaries

### In Scope
- Un-gate customer auth: `proxy.ts` Layer 0.5 + `app/api/auth/login/route.ts` scope 410.
- `Account` model + `Customer.emailVerifiedAt` migration (DS-033 §5).
- Email ownership proof: registration OTP (`verifyEmail` template emails the OTP **code**) via `/api/auth/verify-email` (+ resend) → returns `otpProof`; `register` consumes it to set `emailVerifiedAt=now()`. No verification-link email.
- Google OAuth: `GET /api/auth/google/start` + `GET /api/auth/google/callback` via `arctic`.
- Env (`GOOGLE_CLIENT_ID/SECRET`), logger redaction, customer login rate-limit templates.
- UI: restore customer login/register links + `CustomerAccountMenu` + "Đăng nhập với Google" button.

### Out of Scope
- Better Auth migration (ADR-003 D8 stays deferred; ADR-021 D4).
- Operator/admin realms.
- Phone-OTP customer login (superseded — ADR-021 D1/D2). Any residual email-OTP code is demoted to
  non-primary; not part of the login credential path.
- Additional social providers (design leaves room via `Account.provider`, but only Google ships).

## Key Entities

| Model | Change | Reference |
|-------|--------|-----------|
| `Account` | **NEW** — `id`, `customerId` (FK→Customer, Cascade), `provider`, `providerAccountId` (Google `sub`), `email?`, timestamps; `@@unique([provider, providerAccountId])`, `@@index([customerId])` | DS-033 §2.1 |
| `Customer` | **ADD** `emailVerifiedAt DateTime?`; `passwordHash` legitimately null for OAuth-only | DS-033 §2.2 / DS-001 §2.1 |
| `Session` | unchanged (reused for OAuth-minted sessions) | FI-001 |

Email uniqueness already enforced by `Customer_email_key` partial index (migration `20260519003311_issue_007_auth`) — no new unique index.

## API Endpoints

| Method | Path | Auth | Description | Status Codes |
|--------|------|------|-------------|--------------|
| POST | `/api/auth/register` | Public (CSRF) | Email+password register `{email, otpProof, password}`; `emailVerifiedAt=now()` (OTP already proved ownership); sets `bb_rt`, returns `{accessToken, customer}` | 201, 409 (`EMAIL_TAKEN` via P2002), 422, 429 |
| POST | `/api/auth/login` | Public (CSRF) | Email+password login (customer scope) — **remove the `scope!=='operator'` 410** | 200, 401 (`invalid_credentials`), 429 |
| POST | `/api/auth/verify-email` | Public (CSRF) | Verify email OTP **code** `{email, code}` → return `otpProof` (register consumes it to set `emailVerifiedAt`) | 200, 400 (invalid/expired code), 429 |
| POST | `/api/auth/verify-email/resend` | Public (email) | Re-send the email OTP code (rate-limited) | 200, 429 |
| POST | `/api/auth/refresh` | `bb_rt` cookie | Rotate refresh → new access token | 200, 401 (reuse → family revoked) |
| POST | `/api/auth/logout` | Customer JWT | Revoke session, clear `bb_rt` | 200 |
| POST | `/api/auth/forgot-password` | Public (CSRF-exempt prefix) | Send reset link | 200 |
| POST | `/api/auth/reset-password` | Public (proof) | Reset password | 200, 400 |
| **GET** | **`/api/auth/google/start`** | Public | Build Google auth URL (`openid email profile`), set PKCE+state cookie, 302 to Google | 302 |
| **GET** | **`/api/auth/google/callback`** | Public | Validate state + `id_token`, resolve/link Customer, mint session, redirect | 302 (success/`safeReturnTo`), 302→error page (invalid state/token) |

Full request/response shapes: DS-003. Google endpoints are `GET` (browser navigations) → **CSRF
double-submit does not apply** (safe method); `state` + PKCE are the CSRF defence for the OAuth
handshake (HD-012).

## Google OAuth Flow (arctic)

```
/api/auth/google/start
  arctic Google.createAuthorizationURL(state, codeVerifier, ['openid','email','profile'])
  set signed HttpOnly cookie bb_goauth = {state, codeVerifier}  (SameSite=Lax, ~10min, secure in prod)
  302 → accounts.google.com

/api/auth/google/callback?code&state
  read bb_goauth; assert state matches (else reject); clear cookie
  arctic Google.validateAuthorizationCode(code, codeVerifier) → tokens
  validate id_token: iss=https://accounts.google.com, aud=GOOGLE_CLIENT_ID, exp, signature (Google JWKS)
  claims → { sub, email, email_verified }
  $transaction:
    1. Account(google, sub)?         → load Customer
    2. else Customer(email) & email_verified → create Account (link); set emailVerifiedAt
    3. else create Customer(passwordHash=null, emailVerifiedAt=now) + Account + backfillGuestBookingsByEmail
  createSession(customerId) → Session row + signAccess (customer realm, JWT_SECRET)
  set bb_rt refresh cookie; 302 → safeReturnTo (default /account/bookings)
```

**Reuse (do not reimplement):** `lib/auth/session.ts:createSession`, `lib/auth/jwt.ts:signAccess`,
`lib/auth/safeReturnTo.ts`, `lib/booking:backfillGuestBookingsByEmail`, `lib/auth/refreshToken.ts`.

**New modules (suggested):** `lib/auth/googleOAuth.ts` (arctic client from `GOOGLE_CLIENT_ID/SECRET` +
derived redirect URI), `lib/auth/linkGoogleAccount.ts` (the §3 resolution tx, DS-033 rules L1–L4).

## Un-Gate Checklist (proxy + route + UI)

1. `proxy.ts` Layer 0.5 (~lines 192–216): remove/relax `CUSTOMER_AUTH_BLOCKED_PREFIXES` and the exact
   `/auth`,`/account` 410s. Keep everything else (rate-limit, CSRF, operator/admin guards) intact.
   Google routes are `GET` under `/api/auth/google/*` — ensure they are not caught by any residual
   customer block and pass the safe-method CSRF issuance path.
2. `app/api/auth/login/route.ts:44`: remove the `scope!=='operator'` → 410; route customer scope to
   `authService.login`. (Operator branch unchanged.)
3. `lib/ratelimit/index.ts`: add `customerLoginRatelimit` (mirror `opLoginRatelimit`, 10/min/IP) +
   `customerLoginLockout` (mirror `opLoginLockout`, `failClosed:true`, per-email). Wire into the
   customer login route.
4. `components/layout/SiteHeader.tsx`: restore customer "Đăng nhập / Đăng ký" (points to `/auth/login`,
   not `/op/login`) + `CustomerAccountMenu`. Un-comment per the restore markers at lines ~3–11, 32–38.
5. `components/auth/CustomerAccountMenu.tsx`: **re-link** (component already exists). Reads customer session
   (`lib/auth/clientSession`), shows email/displayName, My bookings (`/account/bookings`), Log out.

## Env, Logging, Config

- `lib/config/env.ts`: add `GOOGLE_CLIENT_ID: z.string().optional()`, `GOOGLE_CLIENT_SECRET:
  z.string().optional()`. Add a `superRefine` require-when-enabled guard mirroring
  `EMAIL_PROVIDER==='resend'` (env.ts ~:546) — e.g. gate on a `GOOGLE_OAUTH_ENABLED` flag or on
  presence, and require both in production if enabled. Redirect URI derives from `NEXT_PUBLIC_BASE_URL`
  (`${SITE_URL}/api/auth/google/callback`). Mirror all into `.env.example`.
- `lib/logger.ts` redact `paths`: add `GOOGLE_CLIENT_SECRET`, `id_token`, `access_token` (snake_case —
  today only camelCase `accessToken` is covered), `code_verifier`, `state`. (`*.code` already covers
  nested `code`.)
- `lib/notification/email.ts`: add `'verifyEmail'` to the `EmailTemplate` union + a subject entry;
  render the email OTP **code** (not a link — the code returned as `otpProof` on verify). EMAIL delivery needs
  `EMAIL_PROVIDER=resend` (else silently stubbed — env.ts warns).

## Business Rules & Invariants (additions to FI-001)

1. **OAuth linking L1–L4** (DS-033 §3): no unverified auto-link; single Google account per Customer;
   atomic create+link+backfill; session parity with password login.
2. **id_token validation** — `iss`/`aud`/`exp` + Google JWKS signature verified before trusting any
   claim (HD-012).
3. **state + PKCE** — callback rejects on `state` mismatch or missing `bb_goauth` cookie.
4. **Open-redirect guard** — post-callback redirect passes through `safeReturnTo` (allowlist same-origin
   paths only).
5. **Email ownership proof** — password-signup accounts get `emailVerifiedAt=now()` at register because
   the registration OTP (`otpProof`) already proved ownership; there is no separate link-consumption
   step. Google-signup accounts get `emailVerifiedAt=now()` only when Google returns
   `email_verified===true`; otherwise it stays `null` and the account is not auto-linked (DS-033 L1).

## Testing Strategy

### Unit
- `linkGoogleAccount` resolution: known-link / verified-email-link / new-customer branches; L1 refusal
  on `email_verified=false`.
- `id_token` validation: reject wrong `aud`/`iss`, expired, bad signature.
- state/PKCE cookie: mismatch → reject.

### Integration (real DB)
- Google callback creates Customer + Account + backfills guest bookings by email (one tx).
- Second Google login for same `sub` → no duplicate Customer/Account (L2, P2002 idempotent).
- Verified-email link to an existing password Customer; unverified email does NOT link.
- Customer email login works after un-gate (was 410); refresh rotation + family reuse detection.
- `emailVerifiedAt` set at register from a valid `otpProof`; invalid/expired OTP code rejected.

### E2E
- Register (email+password) → enter emailed OTP code → account area.
- "Đăng nhập với Google" → (mocked provider) → session active → header shows `CustomerAccountMenu`.
- CSRF still enforced on customer POST mutations; Google `GET` routes exempt (safe method).
- Guest booking made pre-login is listed after Google sign-in with the same email.

## Cross-References

- **Decision:** [ADR-021](../../architecture-decisions/ADR-021-customer-email-google-auth/README.md)
- **Data model:** [DS-033](../../design-specifications/DS-033-oauth-account-linking/README.md), [DS-001 §2.1](../../design-specifications/DS-001-data-model/README.md)
- **API contract:** [DS-003](../../design-specifications/DS-003-api-contract/README.md)
- **Frontend:** [FD-012](../../frontend-design/FD-012-authentication/README.md)
- **Core auth:** [FI-001](../FI-001-core-auth/README.md); **account lifecycle:** [FI-013](../FI-013-customer-account/README.md)
- **Hardening:** [HD-012](../../hardening/HD-012-auth-attack-surface/README.md)
- **Setup:** `documentation/guides/14-setup-google-oauth.md`
