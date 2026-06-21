# Hardening Audits

> Status: DOCUMENTED | References: SI-003 Section 14.5, ADR-008, ADR-016, ADR-018, ADR-019

## Purpose

Pre-release audit gates that must pass before the first production deployment and be re-run on major architectural changes. Each audit produces a PASS/FAIL verdict. All twelve must PASS before review gate skills transition from advisory to blocking mode (SI-003 Section 14.1).

## Escalation Trigger

When all twelve audits below reach **PASS** status, update SI-003 Section 14.1 to change review gate skills from advisory (comment-only) to blocking (required status check). This is a one-way transition -- once blocking, skills do not revert to advisory.

## Audit Index

### Core Audits (Original)

| Audit | Document | Skill | Status |
|-------|----------|-------|--------|
| Security review | [HD-001](HD-001-security-review/) | `/security-review` + `/threat-model` | NOT_STARTED |
| Performance audit | [HD-002](HD-002-performance-audit/) | `/perf-audit` + `/ci-perf-gate` | NOT_STARTED |
| Error handling audit | [HD-003](HD-003-error-handling-audit/) | `/observability-review` | NOT_STARTED |
| Barrel import hygiene | [HD-004](HD-004-barrel-import-hygiene/) | ESLint + data-leak-audit A3 | NOT_STARTED |
| Tenant isolation audit | [HD-005](HD-005-tenant-isolation-audit/) | Grep `withOperatorScope` | NOT_STARTED |

### Extended Audits (Gap Coverage)

| Audit | Document | Skill | Status |
|-------|----------|-------|--------|
| Payment & webhook security | [HD-006](HD-006-payment-webhook-security/) | `/security-review` + `/threat-model` | NOT_STARTED |
| Regulatory & compliance | [HD-007](HD-007-regulatory-compliance/) | `/privacy-policy` + `/pii-inventory` | NOT_STARTED |
| Notification channel hardening | [HD-008](HD-008-notification-channel/) | `/observability-review` | NOT_STARTED |
| Financial integrity | [HD-009](HD-009-financial-integrity/) | `/security-review` + `/observability-review` | NOT_STARTED |
| Infrastructure & deployment security | [HD-010](HD-010-infrastructure-security/) | `/security-review` | NOT_STARTED |
| Cron & background job resilience | [HD-011](HD-011-cron-resilience/) | `/observability-review` + `/chaos-drill` | NOT_STARTED |
| Auth attack surface catalog | [HD-012](HD-012-auth-attack-surface/) | `/security-review` + `/threat-model` | NOT_STARTED |

## Dependency Graph

```
HD-001 (Security) ──┬── HD-006 (Payment Webhooks) ── HD-009 (Financial Integrity)
                    └── HD-005 (Tenant Isolation)
HD-003 (Error Handling) ── HD-011 (Cron Resilience)
HD-007 (Regulatory) ── HD-006 (Payment collection model)
HD-008 (Notifications) ── HD-001 (OTP = auth dependency)
HD-010 (Infrastructure) ── HD-001 (complementary: infra vs app security)
HD-012 (Auth Attack Surface) ── HD-001 (auth checks) + HD-005 (IDOR/tenant) + HD-006 (webhook abuse)
```

## Cross-References

- SI-003 Section 14.5 -- pipeline integration of hardening gates
- GL-001 -- launch checklist (depends on all HD audits passing)
- ADR-008 -- security posture (HD-001 acceptance criteria source)
- ADR-005 -- payment architecture (HD-006, HD-009 source)
- ADR-016 -- module boundaries (HD-004 acceptance criteria source)
- ADR-014 -- data classification (HD-007 source)
- DS-006 -- cron job design (HD-011 source)
- FI-014 -- notification system (HD-008 source)
- ADR-003 D8 -- Better Auth provider decision (HD-012 source)
- FI-001 -- core auth (HD-012 source)
