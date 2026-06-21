# GL-004: Rollback Plan

> Status: NOT_STARTED | References: SI-003 §11.5, ADR-017, SI-006

## Purpose

Document and verify the production rollback procedure so any failed deployment can be reversed within the RTO window. Special attention to forward-only migrations (ADR-017 D1) which cannot be rolled back.

## Skill Invocation

- **Primary**: `/rollback-plan` -- rollback procedure review and validation

## Acceptance Criteria

### Docker Image Rollback

- [ ] Previous image SHA recorded before every deployment
- [ ] Rollback command documented: `docker compose pull && docker compose up -d` with previous SHA tag
- [ ] Rollback time verified: < 5 minutes from decision to healthy state
- [ ] At least 3 previous image SHAs retained in GHCR

### Rollback Trigger Thresholds (SI-003 §11.5)

- [ ] Health check non-200 for 2 consecutive minutes → rollback
- [ ] 5xx error rate > 5% in first 10 minutes → rollback
- [ ] Prisma migration failure → forward-fix (cannot rollback)
- [ ] Cron endpoint contract violation → rollback
- [ ] Thresholds documented and accessible to on-call

### Migration Rollback Constraints (ADR-017 D1)

- [ ] Forward-only policy understood: no DOWN migrations exist
- [ ] Forward-fix procedure documented:
  1. Identify breaking migration
  2. Author corrective forward migration
  3. Test on shadow database
  4. Deploy forward-fix migration
- [ ] Two-phase destructive change rule applied to prevent data loss:
  - Phase A: remove code references, deploy, verify
  - Phase B: drop column/table, deploy

### Rollback Drill

- [ ] Simulated deployment failure and rollback executed on staging
- [ ] Rollback time measured and within RTO target
- [ ] Post-rollback health check verified
- [ ] Post-rollback smoke test passed
- [ ] Post-rollback cron jobs verified

### Communication

- [ ] Rollback decision authority documented (who can trigger)
- [ ] Customer notification template prepared (if extended downtime)
- [ ] Operator notification template prepared

## Verdict

**PASS** when rollback procedure is documented, drill has been executed on staging, and rollback time is within RTO target.

## Cross-References

- SI-003 §11.5 -- rollback trigger definition
- ADR-017 D1 -- forward-only migrations (no DOWN scripts)
- ADR-017 D2 -- two-phase destructive changes
- SI-006 -- deployment configuration
