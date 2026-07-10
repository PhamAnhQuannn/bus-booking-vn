# GL-003: Backup & Disaster Recovery

> Status: NOT_STARTED | References: SI-006, ADR-020

## Purpose

Define and verify backup strategy and disaster recovery procedures. RPO and RTO targets must be established and tested via drill before production launch.

> **2026-06-21 Note**: Primary database is Neon (ADR-020 D11). Neon provides built-in PITR (7-day retention on free, 30-day on paid). Neon's managed backups are the primary recovery mechanism.

## Skill Invocation

- **Primary**: `/backup-restore` -- backup strategy validation
- **Supplementary**: `/dr-drill` -- disaster recovery simulation

## Acceptance Criteria

### Backup Strategy

- [ ] RPO (Recovery Point Objective) defined -- maximum acceptable data loss window
- [ ] RTO (Recovery Time Objective) defined -- maximum acceptable downtime
- [ ] PostgreSQL backup via Neon managed PITR backups:
  - Neon PITR enabled (30-day retention on paid plan)
  - Branch restore tested
- [ ] Redis backup strategy defined (if persistent data stored in Redis)
- [ ] Application code backup: Git repository (GHCR images as secondary)
- [ ] Environment variable backup: documented in secure location (not in Git)

### Backup Verification

- [ ] Backup restore tested via Neon branch restore
- [ ] Restored database passes `prisma migrate deploy` without errors
- [ ] Restored database passes application health check

### Disaster Recovery Procedure

- [ ] DR runbook documented with step-by-step instructions:
  1. Restore Neon database from PITR or branch restore
  2. Apply any pending migrations
  3. Redeploy on Vercel (promote previous deployment or push fix)
  4. Verify DNS and health check
  5. Verify Vercel Cron jobs resuming
  6. Run smoke tests
- [ ] DR drill executed at least once before go-live
- [ ] DR drill results documented (actual RTO achieved vs target)

### Provider Migration (DS-017 §6)

- [ ] 2-4 hour cutover window procedure documented
- [ ] DNS TTL lowered to 300s before migration
- [ ] Neon export / `pg_restore` commands documented for provider migration
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
- SI-003 §8.2 -- IaC gaps
