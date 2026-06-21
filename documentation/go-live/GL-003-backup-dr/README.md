# GL-003: Backup & Disaster Recovery

> Status: NOT_STARTED | References: SI-006, ADR-020

## Purpose

Define and verify backup strategy and disaster recovery procedures. RPO and RTO targets must be established and tested via drill before production launch.

## Skill Invocation

- **Primary**: `/backup-restore` -- backup strategy validation
- **Supplementary**: `/dr-drill` -- disaster recovery simulation

## Acceptance Criteria

### Backup Strategy

- [ ] RPO (Recovery Point Objective) defined -- maximum acceptable data loss window
- [ ] RTO (Recovery Time Objective) defined -- maximum acceptable downtime
- [ ] PostgreSQL backup schedule configured:
  - Automated `pg_dump` to FPT Object Storage (SI-003 §8.2)
  - Frequency: at minimum daily, recommended every 6 hours
  - Retention: 30 days minimum
- [ ] Redis backup strategy defined (if persistent data stored in Redis)
- [ ] Application code backup: Git repository (GHCR images as secondary)
- [ ] Environment variable backup: documented in secure location (not in Git)

### Backup Verification

- [ ] Backup restore tested on a fresh FPT Cloud instance
- [ ] Restored database passes `prisma migrate deploy` without errors
- [ ] Restored database passes application health check
- [ ] Backup file integrity verified (checksums)
- [ ] Backup encryption at rest confirmed (FPT Object Storage)

### Disaster Recovery Procedure

- [ ] DR runbook documented with step-by-step instructions:
  1. Provision new FPT Cloud VPS (or failover to Vercel sin1 as temporary measure)
  2. Restore PostgreSQL from latest backup
  3. Apply any pending migrations
  4. Deploy latest Docker image from GHCR
  5. Update DNS to new instance
  6. Verify health check and smoke tests
  7. Verify cron jobs resuming
- [ ] DR drill executed at least once before go-live
- [ ] DR drill results documented (actual RTO achieved vs target)

### Provider Migration (DS-017 §6)

- [ ] 2-4 hour cutover window procedure documented
- [ ] DNS TTL lowered to 300s before migration
- [ ] `pg_dump` / `pg_restore` commands documented for FPT → alternative provider
- [ ] Health check + smoke test post-migration verified

### Append-Only Ledger Protection

- [ ] LedgerEntry backup included in PostgreSQL dump
- [ ] Ledger trigger (`BEFORE UPDATE OR DELETE`) survives restore
- [ ] Ledger integrity verification post-restore (row counts, sum checks)

## Verdict

**PASS** when RPO/RTO are defined, backup restore has been tested, and DR drill has been executed at least once.

## Cross-References

- SI-006 -- deployment configuration (currently RPO/RTO undefined -- KG)
- SI-006 §13 -- provider migration playbook
- DS-017 §6 -- provider migration procedure
- SI-003 §8.2 -- IaC gaps (backup via pg_dump to FPT Object Storage)
