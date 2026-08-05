#!/usr/bin/env bash
# Restore a pg_dump archive produced by scripts/backup.sh into a TARGET database.
# Verified by the 2026-08-04 rehearsal (docs/ops/backup-restore.md → Rehearsal Log).
#
# Usage:
#   TARGET_URL="postgresql://user:pass@host/db_restore" ./scripts/restore.sh path/to/bbvn.dump
# Local dev (via docker, host has no pg_restore):
#   see docs/ops/backup-restore.md § Local rehearsal.
set -euo pipefail

DUMP="${1:?usage: restore.sh <dump-file>}"
: "${TARGET_URL:?set TARGET_URL — the DB to restore INTO (never the live primary)}"

# CRITICAL (rehearsal finding 2026-08-04): the search index trip_route_unaccent_idx uses
# unaccent_immutable(), which calls unaccent() unqualified. pg_restore runs with an empty
# search_path, so that ONE index fails to create ("function unaccent(unknown, text) does not
# exist") and is skipped — a non-fatal, ignored error. DATA + all other objects restore fully.
# Pre-creating the extensions is required; the index is rebuilt explicitly after restore.
psql "$TARGET_URL" -c 'CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;'

pg_restore "$DUMP" --dbname "$TARGET_URL" --no-owner --no-privileges || true  # 1 ignored unaccent error is expected

# Rebuild the one search index that the empty-search_path restore skips.
psql "$TARGET_URL" -c 'CREATE INDEX IF NOT EXISTS trip_route_unaccent_idx ON "Route" USING GIN (unaccent_immutable(lower(origin)) gin_trgm_ops, unaccent_immutable(lower(destination)) gin_trgm_ops);' || true

echo "restore complete. Verify: SELECT COUNT(*),SUM(amount) FROM \"LedgerEntry\"; and prisma migrate status."
