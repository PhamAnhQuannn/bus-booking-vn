# Hardening & Go-Live Gates — Spec vs Reality

All 12 hardening audits (HD-001–012) and 5 go-live gates (GL-001–005) are NOT_STARTED.

> **Phase 1 note (GL-006):** Full HD/GL audit chain replaced by GL-006 simplified checklist (~25 items). Only basic security items needed for Phase 1: HTTP headers, admin password, `tempPasswordPlain`, CSRF, rate limiting. Full HD-001 through HD-012 deferred to Phase 2+.

---

## Hardening Audits Status

| Audit | Title | Items | Status | Key Blockers Found |
|---|---|---|---|---|
| HD-001 | Security Review | 30+ items across 5 layers | NOT_STARTED | HTTP headers missing (KG-02), PayoutAccount plaintext (KG-03), TOTP replay (FI-001) |
| HD-002 | Performance Audit | TBD | NOT_STARTED | No monitoring infrastructure to measure |
| HD-003 | Error Handling Audit | TBD | NOT_STARTED | |
| HD-004 | Barrel Import Hygiene | TBD | NOT_STARTED | Issue 092b sweep complete, but audit not formally executed |
| HD-005 | Tenant Isolation Audit | TBD | NOT_STARTED | `withOperatorScope` coverage unknown |
| HD-006 | Payment Webhook Security | 20+ items across 9 subsections | NOT_STARTED | SePay not implemented, central collection legal risk |
| HD-007 | Regulatory Compliance | 30+ items across 10 subsections | NOT_STARTED | DPO, DPAs, CDTIA, DSAR, breach playbook all absent |
| HD-008 | Notification Channel | TBD | NOT_STARTED | eSMS stub, ZNS not wired |
| HD-009 | Financial Integrity | 25+ items across 7 subsections | NOT_STARTED | Tax withholding absent, payout stranding risk |
| HD-010 | Infrastructure Security | TBD | NOT_STARTED | FPT Cloud setup not started |
| HD-011 | Cron Resilience | TBD | NOT_STARTED | 5 missing cron jobs, HOLD_SWEEPER_MODE default risk |
| HD-012 | Auth Attack Surface | 50+ attack vectors across 10 categories | NOT_STARTED | TOTP replay, backup codes, IDOR coverage unknown |

---

## HD-001: Security Review — 5 Layers

### Layer 1: Input Validation
| Check | Spec Requirement | Status |
|---|---|---|
| Zod schema on every API endpoint | Required | LIKELY MET (pattern used throughout) |
| Domain invariants in service layer | Required | LIKELY MET |
| No raw `req.body` access | Required | LIKELY MET (Zod parsing) |

### Layer 2: Auth & Authorization
| Check | Spec Requirement | Status |
|---|---|---|
| Customer OTP auth | Working | IMPLEMENTED (soft-disabled) |
| Operator JWT + password | Working | IMPLEMENTED |
| Admin JWT + TOTP | Working | IMPLEMENTED |
| TOTP replay protection (SETNX jti 30s) | Required | NOT IMPLEMENTED |
| TOTP backup codes | Required | NOT IMPLEMENTED |
| JWT 15-min TTL + refresh rotation | Required | IMPLEMENTED |
| CSRF double-submit on all non-safe `/api/*` | Required | IMPLEMENTED |
| `requiresPasswordChange` JWT claim enforcement | Required | IMPLEMENTED (proxy.ts) |

### Layer 3: Data Protection
| Check | Spec Requirement | Status |
|---|---|---|
| Three-tier classification applied | Required | LIKELY MET |
| T2 fields encrypted (AES) | Required | NOT MET (PayoutAccount plaintext) |
| PII redaction at serialization | Required | IMPLEMENTED (logger redact list) |
| `select` whitelists = UI contract only | Required | IMPLEMENTED (Mistake Log Issue 001) |

### Layer 4: HTTP Security Headers
| Header | Spec Requirement | Status |
|---|---|---|
| `Strict-Transport-Security` | Production only | NOT CONFIGURED |
| `Content-Security-Policy` | With PSP connect-src | NOT CONFIGURED |
| `X-Frame-Options: DENY` | Required | NOT CONFIGURED |
| `X-Content-Type-Options: nosniff` | Required | NOT CONFIGURED |
| `Referrer-Policy` | strict-origin-when-cross-origin | NOT CONFIGURED |
| `Permissions-Policy` | camera=(), microphone=() | NOT CONFIGURED |

### Layer 5: CI Pipeline Security
| Check | Spec Requirement | Status |
|---|---|---|
| Gitleaks full history scan | Required | ACTIVE |
| Data leak audit A1-A7 | Required | ACTIVE |
| Greppable invariants G1-G11 | Required | NOT AUTOMATED (KG-14) |
| `pnpm audit` high/critical gate | Required | NOT IN CI (KG-01) |
| ESLint boundaries + no-cycle | Required | ACTIVE (error severity) |

---

## HD-006: Payment Webhook Security — Key Items

| Item | Requirement | Status |
|---|---|---|
| SePay bearer token verification (constant-time) | Layer 1 | NOT IMPLEMENTED (no SePay code) |
| PaymentEvent idempotency (`@@unique([adapter, providerTxnId])`) | Layer 2 | SCHEMA EXISTS, untested for SePay |
| Amount guard (underpay/overpay/oversold) | Layer 3 | NOT IMPLEMENTED for SePay |
| Oversold race guard (`SELECT FOR UPDATE` on Trip) | Layer 4 | NOT IMPLEMENTED for SePay |
| BookingRef regex extraction | DS-013 | NOT IMPLEMENTED |
| Memo mismatch reconciliation (~5%) | DS-013 | NOT IMPLEMENTED |
| Central collection legal clearance | Decree 52/2024 | NOT OBTAINED |

---

## HD-012: Auth Attack Surface — Key Categories

| Category | Vectors | Status |
|---|---|---|
| IDOR (Customer→Customer, Op→Op) | 14 vectors | UNKNOWN (no formal audit) |
| Broken Authentication (token theft/forging/OTP) | 15+ vectors | PARTIAL (OTP lockout implemented, TOTP replay not) |
| Privilege Escalation (vertical + horizontal) | 8 vectors | UNKNOWN |
| Data Leakage in Responses | 12+ vectors | PARTIAL (select whitelists enforced, full audit needed) |
| CSRF | 3 vectors | IMPLEMENTED (double-submit) |
| Mass Assignment / Parameter Tampering | 6 vectors | LIKELY SAFE (Zod strips unknown fields) |
| Race Conditions | 5 vectors | PARTIAL (FOR UPDATE used, concurrent tests exist for some) |
| Session & Cookie Attacks | 4 vectors | UNKNOWN |
| Missing Auth | 4 vectors | UNKNOWN |
| Webhook Abuse | 4 vectors | PARTIAL (HMAC/bearer auth on webhooks) |

---

## Go-Live Gates Status

### GL-001: Launch Checklist (70 items, 11 categories)

| Category | Items | Status |
|---|---|---|
| Infrastructure (FPT Cloud VPS, PG, Redis, PgBouncer, Nginx, Cloudflare) | ~8 | NOT STARTED |
| Security (HD audits pass, OWASP headers, encryption, branch protection) | ~8 | NOT STARTED |
| Auth (production JWT secrets, CSRF, rate limiting, OTP lockout) | ~6 | PARTIAL |
| Payment Phase 1 (SePay, VietQR, PayoutAccount encryption, ledger triggers) | ~8 | NOT STARTED |
| Notifications (eSMS API key, brandname approval, SMS templates) | ~5 | NOT STARTED |
| Data/Compliance (DPO, DPAs, data residency, privacy/ToS, DSAR, piiAnonymization) | ~10 | NOT STARTED |
| Monitoring (BetterStack, Sentry) | ~5 | NOT STARTED |
| Backup (pg_dump, retention, restore test) | ~5 | NOT STARTED |
| Rollback (triggers, procedure, DNS) | ~5 | NOT STARTED |
| Smoke tests (post-deploy verification) | ~5 | NOT STARTED |
| Documentation (privacy policy, ToS, operator guide) | ~5 | NOT STARTED |

### GL-002: Monitoring Setup (12 items)
- Log pipeline (BetterStack, 5 retention tiers): NOT DEPLOYED
- Error tracking (Sentry + source maps): NOT DEPLOYED
- Uptime monitor (`/api/health`, 2-min detection): NOT DEPLOYED
- Alerting rules (5xx, cron, webhook, disk): NOT CONFIGURED
- Dashboard (request rate, error rate, latency, bookings, cron, DB pool): NOT BUILT
- Tet-aware adaptive thresholds: NOT DEFINED

### GL-003: Backup & DR (12 items)
- RPO/RTO targets: UNDEFINED
- pg_dump → FPT Object Storage automation: NOT CONFIGURED
- Redis backup strategy: UNDEFINED
- Backup retention (30 days minimum): NOT CONFIGURED
- Backup restore test on fresh instance: NOT EXECUTED
- DR runbook: NOT DOCUMENTED
- DR drill: NOT EXECUTED

### GL-004: Rollback Plan
- Rollback triggers defined: NOT DOCUMENTED
- Rollback procedure (Docker image revert): NOT DOCUMENTED
- DNS revert procedure: NOT DOCUMENTED

### GL-005: Smoke Test Suite
- Post-deploy verification script: NOT BUILT
- Health endpoint + cron endpoint checks: NOT AUTOMATED
- Payment webhook simulation: NOT BUILT

---

## Dependency Chain

```
HD-001 through HD-012 (all must PASS)
         ↓
GL-001 (launch checklist, references HD audit results)
         ↓
GL-002 through GL-005 (monitoring, backup, rollback, smoke tests)
         ↓
SI-003 Section 14.1 (review gate skills: advisory → blocking)
         ↓
Issue 094 go-live
```

**Current position:** Bottom of chain. No HD audit has started. Entire dependency stack is blocked.

**Phase 1 alternative (GL-006):** Bypass full HD/GL chain. GL-006 defines a simplified ~25-item checklist sufficient for family operator launch. Phase 2+ re-enters the full chain when external operators are onboarded.
