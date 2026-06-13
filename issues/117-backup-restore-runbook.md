---
depends-on: []
type: DOCS
wave: 0.5
spec: []
---

## Parent PRD

`issues/prd.md` — operational readiness gap identified by grill-me self-assessment.
Addresses NFR-021 (99.5% uptime) and NFR-008 (RPO/RTO).

## What to build

No backup strategy, restore procedure, or RPO test exists. Vercel Postgres (Neon) provides
automatic daily snapshots on paid tiers, but no runbook documents how to restore from them.
Forward-fix-only migration policy means a bad schema migration requires a manual forward
migration — no `down.sql` to roll back.

### Deliverables

1. **`docs/ops/backup-restore.md`** — runbook covering:
   - Vercel Postgres snapshot schedule and retention
   - Manual `pg_dump` script for on-demand backup (pre-migration, pre-deploy)
   - Restore-from-snapshot procedure (Neon dashboard or CLI)
   - Restore-from-pg_dump procedure
   - Point-in-time recovery (PITR) if available on plan tier
   - RPO target: 24h (daily snapshot) or 15min (PITR)
   - RTO target: 1h (manual restore) — must test this
2. **Pre-migration backup step** — add a reminder/script to run `pg_dump` before every
   `prisma migrate deploy` in production.
3. **Test restore** — document a tested restore on staging to validate the procedure.

## Acceptance criteria

- [ ] `docs/ops/backup-restore.md` exists with complete restore procedure.
- [ ] RPO and RTO documented with achievable targets.
- [ ] At least one tested restore documented (date + result).
- [ ] NFR-021 status updated from `proposed` to `in-progress`.

## Blocked by

- none

## Files

- New: `docs/ops/backup-restore.md`
- Update: `docs/nfr.md` (NFR-021, NFR-008 status)

## Severity

LAUNCH — no documented recovery procedure for data loss.
