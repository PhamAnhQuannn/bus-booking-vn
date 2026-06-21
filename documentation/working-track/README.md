# Working Track -- Phase 1 Launch

Status tracking for all work items derived from gap analysis
(`documentation/current-status/comparison/`) scoped to GL-006 Phase 1.

## Legend

| Status | Meaning |
|--------|---------|
| NOT_STARTED | Work not begun |
| IN_PROGRESS | Actively being worked |
| BLOCKED | Waiting on external dependency |
| DONE | Completed and verified |
| DEFERRED | Explicitly deferred to Phase 2+ |

---

## Group A: Phase 1 Blockers

| # | File | Severity | Status | Comparison | Spec |
|---|------|----------|--------|------------|------|
| 01 | [admin-seed-password-and-temp-column](01-admin-seed-password-and-temp-column.md) | CRITICAL | DONE | 01 S4 | SI-002, I-113 |
| 02 | [http-security-headers](02-http-security-headers.md) | CRITICAL | DONE | 02 S1, 09 HD-001 | ADR-008, KG-02 |
| 03 | [sepay-vietqr-payment-flow](03-sepay-vietqr-payment-flow.md) | CRITICAL | NOT_STARTED | 01 S5, 03 S3 | DS-013 |

## Group B: Phase 1 Security Hardening

| # | File | Severity | Status | Comparison | Spec |
|---|------|----------|--------|------------|------|
| 04 | [payout-account-encryption](04-payout-account-encryption.md) | HIGH | DONE | 02 S2 | KG-03, HD-001 |
| 05 | [admin-totp-replay-protection](05-admin-totp-replay-protection.md) | HIGH | DONE | 02 S3 | HD-012 |
| 06 | [branch-protection-rules](06-branch-protection-rules.md) | HIGH | NOT_STARTED | 02 S4 | KG-04 |
| 07 | [secrets-rotation-runbook](07-secrets-rotation-runbook.md) | HIGH | DONE | 02 S5 | KG-06 |

## Group C: Phase 1 Infrastructure

| # | File | Severity | Status | Comparison | Spec |
|---|------|----------|--------|------------|------|
| 08 | [fpt-cloud-vps-provisioning](08-fpt-cloud-vps-provisioning.md) | HIGH | NOT_STARTED | 09, 12 | ADR-020 |
| 09 | [docker-compose-production-stack](09-docker-compose-production-stack.md) | HIGH | NOT_STARTED | 05, 09 | ADR-020, SI-006 |
| 10 | [nginx-ssl-dns-cloudflare](10-nginx-ssl-dns-cloudflare.md) | HIGH | NOT_STARTED | 09 | SI-006 |
| 11 | [production-jwt-and-cron-secrets](11-production-jwt-and-cron-secrets.md) | HIGH | NOT_STARTED | 09 | GL-006 |

## Group D: Phase 1 Integration

| # | File | Severity | Status | Comparison | Spec |
|---|------|----------|--------|------------|------|
| 12 | [sepay-vendor-account-setup](12-sepay-vendor-account-setup.md) | CRITICAL | NOT_STARTED | 03 S3 | DS-013 |
| 13 | [cash-booking-operator-flow](13-cash-booking-operator-flow.md) | MEDIUM | NOT_STARTED | 03 S8 | GL-006 |
| 14 | [ledger-triggers-production-verification](14-ledger-triggers-production-verification.md) | MEDIUM | NOT_STARTED | 03 | GL-006 |
| 15 | [esms-production-sms](15-esms-production-sms.md) | MEDIUM | NOT_STARTED | 09 | ADR-013 |
| 16 | [manual-refund-process-documentation](16-manual-refund-process-documentation.md) | LOW | NOT_STARTED | 01 S6, 03 S6 | DS-007 |

## Group E: Phase 1 Data + Legal

| # | File | Severity | Status | Comparison | Spec |
|---|------|----------|--------|------------|------|
| 17 | [privacy-policy-publication](17-privacy-policy-publication.md) | MEDIUM | DONE | 04 S1 | GL-006, PDPL |
| 18 | [terms-of-service-publication](18-terms-of-service-publication.md) | MEDIUM | DONE | 04 | GL-006 |

## Group F: Phase 1 Verification

| # | File | Severity | Status | Comparison | Spec |
|---|------|----------|--------|------------|------|
| 19 | [cron-supercronic-sidecar](19-cron-supercronic-sidecar.md) | MEDIUM | NOT_STARTED | 06 | DS-006 |
| 20 | [zod-boot-validation-completeness](20-zod-boot-validation-completeness.md) | MEDIUM | DONE | 02 S8 | SI-006 |
| 21 | [pnpm-audit-ci-stage](21-pnpm-audit-ci-stage.md) | HIGH | DONE | 02 S6, 05 | KG-01 |
| 22 | [greppable-invariants-ci](22-greppable-invariants-ci.md) | HIGH | DONE | 02 S7, 05 | KG-14 |
| 23 | [smoke-tests](23-smoke-tests.md) | HIGH | NOT_STARTED | 09 | GL-006 |
| 24 | [post-deploy-health-check](24-post-deploy-health-check.md) | MEDIUM | NOT_STARTED | 01 S8, 09 | GL-006 |

## Group G: Deferred (Phase 2+)

| # | File | Trigger | Comparison | Spec |
|---|------|---------|------------|------|
| 25 | [deferred-split-settlement](25-deferred-split-settlement.md) | External operator | 01 S1 | DS-009 |
| 26 | [deferred-momo-vnpay-zalopay-card](26-deferred-momo-vnpay-zalopay-card.md) | PSP contracts | 03 | FI-008 |
| 27 | [deferred-regulatory-infrastructure](27-deferred-regulatory-infrastructure.md) | >10k users | 04 | HD-007 |
| 28 | [deferred-einvoice-tax-withholding](28-deferred-einvoice-tax-withholding.md) | ERC + Jul 2026 | 04 S7-8 | FI-015, FI-010 |
| 29 | [deferred-full-hardening-audits](29-deferred-full-hardening-audits.md) | Phase 2 | 01 S2, 09 | HD-001-012 |
| 30 | [deferred-full-go-live-gates](30-deferred-full-go-live-gates.md) | Phase 2 | 01 S3, 09 | GL-001-005 |
| 31 | [deferred-monitoring-observability](31-deferred-monitoring-observability.md) | >1k bookings/mo | 01 S8, 09 | GL-002 |
| 32 | [deferred-customer-refund-api](32-deferred-customer-refund-api.md) | Phase 2 | 01 S6, 03 S6 | DS-007 |
| 33 | [deferred-i18n-branding-perf](33-deferred-i18n-branding-perf.md) | Expansion | 08 | FD-006, FD-025 |

---

Cross-references: [GL-006](../go-live/GL-006-phase1-launch-scope/README.md) | [Comparison Index](../current-status/comparison/README.md)
