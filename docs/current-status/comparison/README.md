# Documentation vs Reality: Comparison Index

**Date:** 2026-06-21
**Scope:** All files in `documentation/` compared against actual codebase state via `docs/current-status/`

---

## Summary Scorecard

| Category | Total Items | Implemented | Gap | Gap % |
|---|---|---|---|---|
| ADR Decisions (20 docs) | ~60 decisions | ~50 | ~10 deferred | 17% |
| DS Specs (17 docs) | ~17 designs | ~10 built | ~7 not started | 41% |
| FD Specs (30 docs) | ~30 UI specs | ~25 built | ~5 partial | 17% |
| FI Synthesis (15 docs) | ~15 features | ~12 built | ~3 incomplete | 20% |
| SI Infra (6 docs) | ~6 systems | ~4 partial | ~2 not started | 33% |
| GL Go-Live (6 docs) | ~70 checklist items (GL-001); ~25 Phase 1 items (GL-006) | 0 | GL-006: ~25 | GL-001: 100%, GL-006: 100% |
| HD Hardening (12 docs) | ~200+ audit items | 0 | 200+ | 100% |
| Cron Jobs (DS-006) | 16 jobs | 11 | 5 missing | 31% |
| API Endpoints (DS-003) | ~250 routes | ~230 | ~20 missing | 8% |
| Prisma Models (DS-001) | 38 models | 38 | 0 | 0% |

---

## Top 10 Gaps by Severity

1. **Central collection model — no SBV license** (regulatory shutdown risk)
2. **Zero hardening audits executed** (200+ unchecked security/compliance items)
3. **Zero go-live gates executed** (70+ unchecked launch items)
4. **SePay bank transfer NOT IMPLEMENTED** (primary Vietnam payment method blocked)
5. **Customer refund endpoint NOT IMPLEMENTED** (CPL 2023 Art. 29 violation)
6. **Monitoring NOT DEPLOYED** (BetterStack + Sentry = zero incident detection)
7. **Regulatory compliance infrastructure absent** (DPO, DPAs, DSAR, breach playbook)
8. **E-invoice transport fields NOT MAPPED** (Decree 70/2025, fines per invoice)
9. **HTTP security headers NOT CONFIGURED** (OWASP baseline missing)
10. **Admin TOTP replay protection NOT IMPLEMENTED** (auth attack surface open)

---

## Comparison Files

| # | File | Scope |
|---|------|-------|
| 01 | [Critical Blockers](01-critical-blockers.md) | 8 go-live blockers: payment model, hardening, monitoring, refund, regulatory |
| 02 | [Security Gaps](02-security-gaps.md) | HTTP headers, plaintext bank details, TOTP, branch protection, secrets rotation |
| 03 | [Payment Integration](03-payment-integration.md) | Per-adapter comparison (MoMo/VNPay/SePay/ZaloPay/Card), refund, chargeback |
| 04 | [Regulatory Compliance](04-regulatory-compliance.md) | DPO, DPAs, CDTIA, DSAR, breach playbook, e-invoice, tax withholding |
| 05 | [CI/CD Pipeline](05-ci-cd-pipeline.md) | 6 working stages vs 8 missing, KG-01 through KG-26 |
| 06 | [Cron Jobs](06-cron-jobs.md) | 16 specified vs 11 built, per-job status |
| 07 | [API Endpoints](07-api-endpoints.md) | DS-003/DS-007 specified endpoints vs implemented routes |
| 08 | [Frontend Design](08-frontend-design.md) | 30 FD specs vs component/page reality |
| 09 | [Hardening & Go-Live](09-hardening-go-live.md) | HD-001–012 + GL-001–005 checklist status |
| 10 | [Architecture Alignment](10-architecture-alignment.md) | What IS correct and aligned with specs |
| 11 | [Business Domain](11-business-domain.md) | Domain model, state machines, invariants, regulatory alignment |
| 12 | [Spec Contradictions](12-spec-contradictions.md) | Resolved contradictions + documentation-only gaps |

**Phase 1 scope:** See [GL-006](../../../documentation/go-live/GL-006-phase1-launch-scope/README.md) for which ADRs/DSs are in-scope vs deferred.

---

## Phase 1 Applicability (GL-006)

Phase 1 = 1-2 family-owned operators, VietQR bank transfer + cash, single Agribank account. Platform owner = operator = same entity. See [GL-006](../../../documentation/go-live/GL-006-phase1-launch-scope/README.md).

**Re-scored Top 10 for Phase 1:**

| # | Gap | Full Severity | Phase 1 Severity | Reason |
|---|---|---|---|---|
| 1 | Central collection — SBV license | CRITICAL | **NOT APPLICABLE** | Family operator = same entity, no third-party fund handling |
| 2 | Zero hardening audits | CRITICAL | **REDUCED** | Only basic security items needed (HTTP headers, admin password) |
| 3 | Zero go-live gates | CRITICAL | **REPLACED** | GL-006 simplified checklist (~25 items vs 70) |
| 4 | SePay NOT IMPLEMENTED | CRITICAL | **CRITICAL** | Still needed — primary payment method |
| 5 | Customer refund endpoint | CRITICAL | **LOW** | Manual bank transfer refund for low volume |
| 6 | Monitoring NOT DEPLOYED | CRITICAL | **MEDIUM** | Stdout logs + manual checks OK at low scale |
| 7 | Regulatory infrastructure | CRITICAL | **DEFERRED** | DPO, DPAs, DSAR, breach playbook — all Phase 2+ |
| 8 | E-invoice fields | CRITICAL | **DEFERRED** | No e-invoice in Phase 1 |
| 9 | HTTP security headers | HIGH | **HIGH** | Still needed |
| 10 | Admin TOTP replay | HIGH | **MEDIUM** | Family admin, lower attack surface |

**Phase 1 actual blockers (only 3):**
1. SePay/VietQR payment flow — must build
2. HTTP security headers — must configure
3. Admin seed password change + `tempPasswordPlain` handling

---

## How to Read

Each comparison file follows this structure per item:
- **Spec says:** What the documentation specifies (with doc ID reference)
- **Reality:** What the current-status confirms exists in code
- **Gap:** What's missing or wrong
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **Resolution:** What needs to happen

Cross-references use spec prefix IDs: ADR-001, DS-006, FD-013, FI-008, SI-003, GL-002, HD-001, etc.
