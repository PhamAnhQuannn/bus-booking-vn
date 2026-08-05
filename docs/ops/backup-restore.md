# Backup & Restore Runbook

**Status:** ACTIVE (supersedes `docs/qa/gl-003-backup-dr-plan.md`, which was FPT-Cloud-based and stale).
**Infra:** Vercel + Neon Postgres (ap-southeast-1) + Upstash Redis. No FPT Cloud (removed 2026-07-10).
**RPO = 24h · RTO = 1h** (decided 2026-08-04; family-operator scale).

## Backup strategy
**Current plan = Neon FREE → History retention = 6h** (max on Free). Strategy of record:
1. **Primary — Neon Instant-restore (6h window on Free).** Neon retains WAL for point-in-time restore;
   restore = roll a branch back / branch from a timestamp. Recent-incident recovery. Nothing to configure
   (already at Free max). To extend to 7d/30d, upgrade Launch/Scale. **Steps + verify:
   [`docs/ops/neon-pitr-setup.md`](./neon-pitr-setup.md).**
2. **Secondary — private logical dump (`scripts/backup.sh`).** Daily `pg_dump -F c` to a **PRIVATE**
   destination (your machine / private bucket) — satisfies the 24h RPO + history beyond the 6h window.
   ⚠️ NEVER dump prod PII into public-CI artifacts (repo goes public during /ship). Scheduling snippet +
   PII-safety in `neon-pitr-setup.md` §4. Also run on-demand before any risky migration.

## Restore procedure (`scripts/restore.sh`)
1. Create/choose a TARGET database (a Neon branch, or a fresh DB — NEVER the live primary).
2. `CREATE EXTENSION unaccent; CREATE EXTENSION pg_trgm;` on the target (script does this).
3. `pg_restore --no-owner --no-privileges` the archive.
4. **Rebuild `trip_route_unaccent_idx`** (script does this — see caveat below).
5. Verify: `SELECT COUNT(*),SUM(amount) FROM "LedgerEntry";` matches the source checkpoint;
   `pnpm prisma migrate status` = "up to date"; `GET /api/health` non-500.

### Known caveat (found in rehearsal)
`unaccent_immutable(text)` (migration `20260517221513_init`) calls `unaccent()` unqualified. pg_restore
runs with an empty `search_path`, so the GIN search index `trip_route_unaccent_idx` fails to create —
a single **non-fatal, ignored** error (`function unaccent(unknown, text) does not exist`). All DATA and
every other object restore fully. Remediation: `restore.sh` rebuilds that index explicitly after restore.
(No FATAL errors; data integrity unaffected.)

## Local rehearsal (docker — host has no pg_dump/psql)
```bash
docker exec bus-booking-postgres-1 sh -c 'pg_dump -U bbvn -d bbvn_dev -F c -f /tmp/d.dump'
docker exec bus-booking-postgres-1 psql -U bbvn -d postgres -c 'CREATE DATABASE bbvn_restore_test;'
docker exec bus-booking-postgres-1 psql -U bbvn -d bbvn_restore_test -c 'CREATE EXTENSION unaccent; CREATE EXTENSION pg_trgm;'
docker exec bus-booking-postgres-1 sh -c 'pg_restore -U bbvn -d bbvn_restore_test /tmp/d.dump'   # 1 ignored unaccent error expected
DATABASE_URL=postgresql://bbvn:bbvn_dev_password@localhost:5432/bbvn_restore_test pnpm prisma migrate status
docker exec bus-booking-postgres-1 psql -U bbvn -d postgres -c 'DROP DATABASE bbvn_restore_test;'
```

## Rehearsal Log
### 2026-08-04 — local rehearsal (docker `bus-booking-postgres-1`, source `bbvn_dev`)
| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Dump created | file >0 bytes | 144,221 bytes | ✅ |
| pg_restore FATAL | 0 | 0 (1 ignored unaccent error, non-fatal) | ✅ |
| Ledger count/sum parity | source == restore | `13 \| 649250` == `13 \| 649250` | ✅ |
| Immutability triggers survive | no_update + no_delete present | both present | ✅ |
| UPDATE blocked | error `append-only` | `ERROR: LedgerEntry is append-only: UPDATE is not permitted` | ✅ |
| migrate status on restored DB | up to date | "Database schema is up to date!" (80 migrations) | ✅ |
| Measured restore time (RTO) | ≤ 1h | ~2s (dev DB; scales well under 1h for prod) | ✅ |
| Cleanup | throwaway dropped + dump removed | DB count 0, dump removed | ✅ |

**RESULT: PASS** (1 documented non-fatal caveat: search index rebuild, automated in `restore.sh`).
