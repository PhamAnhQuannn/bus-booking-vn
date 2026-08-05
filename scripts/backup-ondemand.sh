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

# Always wipe the container-side PII dump on exit — even if `docker cp` fails (set -e) partway.
trap 'docker exec "$CONTAINER" rm -f /tmp/bbvn-prod.dump 2>/dev/null || true' EXIT

# Dump inside the container. Pass the secret by NAME (docker inherits the value from this shell's env)
# so the prod URL never appears on the host `docker` argv (visible in `ps`). Inside, pg_dump reads it
# from the container env, not argv either.
docker exec -e BBVN_PROD_DATABASE_URL "$CONTAINER" sh -c \
  'pg_dump "$BBVN_PROD_DATABASE_URL" -F c --no-owner --no-privileges -f /tmp/bbvn-prod.dump'

# Copy out (MSYS_NO_PATHCONV stops Git-Bash mangling the container-side /tmp path on Windows).
MSYS_NO_PATHCONV=1 docker cp "$CONTAINER:/tmp/bbvn-prod.dump" "$OUT"

echo "backup written: $OUT ($(wc -c < "$OUT") bytes)"
echo "restore with: scripts/restore.sh \"$OUT\"  (into a NON-primary target DB)"
