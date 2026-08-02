# Critical Blockers — Spec vs Reality

Items that MUST be resolved before any production deployment (Issue 094 go-live).

> **Phase 1 note (GL-006):** Phase 1 = 1-2 family operators (platform owner = operator). Many blockers below are NOT applicable to Phase 1. Each section includes a Phase 1 verdict.

---

## 1. Payment Collection Model — Central vs Split Settlement

**Severity:** CRITICAL (regulatory shutdown risk)

**Spec says:**
- ADR-004 D2: Platform designed as PSP split-settlement marketplace — each operator opens own VNPay/MoMo merchant account; platform never touches operator funds
- DS-009: Defines `OperatorPspAccount` model, `PspAccountStatus` enum (PENDING/ACTIVE/SUSPENDED/REVOKED), `SettlementModel` discriminator (CENTRAL vs SPLIT) on Booking
- ADR-004 risk matrix labels central collection "Illegal without SBV license"

**Reality:**
- Central collection only. Single platform merchant account for VNPay/MoMo
- All customer payments flow to platform's account; operator share tracked via internal `LedgerEntry` only
- DS-009 schema models (`OperatorPspAccount`, `PspAccountStatus`, `SettlementModel`) NOT in Prisma schema
- No PSP sub-merchant registration flow exists
- No split instruction in payment URL creation
- No split amount verification in webhook handler

**Gap:** Entire split-settlement architecture is spec-only. Code implements central collection exclusively.

**Regulatory risk:** Decree 52/2024 Art. 3(17) classifies platform as unlicensed `thu ho/chi ho` (collection/payment support). SBV IPS license requires VND 50B capital.

**Resolution paths:**
1. Obtain legal opinion confirming exemption (cheapest, fastest)
2. Partner with licensed escrow provider (medium cost, medium time)
3. Obtain SBV IPS license (VND 50B capital, 6-12 months)
4. Implement split-settlement per DS-009 (operators open own merchant accounts)

**Phase 1 verdict: NOT A BLOCKER.** Family operator = platform owner = same legal entity. No third-party fund relationship. Central collection is internal fund movement, not "thu hộ chi hộ". Becomes relevant only when onboarding external operators (Phase 2+).

---

## 2. All 12 Hardening Audits — NOT_STARTED

**Severity:** CRITICAL

**Spec says:**
- HD-001 through HD-012 define comprehensive audit checklists:
  - HD-001: Security review (5 layers: input validation, auth, data protection, HTTP headers, CI)
  - HD-002: Performance audit
  - HD-003: Error handling audit
  - HD-004: Barrel import hygiene
  - HD-005: Tenant isolation audit
  - HD-006: Payment webhook security
  - HD-007: Regulatory compliance
  - HD-008: Notification channel
  - HD-009: Financial integrity
  - HD-010: Infrastructure security
  - HD-011: Cron resilience
  - HD-012: Auth attack surface (50+ attack vectors cataloged)
- SI-003 Section 14.1: Review gate skills transition from advisory to blocking ONLY after HD audits pass

**Reality:**
- Zero of 12 audits have been executed
- No audit results, pass/fail status, or remediation tracking exists
- 200+ individual checklist items across all 12 audits remain unchecked

**Gap:** Complete absence of pre-production security/compliance validation.

**Resolution:** Execute each HD audit sequentially. Fix findings. Record pass status. Only then can GL gates proceed.

**Phase 1 verdict: REDUCED.** GL-006 replaces full HD audit chain. Only basic security items needed: HTTP headers, admin password, `tempPasswordPlain`. Full HD audits deferred to Phase 2+.

---

## 3. All 5 Go-Live Gates — NOT_STARTED

**Severity:** CRITICAL

**Spec says:**
- GL-001: Launch checklist (70 items across 11 categories: infra, security, auth, payment, notifications, data/compliance, monitoring, backup, rollback, smoke tests, documentation)
- GL-002: Monitoring setup (BetterStack, Sentry, alerting rules, dashboard, 2-minute detection target)
- GL-003: Backup & DR (RPO/RTO definition, pg_dump automation, restore testing, DR drill)
- GL-004: Rollback plan (rollback triggers, procedure, DNS revert)
- GL-005: Smoke test suite (post-deploy verification)

**Reality:**
- Zero of 5 gates have been executed
- RPO/RTO targets undefined (ADR-002 gap)
- No monitoring tooling deployed
- No backup automation configured
- No DR drill executed
- No rollback procedure documented

**Gap:** No production readiness framework exists at all.

**Resolution:** Depends on HD audits passing first. Then execute GL-001 through GL-005 in order.

**Phase 1 verdict: REPLACED.** GL-006 provides simplified ~25-item checklist for Phase 1. Full GL-001 through GL-005 chain deferred.

---

## 4. Admin Seed Password + Temp Password Column

**Severity:** CRITICAL (security)

**Spec says:**
- SI-002 Section 7.2: Admin seed password must use `genTempPassword()` (random), not hardcoded value
- Security best practice: No plaintext password storage in database columns

**Reality:**
- `prisma/seed.ts` hardcodes admin password to `123456`
- `OperatorUser.tempPasswordPlain` column stores plaintext temporary passwords (dev convenience)
- Issue 113 tracks removal but is not yet resolved
- Both block Issue 094 go-live

**Gap:** Known dev-only shortcuts still in codebase. Any production deployment with these = immediate security vulnerability.

**Resolution:**
1. Revert seed password to `genTempPassword()`
2. Remove or encrypt `tempPasswordPlain` column via forward migration
3. Add CI check that seed.ts contains no hardcoded password strings

---

## 5. SePay Bank Transfer Webhook — NOT IMPLEMENTED

**Severity:** CRITICAL (primary payment method blocked)

**Spec says:**
- DS-013: Full design for SePay webhook — bearer token auth, bookingRef regex extraction from memo, amount guard (underpay rejection, overpay logging), idempotent PaymentEvent insertion, booking state transition (`awaiting_payment -> paid`)
- FI-008: Lists bank transfer as Phase 1 launch requirement
- HD-006: Defines 4-layer webhook defense stack for SePay

**Reality:**
- No `lib/payment/sepay.ts` exists
- No `app/api/payments/bank_transfer/webhook/route.ts` handler
- VietQR display page not built
- No SePay account setup (Agribank)
- Memo mismatch reconciliation dashboard not built
- `paymentReconSweeper` cron not built (backup path)

**Gap:** Entire bank transfer payment flow is design-only. Bank transfer is Vietnam's most common payment method for higher-value transactions.

**Resolution:** Implement DS-013 design. Requires SePay vendor account + Agribank setup as prerequisite.

**Phase 1 verdict: CRITICAL.** SePay/VietQR is the primary Phase 1 payment method. Must build before launch.

---

## 6. Customer Refund Endpoint — NOT IMPLEMENTED

**Severity:** CRITICAL (legal requirement)

**Spec says:**
- DS-007: 5 refund API endpoints:
  - `POST /api/bookings/{id}/cancel` — customer self-cancel + refund trigger T1
  - `GET /api/customers/me/refunds` — customer refund list
  - `GET /api/admin/refunds` — admin refund list with filters
  - `POST /api/admin/refunds/{id}/retry` — admin retry failed refund
  - `POST /api/admin/refunds/{id}/complete` — admin manual completion
- Consumer Protection Law 2023 Art. 29: Refund capability is legally required

**Reality:**
- None of the 5 refund endpoints exist in current-status API docs
- `Refund` model + `RefundStatus` enum exist in Prisma schema (data model ready)
- PSP refund dispatch throws `PspRefundNotImplementedError` when invoked
- Oversold-race refund triggers (T3, T4) are enqueued post-commit but cannot execute

**Gap:** Schema ready, service layer absent, endpoints absent.

**Resolution:** Implement `lib/payment/refund.ts` service + 5 API routes per DS-007. For Phase 1 (bank transfer only), manual admin-initiated refund via bank transfer is acceptable; programmatic PSP refund needed for MoMo/VNPay phases.

**Phase 1 verdict: LOW.** Family operator handles refunds manually via bank transfer. Low transaction volume. Formal refund API needed Phase 2+ with external operators and PSP integration.

---

## 7. Regulatory Compliance Infrastructure — Absent

**Severity:** CRITICAL (multiple legal obligations)

| Requirement | Spec Reference | Legal Basis | Status |
|---|---|---|---|
| DPO appointment | HD-007 Section 1 | PDPL 2025 (mandatory, no SME exemption) | NOT DONE |
| DPAs signed (SePay, eSMS, Resend, MISA) | HD-007 Section 2 | PDPL 2025 Art. 25 | NOT DONE |
| CDTIA filing (if using Resend US) | HD-007 Section 3 | Decree 53/2022, Law 116/2025 | UNKNOWN |
| DSAR API (72h data export/deletion) | FI-013 | PDPL 2025 Art. 14 | NOT IMPLEMENTED |
| `piiAnonymization` cron | FI-013, SI-006 | PDPL 2025 retention policy | NOT IMPLEMENTED |
| Breach notification playbook | HD-007 Section 5 | PDPL 2025 Art. 21 (72h to MPS A05) | NOT DOCUMENTED |
| Tabletop exercise | HD-007 Section 5 | Mandatory before go-live | NOT EXECUTED |
| E-invoice transport fields | FI-015 | Decree 70/2025 | NOT MAPPED |
| Consent management (T1+T2) | HD-007 Section 6 | PDPL 2025 Art. 9 | PARTIAL (`lib/booking/consent.ts` exists) |

**Gap:** Legal infrastructure (people + processes + agreements) does not exist. Code-level compliance features (DSAR, PII anonymization, e-invoice fields) not built.

**Resolution:** Non-code items (DPO, DPAs, CDTIA, breach playbook) require business action. Code items (DSAR API, piiAnonymization cron, e-invoice transport fields) require implementation per FI-013 and FI-015.

**Phase 1 verdict: MOSTLY DEFERRED.** Family operator with <10k users. DPO, DPAs, CDTIA, DSAR, e-invoice, PII anonymization all deferred per GL-006. Only privacy policy + terms of service needed for Phase 1.

---

## 8. Monitoring & Observability — Not Deployed

**Severity:** CRITICAL (zero incident detection capability)

**Spec says:**
- GL-002: BetterStack for uptime monitoring (health check `/api/health`, 99.5%/99.9% availability targets)
- GL-002: Sentry for error tracking (source maps, error grouping, PII scrubbing)
- ADR-002: 2-minute incident detection target
- ADR-007: Observability architecture decision
- GL-002: Alerting rules (health check 2x fails, 5xx >5%, cron missed run, payment webhook >1%, disk >80%)
- GL-002: Dashboard (request rate, error rate, latency p50/p95/p99, active bookings/holds, cron execution, DB pool)

**Reality:**
- Pino structured logging implemented in `lib/core/logger/`
- `instrumentation.ts` exists (Next.js observability hook)
- NO external APM deployed
- NO error tracking service deployed
- NO uptime monitoring deployed
- NO alerting rules configured
- NO dashboard built

**Gap:** Logging exists but has no consumer. Cannot detect payment webhook failures, cron timeouts, DB connection pool exhaustion, or any production incident until customer reports.

**Resolution:** Deploy BetterStack + Sentry. Configure alerting rules per GL-002. Build operational dashboard. Estimated: 1-2 days for basic setup.

**Phase 1 verdict: MEDIUM.** Stdout logs + manual monitoring acceptable for low-volume family operation. Deploy basic uptime check (free tier). Full BetterStack + Sentry deferred to Phase 2+.
