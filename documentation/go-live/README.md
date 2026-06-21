# Go-Live Gates

> Status: DOCUMENTED | References: SI-003 §14.5, SI-006, ADR-020

## Purpose

Production readiness gates that must all pass before Issue 094 go-live. Each gate has a PASS/FAIL verdict. All five must PASS before the first production deployment with real user data.

## Prerequisites

All five hardening audits (HD-001 through HD-005) must reach PASS status before go-live gates are evaluated. See `documentation/hardening/README.md`.

## Gate Index

| Gate | Document | Skill | Status |
|------|----------|-------|--------|
| Launch checklist | [GL-001](GL-001-launch-checklist/) | `/launch-checklist` | NOT_STARTED |
| Monitoring setup | [GL-002](GL-002-monitoring-setup/) | `/observability-design` | NOT_STARTED |
| Backup & DR | [GL-003](GL-003-backup-dr/) | `/backup-restore` + `/dr-drill` | NOT_STARTED |
| Rollback plan | [GL-004](GL-004-rollback-plan/) | `/rollback-plan` | NOT_STARTED |
| Smoke test suite | [GL-005](GL-005-smoke-test-suite/) | `/prod-smoke` | NOT_STARTED |

## Cross-References

- SI-003 §14.5 -- pipeline integration of go-live gates
- SI-003 Known Gaps -- go-live blockers (KG-01 through KG-06)
- SI-006 -- deployment configuration and NFR targets
- `documentation/scaffolding-infra/README.md` -- consolidated go-live blockers table
- `documentation/hardening/README.md` -- prerequisite audits
