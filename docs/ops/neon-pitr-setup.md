# Neon PITR + Prod-Env Backup Setup

Primary DR mechanism for production (see `docs/ops/backup-restore.md` § Backup strategy #1).
Neon PITR ("Instant restore") = roll a branch back to any point inside the history window, via WAL.
Enabling + restoring is a **Neon console** action (GUI, user) — no neon CLI in this repo; the DB is wired
via a Vercel-"Sensitive" `DATABASE_URL` whose value isn't CLI-readable. (Source: neon.com docs, 2026-08.)

## CURRENT STATE + CHOSEN STRATEGY (2026-08-04)
Live console: project is on **Free plan**, region AWS Singapore, PG16, **History retention = 6h** (Free max).
**Decision: stay on Free** (cheapest-first; prod data ~0.1GB). Backup strategy of record:
1. **Neon 6h Instant-restore** — recent-incident recovery. Nothing to configure (already at Free max).
2. **`scripts/backup.sh` run PRIVATELY** (see §4) — daily logical dump for the 24h RPO + history beyond 6h.
3. **On-demand dump before any risky migration.**
⚠️ **PII-safety:** the repo goes public during /ship. NEVER dump prod (customer PII) into GitHub Actions
artifacts (downloadable on public repos). Dump only to a PRIVATE destination (your machine / private bucket).
→ Upgrade to **Launch** (7-day PITR) or **Scale** (30-day) later if volume grows; then use §1–§3 below.

## 1. History-window limit by plan (30-day needs Scale)
| Plan | Max history window |
|------|--------------------|
| Free | 6 hours |
| Launch | up to 7 days |
| **Scale** | up to **30 days** |

→ 30-day PITR requires **Scale**. Launch (7d) already exceeds our 24h RPO; only go Scale if 30 days is wanted.
If on a shorter window, the daily logical `scripts/backup.sh` copy still covers the 24h RPO.

## 2. Enable / set the history window (USER — console)
1. **console.neon.com** → select the project.
2. Project Dashboard → **Settings**.
3. Select **Instant restore**.
4. Use the **slider** to choose how long to keep change history (up to the plan max).
5. Click **Save**.

## 3. How to restore (PITR) — non-destructive
Neon restore rolls the branch back but AUTO-creates a backup branch `{branch}_old_{timestamp}` first, so it's reversible.
1. Open the branch's **Backup & Restore** page.
2. Tab **Restore from history**.
3. Pick the target moment with the **time picker** (or switch to LSN).
4. **Next** → review → **Restore**.
- Time-travel from another branch: tab **From another branch** → uncheck "Restore from latest data (head)" → pick a timestamp.

## 4. Layer B — ON-DEMAND private dump via Docker (chosen for Phase 1)
Right-sized for current scope (0.1GB, non-24/7 machine): NO pg_dump install, NO scheduler. Use the
already-running docker pg16 container to dump Neon prod **on demand — BEFORE a go-live or a big migration**.
Script = `scripts/backup-ondemand.sh`.
⚠️ The dump holds customer PII → keep it PRIVATE (your machine): never commit, never sync to a public place.

**Setup (USER, one-time):** set the Neon prod connection string in your shell env (from your vault):
```bash
export BBVN_PROD_DATABASE_URL="postgresql://…neon…prod…"   # NOT in the repo
```
**Run (before each risky change):**
```bash
./scripts/backup-ondemand.sh            # dumps to ~/bbvn-backups (or pass a dir)
```
Requires Docker running with `bus-booking-postgres-1`. The secret is passed into the container via `-e`
(never as an argv). Recover with `scripts/restore.sh <file.dump>` into a NON-primary target.

### Later (when volume grows) — scheduled daily
If you outgrow on-demand, `scripts/backup-prod.ps1` + a Windows Task Scheduler **At-logon** trigger gives
an automatic once-per-day dump (guard prevents same-day re-dumps). Or just **upgrade Neon** (Launch/Scale)
for native scheduled snapshots. Not needed now.

**Prod-env backup (one-time + on rotation):**
- `vercel env pull .env.prod.backup --environment=production` (gitignored path) → move values into a
  **password manager / secrets vault** → delete the local file. Never commit env values.
- Store the Neon connection string + the 11 secrets (`docs/ops/secrets-rotation.md` inventory) there.

## 5. Verification (USER creates branch → validate)
Get the branch connection string: **Branches → select branch → Connect** (choose role + database).
Run against the **PITR branch only** (HG-A: never the live primary):
```bash
BRANCH_URL="postgresql://…neon-branch…"
DATABASE_URL="$BRANCH_URL" pnpm prisma migrate status        # → "up to date"
psql "$BRANCH_URL" -c 'SELECT COUNT(*), COALESCE(SUM(amount),0) FROM "LedgerEntry";'   # sane
psql "$BRANCH_URL" -c "SELECT tgname FROM pg_trigger WHERE tgrelid='\"LedgerEntry\"'::regclass AND NOT tgisinternal;"  # → ledger_entry_no_update + no_delete
```
On pass → add "Neon PITR branch verified <date>" to `docs/ops/backup-restore.md` Rehearsal Log; P1.16 → DONE.
