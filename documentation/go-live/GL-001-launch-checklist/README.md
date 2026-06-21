# GL-001: Launch Checklist

> Status: NOT_STARTED | References: SI-003 §14.5, SI-006, ADR-008, ADR-020

## Purpose

Master checklist for the first production deployment (Issue 094). Every item must be checked or explicitly deferred with documented rationale before going live with real users and real money.

## Skill Invocation

- **Primary**: `/launch-checklist` -- structured production readiness assessment

## Checklist

### Infrastructure (SI-006, ADR-020)

- [ ] FPT Cloud VPS provisioned (Hanoi or HCM data centre)
- [ ] PostgreSQL 16 managed instance running (FPT Cloud)
- [ ] Redis 7 managed instance running (FPT Cloud)
- [ ] PgBouncer transaction mode confirmed on port 6432
- [ ] Docker Compose stack deploying successfully
- [ ] Nginx reverse proxy configured with SSL (Let's Encrypt or Cloudflare Origin CA)
- [ ] DNS pointing to FPT Cloud instance
- [ ] Cloudflare WAF Pro ($20/mo) active

### Security (ADR-008, HD-001, HD-006, HD-010)

- [ ] HD-001 security review: **PASS**
- [ ] HD-006 payment & webhook security audit: **PASS**
- [ ] HD-010 infrastructure security audit: **PASS**
- [ ] All 6 OWASP security headers configured (KG-02)
- [ ] PayoutAccount bank details encrypted at rest (KG-03) -- verified via integration test
- [ ] Branch protection rules configured in GitHub (KG-04)
- [ ] Secrets rotation runbook documented (KG-06)
- [ ] Admin seed password changed from `123456`
- [ ] `tempPasswordPlain` column removed or encrypted
- [ ] Gitleaks + data-leak-audit passing in CI
- [ ] Dependabot + `pnpm audit` active in CI (KG-01)
- [ ] TOTP replay protection active (SETNX jti, 30s TTL)
- [ ] TOTP backup codes implemented (admin device-loss recovery)
- [ ] Sentry deployed and capturing unhandled exceptions
- [ ] BetterStack uptime monitoring active

### Auth & Access

- [ ] Production JWT secrets generated (not CI test values)
- [ ] CRON_SECRET generated and configured
- [ ] CSRF double-submit middleware active
- [ ] Rate limiting active on auth endpoints
- [ ] OTP lockout (3 failures → 15-min) working

### Payment -- Phase 1: Bank Transfer + Cash (ADR-005, HD-006, HD-009)

- [ ] HD-006 payment & webhook security audit: **PASS**
- [ ] HD-009 financial integrity audit: **PASS**
- [ ] `SEPAY_API_KEY` configured (production, not test/placeholder)
- [ ] `VIETQR_ACCOUNT_NUMBER` + `VIETQR_BANK_BIN` configured (Agribank production account)
- [ ] SePay webhook URL registered and receiving test transfers
- [ ] SePay bearer token verification active on `/api/payments/bank_transfer/webhook`
- [ ] Append-only ledger: triggers preventing UPDATE/DELETE active
- [ ] `PAYMENTS_STUB=false` in production env
- [ ] BookingRef extraction from memo working (case-insensitive regex)
- [ ] Admin reconciliation dashboard for memo-mismatch transfers (~5%)
- [ ] Manual refund process documented (no programmatic refund API for bank transfer)
- [ ] Payment collection model: legal clearance obtained (SBV IPS license OR legal opinion -- Decree 52/2024)
- [ ] Payment anomaly alerting configured (failed webhook spikes, amount mismatches)

### Notifications (ADR-013, HD-008)

- [ ] HD-008 notification channel hardening: **PASS**
- [ ] eSMS production API key configured
- [ ] eSMS brandname approved (5-10 week process -- start early)
- [ ] SMS template registered and approved
- [ ] Resend production API key configured (if email active)
- [ ] OTP delivery monitoring active (>95% delivery within 30s target)
- [ ] Notification delivery failure alerting configured

### Data & Compliance (ADR-014, PDPL 2025, HD-007)

- [ ] HD-007 regulatory & compliance audit: **PASS**
- [ ] All user data stored on FPT Cloud Vietnam (zero CDTIA obligation)
- [ ] If Resend (US) processes customer email: CDTIA filed with MPS A05 within 60 days
- [ ] No production PII in staging/Vercel environment
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] DPO appointed (PDPL 2025 -- mandatory for sensitive-data platforms)
- [ ] DPA signed with all processors (eSMS, Resend, MISA, VNPay, MoMo)
- [ ] E-invoice transport fields mapped to MISA XML (Decree 70/2025 -- fine per invoice if missing)
- [ ] Tax withholding `calcWithholding()` implemented OR pre-Jul-2026 deferral documented
- [ ] DSAR response API implemented (data export/deletion within 72h)
- [ ] `piiAnonymization` cron built and tested
- [ ] Breach notification tabletop exercise completed

### Monitoring (GL-002)

- [ ] GL-002 monitoring setup: **PASS**

### Backup & DR (GL-003)

- [ ] GL-003 backup & DR: **PASS**

### Rollback (GL-004)

- [ ] GL-004 rollback plan: **PASS**

### Smoke Tests (GL-005)

- [ ] GL-005 smoke test suite: **PASS**

### Cron Jobs (DS-006, HD-011)

- [ ] HD-011 cron & background job resilience audit: **PASS**
- [ ] All 16 cron endpoints responding with correct contract shape
- [ ] Supercronic sidecar running with `TZ=Asia/Ho_Chi_Minh`
- [ ] Hold expiry sweep verified (10-min TTL)
- [ ] Notification dispatch cron verified
- [ ] `operatorLicenseAlert` and `piiAnonymization` cron routes implemented (KG from SI-006)
- [ ] Missed-cron detection alerting configured
- [ ] `paymentRecon` sweeper cron built OR deferral documented
- [ ] `strandedPayoutRecovery` cron built OR deferral documented

### Post-Deploy (SI-003 §11)

- [ ] Health check endpoint returning 200
- [ ] Smoke test script passing against production URL
- [ ] Rollback trigger thresholds documented (SI-003 §11.5)

## Verdict

**PASS** when all checklist items are checked or explicitly deferred with documented rationale.

## Cross-References

- SI-003 §14.5 -- go-live gate definition
- SI-003 Known Gaps -- KG-01 through KG-06
- SI-006 -- deployment architecture
- ADR-008 -- security posture
- ADR-020 -- infrastructure decisions
