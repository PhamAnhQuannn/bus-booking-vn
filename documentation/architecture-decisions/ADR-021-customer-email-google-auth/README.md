# ADR-021: Customer Authentication — Email+Password + Google OAuth

## Status
ACCEPTED

## Date
2026-08-06

## Amends
**ADR-003 (Auth Architecture) — Decision 1 (Customer Authentication).** This ADR reverses the
Phase-1 "OTP-only passwordless via phone" choice for the customer realm. ADR-003 D2 (operator),
D3 (admin), D4 (session strategy), D5 (CSRF), D10 (per-realm secrets), and D11 (customer refresh
TTL) are **unchanged** and are reused verbatim. See the `> AMENDMENT` block on ADR-003 D1.

> **Related:** ADR-003, ADR-008, ADR-020, DS-001, DS-033, DS-003, FD-012, FI-001, FI-016,
> GL-006, HD-012

---

## Context

Phase 1 launched **guest-only**: customer authentication was implemented but disabled behind a
`410` edge gate (`proxy.ts` Layer 0.5 + the `scope!=='operator'` guard in `app/api/auth/login/route.ts`).
Two facts drive this decision now:

1. **The product has moved past the beachhead assumption behind ADR-003 D1.** D1 optimised for a
   phone-first, low-literacy traveler population and a per-login OTP delivery cost. We now want
   durable customer accounts (booking history, profile, faster re-booking) for real users signing
   up with the identity they actually carry — **email/Gmail** — and we want the lowest-friction
   entry, **"Sign in with Google"** (one tap, no password, email pre-verified).

2. **The code already diverged from D1.** `lib/auth/authService.ts` implements email+password
   `register`/`login` (scrypt via `lib/auth/password.ts`; argon2id is the planned P19 upgrade); customer OTP was moved from SMS to
   **email via Resend** (commit `686ec85`); the `Customer.passwordHash` column D1 flagged as
   "residual / IMPLEMENTED_DIFFERENTLY" is in fact the load-bearing credential store. The written
   spec, not the code, is the thing out of date.

This ADR records the reversal, retires the now-ambiguous customer-OTP-channel question, and adds a
new decision for Google OAuth. Data-residency (Decree 53/2022, PDPL 2025) remains a hard constraint
and shapes the OAuth choice (see Decision 4 and Consequences).

Business inputs unchanged from ADR-003 (`documentation/business/`): phone-first personas remain the
majority, but the launch reality (family operators, real named customers, Gmail ubiquity) makes
email a workable primary identity, and Google Sign-In removes the password-friction objection that
justified passwordless in the first place.

---

## Decisions

### 1. Customer Identity Anchor — Email (was: Phone)

**Choice**: The customer identity anchor is **email** (`Customer.email`, DB-enforced unique via the
existing partial index `Customer_email_key WHERE email IS NOT NULL`). Phone becomes **optional
contact/booking data**, no longer an auth credential.

**Reasons**:
- Email+password + Google both key on email; a single anchor keeps account-linking unambiguous.
- The uniqueness constraint already exists in migration `20260519003311_issue_007_auth` — no new
  index needed; only an `emailVerifiedAt` column is added (DS-033 / DS-001 §2.1).
- Guest→account association keeps working: `backfillGuestBookingsByEmail` (already called inside
  `authService.register`) links prior guest bookings on the buyer's email; `backfillGuestBookingsByPhone`
  remains available for phone-matched guest bookings.

> **PDPL note**: email is "basic personal data" (T1), same tier as phone. Logger redaction, no PII in
> `NotificationLog.payload`, and the retention tiers of ADR-007 apply identically.

---

### 2. Customer Credential — Email+Password (with email verification)

| Option | Pros | Cons |
|--------|------|------|
| **Email + password (+ verify)** | Already implemented (scrypt today; argon2id planned, P19); zero per-login delivery cost; works offline; universally understood | Password reset flow needed (already built); requires email verification to prevent squatting |
| Passwordless email-OTP | No password to forget; code path exists (Resend) | Per-login email dependency + latency; weaker for repeat logins; two credential systems if combined |
| Phone-OTP (ADR-003 D1) | Original decision | Per-login SMS cost; SMS brandname a hard blocker; phone no longer the anchor |

**Choice**: **Email + password**, with a **verification link** sent on registration.

**Reasons**:
- `authService.register`/`login` + `password.ts` (scrypt today; argon2id planned P19, with scrypt fallback + rehash-on-verify), forgot/reset
  routes (`/api/auth/forgot-password`, `/api/auth/reset-password`) already exist and are wired into
  `proxy.ts` CSRF-exempt prefixes — this is an un-gate + verification add, not new construction.
- Email verification (`emailVerifiedAt`) closes the account-squatting / silent-takeover gap and is a
  precondition for **safe OAuth auto-linking** (Decision 3).
- Retires the SMS-vs-email customer-OTP ambiguity (ADR-003 D6 designed SMS; guides+code moved to
  email): **customer OTP is no longer the primary customer auth path.** Any residual email-OTP code is
  demoted to at most a secondary/step-up mechanism, not the login credential.

**Password rules**: unchanged from the operator baseline — the hand-rolled `lib/auth/password.ts` is
the authoritative hasher for all realms and supersedes the ADR-003 D9 bcrypt-cost-12 "handled by
Better Auth" line (Better Auth was never adopted). The **current** hasher is **scrypt**; **argon2id**
is the planned upgrade (P19) with scrypt fallback + rehash-on-verify.

---

### 3. Social Sign-In — "Sign in with Google" (OIDC)

**Choice**: Add **Google OAuth 2.0 / OpenID Connect** ("Sign in with Google") as a customer login
option, landing in the **customer realm** (mints the same `JWT_SECRET`-signed customer access token +
`Session` refresh row as password login).

**Account linking rules** (full spec: DS-033):
- Match `Account(provider='google', providerAccountId=<Google sub>)` → load its `Customer`.
- Else match `Customer` by email **only if Google asserts `email_verified=true`** → link (create
  `Account`). Never auto-link an unverified email (account-takeover guard, HD-012).
- Else create a new `Customer` (`passwordHash=null`, `emailVerifiedAt=now()`) + `Account`, then
  `backfillGuestBookingsByEmail`.

**Reasons**:
- One-tap, password-free onboarding with a pre-verified email — directly removes the friction that
  justified ADR-003 D1's passwordless choice, without the per-login SMS cost.
- Reuses the entire existing customer session machinery (`createSession`, `signAccess`, `bb_rt`
  refresh cookie, `requireCustomerAuth`) — the OAuth code only handles the provider handshake and
  identity resolution.

---

### 4. OAuth Implementation — Hand-Rolled (`arctic`), Not Better Auth

| Option | Pros | Cons |
|--------|------|------|
| **Hand-rolled with `arctic`** | Tiny, audited OAuth2/OIDC client (PKCE + state built in); reuses our JWT+Session; surgical; no migration of the working hand-rolled auth | We own callback/linking/CSRF logic (small, well-understood surface) |
| Adopt Better Auth now (ADR-003 D8) | Provider handles OAuth/session/hashing; the ADR-planned target | Requires migrating ALL three realms off hand-rolled auth — large, risky, out of proportion to "add one provider" |
| `google-auth-library` / raw fetch | No extra abstraction | More boilerplate (JWKS, PKCE, token exchange) than `arctic` |

**Choice**: **Hand-rolled with `arctic`**, reusing the existing customer JWT + `Session`.

**Reasons**:
- "Simplicity First / Surgical Changes" — a provider swap for the whole auth stack to gain one social
  button is disproportionate. ADR-003 D8 (Better Auth) stays **PLANNED/deferred**; this ADR does not
  execute it.
- `arctic` provides Google Authorization-Code + PKCE with minimal surface; the callback mints a
  customer session through code we already ship.

**Flow** (full spec: DS-033 + FI-016):
`GET /api/auth/google/start` (build auth URL, `openid email profile`, generate `state`+PKCE, store in
short-lived signed HttpOnly cookie, 302 to Google) → Google → `GET /api/auth/google/callback` (verify
`state`, exchange code, validate `id_token` `iss/aud/exp` + signature via Google JWKS, resolve/link
Customer, mint session, redirect to `safeReturnTo`).

---

### 5. Session, CSRF, Refresh, Rate-Limit — Reuse ADR-003 Unchanged

**Choice**: No new session model. Customer access = short-lived HS256 JWT (`JWT_SECRET`, no scope
claim, `signAccess`); refresh = rotated opaque token hashed in `Session` (30-day TTL, ADR-003 D11);
CSRF = double-submit `bb_csrf` (ADR-003 D5); per-realm access secret (ADR-003 D10, refresh-secret gap
noted there). Add customer login rate-limit/lockout templates mirroring `opLoginRatelimit` /
`opLoginLockout`.

---

## Consequences

### Positive
- Feature is mostly an **un-gate + verification + one OAuth route pair**, reusing shipped session,
  CSRF, guard, and client-session infrastructure.
- Email anchor + verified Google email give a clean, single account-linking key.
- Retires the SMS-vs-email customer-OTP ambiguity that sat unreconciled between ADR-003 D6 and the
  code/guides.

### Negative / Risks
- **CDTIA / data residency (Decree 53/2022, Decree 147/2024, PDPL 2025):** Google Sign-In exchanges
  the authorization `code` at Google's token endpoint and returns identity claims from **Google (US)**
  → **cross-border transfer of basic personal data (email)**. ADR-003 D8 rejected Firebase partly on
  this ground; Google OIDC carries the same residency implication. **Google must be added to the CDTIA
  scope** (`guides/cdtia-data-residency-guide.md`). Per project ownership, the CDTIA filing is the
  user's responsibility; this ADR surfaces the obligation, it does not discharge it.
- **Account-takeover surface:** email-based auto-linking is only safe behind verified email (Decision
  3 + HD-012). Unverified-email links must be refused.
- **OAuth handshake surface:** PKCE, `state` CSRF, `id_token` validation, and callback open-redirect
  must all be implemented correctly (HD-012). Small but security-critical.
- **Consent screen / branding:** Google OAuth consent screen requires a verified domain, privacy-policy
  URL, and scopes justification before "production" publishing (`guides/14-setup-google-oauth.md`).

### Mitigations
- Reuse `lib/auth/safeReturnTo.ts` for callback redirect; validate `id_token` via Google JWKS with
  `aud`/`iss`/`exp` checks; require `email_verified` before linking; extend logger redaction
  (`GOOGLE_CLIENT_SECRET`, `id_token`, `access_token`, `code_verifier`, `state`).
- Env fail-fast: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` required-when-enabled via `superRefine`
  mirroring the `EMAIL_PROVIDER==='resend'` rule.

---

## References

- **Amends:** [ADR-003 D1](../ADR-003-auth-architecture/README.md)
- **Security umbrella:** [ADR-008](../ADR-008-security-posture/README.md); **residency:** [ADR-020](../ADR-020-deployment/README.md)
- **Data model:** [DS-001 §2.1](../../design-specifications/DS-001-data-model/README.md), [DS-033](../../design-specifications/DS-033-oauth-account-linking/README.md)
- **API contract:** [DS-003](../../design-specifications/DS-003-api-contract/README.md)
- **Frontend:** [FD-012](../../frontend-design/FD-012-authentication/README.md)
- **Implementation:** [FI-001](../../feature-implementation/FI-001-core-auth/README.md), [FI-016](../../feature-implementation/FI-016-google-oauth/README.md)
- **Go-live:** [GL-006](../../go-live/GL-006-phase1-launch-scope/README.md); **hardening:** [HD-012](../../hardening/HD-012-auth-attack-surface/README.md)
- **Setup guide:** `documentation/guides/14-setup-google-oauth.md`; **residency guide:** `documentation/guides/cdtia-data-residency-guide.md`
