# HD-001: Security Review

> Status: NOT_STARTED | References: ADR-008, SI-003 §14.5, SI-004

## Purpose

Comprehensive security audit of the BenXe platform before first production deployment. Covers the five-layer defense-in-depth model (ADR-008 D1) and validates that all security controls are implemented and effective.

## Skill Invocation

- **Primary**: `/security-review` -- automated security vulnerability scan across all changed files
- **Supplementary**: `/threat-model` -- auth flow threat analysis, token handling review

## Acceptance Criteria

### Layer 1: Input Validation (ADR-008 D4)

- [ ] Every API endpoint has Zod schema validation at the boundary
- [ ] Domain invariants enforced in service layer (not just Zod)
- [ ] No raw `req.body` access without prior Zod parse

### Layer 2: Authentication & Authorization (ADR-003, ADR-008 D5)

- [ ] Customer: OTP-only auth flow working end-to-end
- [ ] Operator: password + OTP auth flow working
- [ ] Admin: password + TOTP auth flow working
- [ ] Admin TOTP: replay protection via SETNX jti with 30s TTL (FI-001 HALT blocker)
- [ ] Admin TOTP: backup codes generated and stored (device-loss recovery -- FI-001 HALT blocker)
- [ ] JWT access tokens: 15-min TTL, refresh token rotation
- [ ] Double-submit CSRF: middleware enforced on all non-safe `/api/*` routes
- [ ] CSRF exempt: webhook routes authenticating via HMAC (e.g., `/api/payments/momo/webhook`)
- [ ] `requiresPasswordChange` claim in operator JWT, enforced in Edge middleware

### Layer 3: Data Protection (ADR-008 D3)

- [ ] Three-tier data classification applied to all models
- [ ] T2 fields (bank account details) encrypted at application layer (AES)
- [ ] PayoutAccount bank details NOT stored plaintext (KG-03)
- [ ] PayoutAccount AES-256-GCM encryption verified active via integration test (FI-002 + FI-010 go-live blocker)
- [ ] PII redaction at serialization layer (ADR-007) covers all sensitive fields
- [ ] `select` whitelists = exactly UI contract fields, no filter columns leaked

### Layer 4: HTTP Security Headers (ADR-008 D4)

- [ ] HSTS with preload (production only)
- [ ] CSP with PSP-specific `connect-src` per environment
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy: camera=(), microphone=(), geolocation=()

### Layer 5: CI Pipeline Security (ADR-008, SI-003)

- [ ] Gitleaks scanning full commit history
- [ ] Data-leak-audit 7 checks passing (A1-A7)
- [ ] Greppable invariants passing (G1-G11)
- [ ] `pnpm audit` with no high/critical advisories
- [ ] Branch protection rules configured (SI-003 §9.1)

### Secrets Management (ADR-008 D7)

- [ ] 6 JWT/HMAC secrets have rotation runbook
- [ ] No secrets in Docker image or `.tfstate` plaintext
- [ ] Zod boot validation covers all secrets with min-length guards
- [ ] `tempPasswordPlain` column removed or encrypted (SI-002 §7.2)
- [ ] Admin seed password changed from `123456` (SI-002 §7.2)

### Webhook Security (DS-005, DS-013, ADR-005)

Phase 1 (bank transfer via SePay):
- [ ] SePay bearer token verification (constant-time comparison) -- invalid/missing returns 401
- [ ] Idempotency via `PaymentEvent @@unique([adapter, providerTxnId])` constraint
- [ ] Amount guard (reject underpay, log overpay, oversold refund)
- [ ] Oversold race guard (`SELECT FOR UPDATE` on Trip, recount paid seats)
- [ ] BookingRef extraction from SePay `content` field via case-insensitive regex
- [ ] Memo mismatch (~5%) queued for admin reconciliation (not silently dropped)
- [ ] Defer to HD-006 for full payment & webhook security audit

### Tenant Isolation (ADR-008 D8)

- [ ] Defer to HD-005 for detailed tenant isolation audit

## Verdict

**PASS** when all checkboxes above are checked. **FAIL** if any critical or high item is unchecked.

## Cross-References

- ADR-008 -- security posture (primary source)
- ADR-003 -- auth architecture
- ADR-007 -- observability and PII redaction
- SI-003 §2 -- security checks in CI
- SI-003 §14.2 -- review gate skill matrix
