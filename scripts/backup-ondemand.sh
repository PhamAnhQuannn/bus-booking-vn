#!/usr/bin/env bash
# On-demand PRIVATE backup of the Neon PRODUCTION DB via the already-running docker pg16 container.
# No pg_dump install, no scheduler — right-sized for Phase 1. RUN THIS BEFORE a go-live or a big migration.
#
# The dump lands in a PRIVATE folder on your machine. NEVER commit it, never sync it to a public place
# (it contains customer PII). Delete old copies you don't need.
#
# Usage:
#   BBVN_PROD_DATABASE_URL="postgresql://…neon…prod…" ./scripts/backup-ondemand.sh [out_dir]
# Requires: Docker running with the `bus-booking-postgres-1` container (pg16). Secret is passed into the
# container via `-e` (env), never as a command-line arg.
set -euo pipefail

: "${BBVN_PROD_DATABASE_URL:?set BBVN_PROD_DATABASE_URL to the Neon prod connection string (from your vault)}"
OUT_DIR="${1:-$HOME/bbvn-backups}"
CONTAINER=bus-booking-postgres-1
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/bbvn-prod-$STAMP.dump"

mkdir -p "$OUT_DIR"

# Dump inside the container (URL in env, not argv); custom format; portable across roles.
docker exec -e PGURL="$BBVN_PROD_DATABASE_URL" "$CONTAINER" sh -c \
  'pg_dump "$PGURL" -F c --no-owner --no-privileges -f /tmp/bbvn-prod.dump'

# Copy out (MSYS_NO_PATHCONV stops Git-Bash mangling the container-side /tmp path on Windows).
MSYS_NO_PATHCONV=1 docker cp "$CONTAINER:/tmp/bbvn-prod.dump" "$OUT"
docker exec "$CONTAINER" rm -f /tmp/bbvn-prod.dump

echo "backup written: $OUT ($(wc -c < "$OUT") bytes)"
echo "restore with: scripts/restore.sh \"$OUT\"  (into a NON-primary target DB)"
