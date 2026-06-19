> ← [Previous](../23-deployment/) | [Index](../README.md) | [Next →](../25-testing/)

## 24. Disaster Recovery & Rollback

### 24.1 Database Backups

- **Automated daily backups** (managed by the database provider)
- **Point-in-time recovery** (restore to any second within the retention window)
- **Tested**: Periodically restore a backup to a staging database and verify it works

### 24.2 Migration Safety

Database migrations (schema changes) are the highest-risk deployments. Rules:
- Every migration is **forward-only** (no `DOWN` migration that could lose data)
- Destructive changes (drop column) are **two-phase**: Phase A removes all code references; Phase B (separate deploy) drops the column
- Non-partial indexes declared in BOTH `schema.prisma` AND the SQL migration (Prisma and DB must agree)
- Test every migration against a copy of production data before deploying

### 24.3 Rollback Plan

If a deployment introduces a critical bug:
1. **Immediate**: Vercel instant rollback to previous deployment (< 30 seconds)
2. **If migration ran**: Forward-fix (new migration that undoes the change) — never edit a committed migration
3. **Feature flag**: If the bug is in a flagged feature, flip the flag to disable

### 24.4 DB-Enforced Immutability as Safety Net

The ledger and audit log tables are append-only at the database level. Even a catastrophic application bug that somehow issues `UPDATE` or `DELETE` on these tables will be rejected by PostgreSQL. This is the last line of defense for financial integrity.
