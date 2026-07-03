# GL-003: Backup & Disaster Recovery Plan

**Status:** READY
**Date:** 2026-07-03
**References:** SI-006, ADR-020

---

## 1. Recovery Objectives

| Objective | Target | Notes |
|-----------|--------|-------|
| **RPO** (Recovery Point Objective) | 6 hours | Maximum acceptable data loss window |
| **RTO** (Recovery Time Objective) | 2 hours | Maximum acceptable downtime |

## 2. Backup Strategy

### 2.1 PostgreSQL (Primary: Neon)

Neon provides built-in PITR (Point-in-Time Recovery):
- **Free tier:** 7-day retention
- **Paid tier:** 30-day retention
- Recovery: restore to any point within retention window via Neon console

### 2.2 PostgreSQL (Alternative: FPT Cloud / Self-hosted)

| Parameter | Value |
|-----------|-------|
| Method | `pg_dump` to FPT Object Storage |
| Frequency | Every 6 hours (RPO-aligned) |
| Retention | 30 days minimum |
| Encryption | At-rest via FPT Object Storage |

```bash
# Automated backup (cron)
0 */6 * * * pg_dump -Fc -h $DB_HOST -U $DB_USER $DB_NAME | \
  aws s3 cp - s3://busbooking-backups/$(date +%Y%m%d-%H%M).dump \
  --endpoint-url $FPT_S3_ENDPOINT

# Verify backup integrity
pg_restore --list latest.dump > /dev/null 2>&1 && echo "OK" || echo "CORRUPT"
```

### 2.3 Redis

Redis is used for rate-limiting counters and OTP proof jti tracking only. No persistent business data.
- **Strategy:** No backup needed — data is ephemeral and self-heals on restart
- **Impact of loss:** Rate-limit counters reset (brief window of unenforced limits), expired OTP proofs could be replayed within their 5-min TTL

### 2.4 Application Code

| Source | Backup |
|--------|--------|
| Git repository | GitHub (primary), local clones |
| Docker images | GHCR (at least 3 previous versions retained) |
| Environment variables | Documented in secure location (NOT in Git) |

## 3. Backup Verification Checklist

- [ ] Restore backup to fresh database instance
- [ ] `prisma migrate deploy` completes without errors
- [ ] Application health check passes (`GET /api/health` → 200)
- [ ] Backup file integrity verified (checksums match)
- [ ] Backup encryption at rest confirmed
- [ ] LedgerEntry immutability trigger survives restore
- [ ] LedgerEntry row count and sum match pre-backup values

## 4. Disaster Recovery Procedure

### Step-by-step runbook

```
1. ASSESS
   - Determine scope: full outage vs partial degradation
   - Check Neon status page / FPT Cloud status
   - Identify root cause if possible

2. PROVISION (if infrastructure lost)
   - Neon: create new project, restore from PITR
   - FPT Cloud: provision new VPS (2 vCPU, 4GB RAM minimum)
   - Update connection strings in environment

3. RESTORE DATABASE
   # Neon path:
   - Use Neon console to restore to latest safe point
   
   # FPT Cloud path:
   pg_restore -Fc -h $NEW_HOST -U $DB_USER -d $DB_NAME latest.dump
   prisma migrate deploy

4. DEPLOY APPLICATION
   docker pull ghcr.io/<org>/bus-booking:latest
   docker compose up -d

5. UPDATE DNS
   - Lower TTL to 300s (if not already done)
   - Point A/CNAME record to new instance
   - Wait for propagation (5 min with 300s TTL)

6. VERIFY
   curl -f https://<prod-url>/api/health
   pnpm run smoke:prod
   # Verify cron jobs: check JobRunLog for runs after restore

7. MONITOR
   - Watch error rates for 30 minutes
   - Verify all cron jobs fire on schedule
   - Check operator portal loads correctly
```

### Failover path

If primary infrastructure (FPT Cloud) is unavailable:
- Temporary failover to Vercel `sin1` region
- Deploy Next.js app to Vercel, connect to Neon database
- DNS switch to Vercel-assigned domain
- Monitor until primary infrastructure restored

## 5. Provider Migration (DS-017 §6)

| Step | Duration |
|------|----------|
| Lower DNS TTL to 300s | 24h before migration |
| `pg_dump` from source provider | ~15 min (depends on DB size) |
| `pg_restore` to destination | ~15 min |
| `prisma migrate deploy` on destination | ~2 min |
| Deploy app to new infrastructure | ~10 min |
| DNS cutover | ~5 min propagation |
| Health check + smoke test | ~10 min |
| **Total cutover window** | **2-4 hours** |

## 6. Append-Only Ledger Protection

The `LedgerEntry` table has a database-level immutability trigger (`BEFORE UPDATE OR DELETE → RAISE EXCEPTION`). Verification after any restore:

```sql
-- Verify trigger exists
SELECT tgname FROM pg_trigger WHERE tgrelid = '"LedgerEntry"'::regclass;
-- Expected: ledger_entry_no_update, ledger_entry_no_delete

-- Verify row count matches
SELECT COUNT(*) FROM "LedgerEntry";

-- Verify sum integrity (should match pre-backup checkpoint)
SELECT SUM("amount") FROM "LedgerEntry";
```

## 7. DR Drill Checklist

- [ ] DR drill executed on staging environment
- [ ] Actual RTO measured: ____ minutes (target: < 120 min)
- [ ] Database restored successfully from backup
- [ ] All migrations applied without errors
- [ ] Health check passed post-restore
- [ ] Smoke test passed post-restore
- [ ] Cron jobs resumed correctly
- [ ] LedgerEntry immutability trigger verified
- [ ] Drill results documented with date and participants

---

## Verdict Criteria

**PASS** when:
- RPO and RTO defined (this document)
- Backup restore tested on a fresh instance
- DR drill executed at least once
- LedgerEntry integrity verified post-restore
- Measured RTO within 2-hour target
