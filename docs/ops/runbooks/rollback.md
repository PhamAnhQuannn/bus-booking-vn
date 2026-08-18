# Rollback Runbook

**Status:** ACTIVE (reconciles `docs/qa/gl-004-rollback-plan.md`; the FPT-Cloud/GHCR Docker-fallback
path in gl-004 is DROPPED — infra is Vercel + Neon only since 2026-07-10).
**Primary mechanism:** Vercel "Promote previous deployment" — **< 5 minutes**, no rebuild.

## Rollback triggers (any one → roll back)
- `GET /api/ping` (no-DB liveness) non-200 for **2 consecutive minutes** post-deploy. (If `/api/ping`
  is 200 but `/api/health` 503, it's a DB/Neon dependency issue — e.g. Neon compute-quota suspend —
  NOT a bad deploy: investigate the DB, do not promote-previous.)
- 5xx rate **> 5%** in the first 10 minutes after a deploy.
- A cron `JobRunLog` row shows `status='failed'` on a money-path job (process-payouts / close-sales)
  attributable to the deploy.
- Data-integrity alarm (ledger sum mismatch, payout double-settle).

## Code rollback (default)
1. Vercel dashboard → project `bus-booking-vn` → Deployments → pick last known-good Production deploy →
   **Promote to Production**. Live in < 5 min (serves the previous build; no migration change).
2. Confirm `GET /api/health` 200 + 5xx rate normal.
3. Announce in the ops channel; note the bad deploy SHA.

## Migrations — FORWARD-ONLY (ADR-017)
Migrations have **no DOWN**. A bad migration is NOT rolled back by reverting the DB.
- If the bad deploy shipped a migration: **promote-previous restores the CODE**, but the schema stays
  forward. Ship a **forward-fix migration** to correct the schema. Never hand-edit a committed migration.
- **Two-phase destructive change (ADR-017 D2):** Phase A deploy removes all code references to a
  column/table (column still present); Phase B (a later deploy) drops it. Rolling back Phase B code is
  safe because Phase A already removed the references. Never combine "drop column" with "code that stops
  using it" in one deploy.

## Data restore (last resort — see backup-restore.md)
Only if data is corrupted, not merely a bad code deploy: restore from Neon PITR (branch at a pre-incident
timestamp) per `docs/ops/backup-restore.md`. RTO target 1h.

## Decision authority
Rollback may be triggered by the on-call operator (family op: the primary maintainer) without further
sign-off when a trigger fires. Post-incident: write a short note in `docs/ops/` (what/when/why/SHA).

## Post-rollback verification
- `GET /api/health` 200.
- One operator login + one trip search return 200.
- Next scheduled cron writes a `status='success'` `JobRunLog` row.
- (optional) `pnpm smoke:prod` read-only profile green.
