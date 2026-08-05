#!/usr/bin/env bash
# Logical backup of the Bus-Booking Postgres DB (supplements Neon's built-in PITR).
# Prod primary DR = Neon PITR (automatic, 30-day retention). This script produces a
# portable pg_dump custom-format archive for off-Neon copies + restore rehearsals.
#
# Usage:
#   DATABASE_URL="postgresql://user:pass@host/db" ./scripts/backup.sh [out_dir]
# Local dev (via docker, host has no pg_dump):
#   docker exec bus-booking-postgres-1 sh -c 'pg_dump -U bbvn -d bbvn_dev -F c -f /tmp/bbvn.dump'
#   docker cp bus-booking-postgres-1:/tmp/bbvn.dump ./backups/
set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/bbvn-$STAMP.dump"

: "${DATABASE_URL:?set DATABASE_URL (or use the docker exec form for local dev — see header)}"

# -F c = custom format (compressed, selective restore). --no-owner/--no-privileges keep it
# portable across roles (Neon role != local bbvn role).
# NOTE: passing the conninfo URI as an argv exposes the password in `ps`. Acceptable for a local,
# single-user run; for a hardened setup use discrete PGHOST/PGUSER/PGPASSWORD env (or a service file),
# or the container form in scripts/backup-ondemand.sh which passes the secret via `-e` by name.
pg_dump "$DATABASE_URL" -F c --no-owner --no-privileges -f "$OUT"
echo "backup written: $OUT ($(wc -c < "$OUT") bytes)"

# RPO = 24h: schedule this daily to supplement Neon PITR with an off-Neon copy. Neon PITR alone gives
# sub-minute RPO within its retention window.
# ⚠️ PII: the dump holds customer data. Write it ONLY to a PRIVATE destination (your machine / private
# bucket). NEVER to a GitHub Actions artifact — the repo goes public during /ship and artifacts are
# downloadable on public repos.
