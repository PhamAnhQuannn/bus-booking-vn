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

# --- Safety rail: refuse to restore over a non-throwaway target ---------------------------------
# Restore is DESTRUCTIVE. A mistyped prod TARGET_URL would overwrite prod. Require the target DB name
# to look like a throwaway (*_restore / *_test), else demand explicit acknowledgement.
TARGET_DB="$(printf '%s' "$TARGET_URL" | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#')"
if ! printf '%s' "$TARGET_DB" | grep -qiE '(_restore|_test)$'; then
  if [ "${I_UNDERSTAND_TARGET:-}" != "1" ]; then
    echo "REFUSING: target DB '$TARGET_DB' is not a *_restore/*_test throwaway." >&2
    echo "Restore is destructive. Re-run with I_UNDERSTAND_TARGET=1 only if this is intentional." >&2
    exit 1
  fi
  echo "WARNING: restoring into non-throwaway target '$TARGET_DB' (I_UNDERSTAND_TARGET=1)." >&2
fi

# CRITICAL (rehearsal finding 2026-08-04): the search index trip_route_unaccent_idx uses
# unaccent_immutable(), which calls unaccent() unqualified. pg_restore runs with an empty
# search_path, so that ONE index fails to create ("function unaccent(unknown, text) does not
# exist") and is skipped — a non-fatal, ignored error. DATA + all other objects restore fully.
# Pre-creating the extensions is required; the index is rebuilt explicitly after restore.
psql "$TARGET_URL" -c 'CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;'

# Run pg_restore capturing stderr. Tolerate ONLY the known-benign unaccent-index error; FAIL on any
# other error (corrupt archive, unreachable target, auth/permission, disk-full) — never silently.
set +e
restore_err="$(pg_restore "$DUMP" --dbname "$TARGET_URL" --no-owner --no-privileges 2>&1)"
set -e
unexpected="$(printf '%s\n' "$restore_err" | grep -iE 'error|fatal' | grep -viE 'unaccent|errors ignored on restore' || true)"
if [ -n "$unexpected" ]; then
  echo "restore FAILED — unexpected errors:" >&2
  printf '%s\n' "$restore_err" >&2
  exit 1
fi
[ -n "$restore_err" ] && printf '%s\n' "$restore_err"  # surface the ignored-unaccent note

# Rebuild the one search index that the empty-search_path restore skips. Let a real failure propagate.
psql "$TARGET_URL" -c 'CREATE INDEX IF NOT EXISTS trip_route_unaccent_idx ON "Route" USING GIN (unaccent_immutable(lower(origin)) gin_trgm_ops, unaccent_immutable(lower(destination)) gin_trgm_ops);'

echo "restore complete. Verify: SELECT COUNT(*),SUM(amount) FROM \"LedgerEntry\"; and prisma migrate status."
