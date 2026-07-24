# Security Gaps — Spec vs Reality

High-severity security items that must be resolved before production launch.

---

## 1. HTTP Security Headers — NOT CONFIGURED

**Severity:** HIGH

**Spec says:**
- SI-003 KG-02, ADR-008 D4: OWASP header set required
- HD-001 Layer 4 defines exact headers:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only)
  - `Content-Security-Policy` with PSP-specific `connect-src` (MoMo, VNPay, SePay domains)
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- SI-006 Nginx config references some headers but not all

**Reality:**
- `proxy.ts` enforces JWT auth + rate-limit + CSRF double-submit
- NO security headers set in middleware or Nginx config
- Data leak audit A5 checks Referrer-Policy existence but only as WARN

**Gap:** Entire OWASP header baseline missing from response pipeline.

**Risk:** XSS (CSP bypass), clickjacking (X-Frame-Options missing), MIME sniffing, browser protocol downgrade.

**Resolution:** Add header enforcement in `proxy.ts` middleware response. Test across all three portal scopes (customer, operator, admin). CSP must allowlist PSP domains for payment iframe/redirect flows.

---

## 2. PayoutAccount Bank Details — Stored Plaintext

**Severity:** HIGH

**Spec says:**
- SI-003 KG-03: PayoutAccount bank details (account number, bank code) require field-level encryption
- HD-001 Layer 3: Three-tier data classification — bank details are T2 (sensitive, require AES-256)
- PDPL Article 10 & Decree 356/2025: Sensitive financial data encryption mandatory

**Reality:**
- `PayoutAccount` model stores `accountNumber` and `bankCode` as plaintext strings
- Visible in database, logs, error messages, and backups
- No encryption/decryption layer exists in `lib/payment/` or `lib/ledger/`

**Gap:** Plaintext financial data in database. Compromise of database backup = immediate exposure.

**Resolution:** Add field-level AES-256-GCM encryption. Create migration to encrypt existing rows. Update all read/write paths. Add to logger redact list.

---

## 3. Admin TOTP Replay Protection — NOT IMPLEMENTED

**Severity:** HIGH

**Spec says:**
- HD-012 Section 2.4: TOTP codes must be replay-protected via `SETNX jti 30s TTL` in Redis
- FI-001: Admin TOTP setup includes replay protection as blocker

**Reality:**
- Admin TOTP verification exists (`lib/auth/adminTotp.ts`)
- No Redis SETNX jti check exists — same TOTP code can be used multiple times within its 30-second window
- No backup codes implemented for TOTP recovery

**Gap:** TOTP replay attack possible. Admin locked out permanently if authenticator device lost (no backup codes).

**Resolution:** Add `SETNX` with 30-second TTL keyed on `adminId:code` after successful verification. Generate 10 backup codes during TOTP setup, store hashed.

---

## 4. Branch Protection Rules — NOT CONFIGURED

**Severity:** HIGH

**Spec says:**
- SI-003 KG-04: GitHub branch protection on `main` required
  - Require CI status checks to pass
  - Require codeowner review
  - Dismiss stale reviews on new commits
  - No direct push

**Reality:**
- Only enforced by pre-commit hook (`pnpm lint && pnpm tsc --noEmit`)
- Pre-commit hook bypassable via `--no-verify`
- Direct push to `main` possible by anyone with write access

**Gap:** No server-side enforcement. Compromised or careless push = broken main branch.

**Resolution:** GitHub repo Settings → Branches → Branch protection rule for `main`. Enable all four requirements. This is a GitHub-side configuration, not a code change.

---

## 5. Secrets Rotation Runbook — NOT DOCUMENTED

**Severity:** HIGH

**Spec says:**
- SI-003 KG-06: Documented rotation procedure for 6 JWT/HMAC secrets:
  1. `JWT_SECRET` (customer access tokens)
  2. `JWT_OPERATOR_SECRET` (operator access tokens)
  3. `JWT_ADMIN_SECRET` (admin access tokens)
  4. `OTP_HMAC_KEY` (OTP code hashing)
  5. `WEBHOOK_HMAC_MOMO` (MoMo webhook verification)
  6. `WEBHOOK_HMAC_VNPAY` (VNPay webhook verification)

**Reality:**
- No rotation runbook exists
- No dual-key overlap window procedure (old key still valid during rotation)
- Rotating any JWT secret immediately invalidates ALL active tokens for that realm
- Rotating webhook HMAC immediately breaks webhook verification from PSP

**Gap:** Compromised secret = permanent liability until manual rotation + full user session invalidation.

**Resolution:** Document per-secret rotation procedure with overlap windows. JWT secrets need dual-verification (try new key, fall back to old key within 15-minute window). Webhook secrets need PSP-side update coordination.

---

## 6. `pnpm audit` Not in CI Pipeline

**Severity:** HIGH

**Spec says:**
- SI-003 KG-01: `pnpm audit --audit-level=high` must gate CI pipeline
- Dependabot or equivalent must be configured for automated dependency updates

**Reality:**
- No `pnpm audit` step in CI
- No Dependabot configuration file (`.github/dependabot.yml`)
- Known-vulnerable dependencies could ship to production undetected

**Gap:** No automated vulnerability detection for npm dependencies.

**Resolution:** Add `pnpm audit --audit-level=high` as CI stage after lint. Add `.github/dependabot.yml` for automated PR creation.

---

## 7. Greppable Invariants G1-G11 — NOT AUTOMATED

**Severity:** HIGH

**Spec says:**
- SI-003 KG-14: 11 greppable checks consolidating Mistake Log lessons:
  - G1: No `operatorId` from request body in operator routes
  - G2: No server-component self-fetch (localhost/NEXT_PUBLIC_BASE_URL)
  - G3: No JSON payload cron predicates (`payload->` in `app/api/cron/`)
  - G4: No `Math.round` in money modules (`lib/payouts/`, `lib/ledger/`)
  - G5: No `Date.now()` in RSC render bodies
  - G6: No `'use client'` barrel imports (overlaps with A3)
  - G7: PII redaction coverage (otpProof, tempPassword, tokens in redact list)
  - G8: Mock method parity (findUnique vs findFirst alignment)
  - G9: Cron dual-config parity (vercel.json vs deploy/crontab)
  - G10: Hex mock validity (Buffer.from hex = 64 chars for SHA-256)
  - G11: `findFirst` vs `findUnique` for soft-delete models

**Reality:**
- A1-A7 (data leak audit) automated in `scripts/audit/data-leak-grep.sh`
- G1-G11 NOT automated — no `pnpm run invariants` command exists
- Individual checks are manually verifiable but not CI-gated

**Gap:** Mistake Log lessons not systematically enforced. Regression risk for patterns that caused past bugs.

**Resolution:** Create `scripts/audit/invariants.sh` implementing G1-G11 as grep checks. Add as CI stage. Target: zero violations = green.

---

## 8. Zod Boot Validation — Incomplete

**Severity:** MEDIUM

**Spec says:**
- SI-006 Section 8, ADR-020 D4: All env vars validated at boot with Zod + `superRefine` guards
- Switching stub → real mode without credentials must fail at boot time

**Reality:**
- `lib/config/getConfig.ts` validates most env vars with Zod
- `superRefine` guards incomplete — not all secrets have min-length enforcement
- Some env var combinations (e.g., `PAYMENTS_STUB=false` without `MOMO_PARTNER_CODE`) may not be caught

**Gap:** Partial boot validation. Some misconfigurations could reach runtime.

**Resolution:** Audit all env var combinations. Add `superRefine` for every secret when its feature is enabled.
