---
last-updated: 2026-08-11
last-drill: none
drill-cadence: quarterly
db-host: neon
rpo: 1h
rto: 30min
status: untested
---

# Backup & Restore — Postgres (Neon) · Bus-Booking (lenxevn.com)

Closes go-live gate **GL-003**. An untested backup is not a backup — the drill (below) is the point.
`status: untested` until the first drill (§Drill) passes; do not treat this as GL-003-complete before then.

## Data Tiers

| Tier | Tables | RPO (max loss) | RTO (max downtime) | Backup |
|------|--------|----------------|--------------------|--------|
| **Critical** — real money/records, unrecreatable | `Booking`, `PaymentEvent`, `LedgerEntry` (append-only), `Payout`, `PayoutAccount`, `Customer`, `Operator`, `Hold`, `StoredObject` (pointers) | **1h** | **30min** | Neon PITR (continuous) + weekly logical dump |
| **Important** — catalog, recreatable via console but painful | `Route`, `Trip`, `Bus`, `RecurringTripTemplate`, `FeeConfig`, `AdminUser`, `OperatorUser` | 24h | 2h | Neon PITR + weekly dump |
| **Regenerable** — drop-safe | `Session`, `OtpAttempt`, `JobRunLog`, `NotificationLog` (outbox, replayable) | none | n/a | none needed |

Note: object bytes (ticket PDFs, KYB docs) live in **Cloudflare R2**, not Postgres — only the `StoredObject`
key/metadata is in the DB. R2 has its own durability; a Postgres restore re-points to existing R2 objects by key.

## Backup Mechanism

**Primary — Neon PITR (point-in-time recovery), continuous, built-in.**
- Neon streams WAL continuously; any instant in the retention window is restorable to a new branch.
- Retention depends on plan (Free ~24h, Launch/Scale 7d+). **Confirm the retention on the current Neon plan
  meets RPO=1h with margin** — if on Free, a 7-day-retention paid tier is the GL-003 requirement.
- No app code needed; this is the recovery-of-record.

**Secondary (defense in depth) — weekly logical `pg_dump` to Cloudflare R2.**
- `scripts/backup.sh` → `pg_dump` (via `DIRECT_URL`, non-pooled) → gzip → upload to R2 bucket `bus-booking-backups`.
- Scheduled by **GitHub Actions** (`.github/workflows/backup.yml`), NOT Vercel Cron — pg_dump needs the client
  binary + can exceed the 300s function budget on a growing DB; a GH Actions runner has `postgresql-client`.
- Retention: 90 days (script prunes older). Encrypted in transit (TLS) + at rest (R2 SSE).
- Blast-radius isolation: R2 is a different provider/host than Neon — a Neon-side incident can't take the dumps.

## Restore Procedures

### A. Neon PITR (recommended, fastest)
1. Neon dashboard → project → **Branches → Restore / "Restore to timestamp"**.
2. Pick the timestamp just BEFORE the incident.
3. Neon creates a branch at that point-in-time.
4. Update Vercel Production `DATABASE_URL` + `DIRECT_URL` to the new branch's pooled/direct URLs.
5. Redeploy prod; run `scripts/smoke-test.sh https://lenxevn.com` (GL-005) before announcing recovery.

### B. Logical dump restore (fallback — R2 dump)
1. `aws s3 cp s3://bus-booking-backups/<file>.sql.gz . --endpoint-url "$R2_S3_ENDPOINT"`
2. `gunzip <file>.sql.gz`
3. `psql "$RESTORE_TARGET_URL" < <file>.sql`   # scratch/new DB, never prod directly
4. Run the drill verify queries (below); update `DATABASE_URL`/`DIRECT_URL`, redeploy.

### C. Single-table restore (e.g. accidental data loss in one table)
1. Restore a full snapshot to a scratch Neon branch (A) or scratch DB (B).
2. `pg_dump --table='"<Name>"' "$SCRATCH_URL" > table.sql`
3. Review, then `psql "$PROD_DIRECT_URL" < table.sql`.
   - ⚠️ NEVER restore over `LedgerEntry` — it is append-only (DB triggers block UPDATE/DELETE). Recover ledger
     rows only by inserting missing entries, never by overwriting.

## Drill Procedure (Quarterly — required for GL-003 sign-off)

Goal: prove the backup-of-record restores within RTO and loses ≤ RPO.

1. Create a scratch Neon branch (PITR) OR provision `DATABASE_URL_BACKUP_TEST` (separate scratch DB).
2. Restore latest backup to it (PITR restore, or `scripts/restore.sh` for the R2 dump path).
3. **Time it** — from start to first successful `psql` connect. Must be < RTO (30min).
4. Run verify queries:

```sql
-- Row-count parity (expect prod_count minus rows written in the RPO window)
SELECT 'Booking'      AS t, COUNT(*) FROM "Booking"
UNION ALL SELECT 'PaymentEvent', COUNT(*) FROM "PaymentEvent"
UNION ALL SELECT 'LedgerEntry',  COUNT(*) FROM "LedgerEntry"
UNION ALL SELECT 'Payout',       COUNT(*) FROM "Payout"
UNION ALL SELECT 'Customer',     COUNT(*) FROM "Customer"
UNION ALL SELECT 'Operator',     COUNT(*) FROM "Operator";

-- Recency: newest rows present (should be within the RPO window of the snapshot)
SELECT MAX("createdAt") FROM "Booking";
SELECT MAX("createdAt") FROM "LedgerEntry";

-- FK integrity: no orphan PaymentEvent → Booking
SELECT COUNT(*) FROM "PaymentEvent" pe
  LEFT JOIN "Booking" b ON pe."bookingId" = b.id
  WHERE pe."bookingId" IS NOT NULL AND b.id IS NULL;

-- Ledger immutability triggers present after restore
SELECT tgname FROM pg_trigger WHERE tgname IN ('ledger_entry_no_update','ledger_entry_no_delete');
```

5. Run one real app query (e.g. `getActiveRoutes` equivalent — an upcoming bookable trip exists).
6. Drop the scratch branch/DB.
7. Append a row to the Drill Log.

**PASS** = restore < 30min, row counts within the 1h RPO window, FK check = 0 orphans, both ledger triggers present.
**FAIL** = anything else → file P1, fix pipeline before any launch/traffic event.

## Drill Log

| Date | Source | Restore time | Row-count delta | Verdict | Notes |
|------|--------|--------------|-----------------|---------|-------|
| _pending_ | — | — | — | — | First drill not yet run. GL-003 stays OPEN until one PASS row exists. |

## Out of Scope
- Cross-region replication (single-region `sin1` by design; PDPL residency).
- R2 object backup (R2 provides durability; only DB pointers are backed up here).
- Customer self-serve restore (admin-only).

## Auto-chain
- RPO/RTO feed the NFR doc.
- Drill FAIL → risk register P1.
- Any migration touching a Critical table → schedule a drill within 7 days.
- Restore is a remediation step referenced by the go-live runbook (`docs/ops/go-live-runbook.md`).
