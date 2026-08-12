#!/usr/bin/env bash
#
# DRILL restore: pull the latest R2 logical dump and load it into a SCRATCH database, timed.
# NEVER point this at prod — DATABASE_URL_BACKUP_TEST must be a scratch Neon branch or throwaway DB.
# See docs/ops/backup-restore.md → Drill Procedure. (Neon PITR is the faster path B; this exercises
# the secondary R2 dump so we know BOTH recovery paths work.)
#
# Required env:
#   DATABASE_URL_BACKUP_TEST   scratch target (NOT prod)
#   R2_S3_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET   (as in backup.sh)
#
set -euo pipefail

: "${DATABASE_URL_BACKUP_TEST:?DATABASE_URL_BACKUP_TEST (scratch target) is required}"
: "${R2_S3_ENDPOINT:?R2_S3_ENDPOINT is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_BACKUP_BUCKET:?R2_BACKUP_BUCKET is required}"

# Guard: refuse obviously-prod targets.
case "$DATABASE_URL_BACKUP_TEST" in
  *lenxevn*|*"$([ -n "${PROD_DB_HOST:-}" ] && echo "$PROD_DB_HOST" || echo __never__)"*)
    echo "ERROR: DATABASE_URL_BACKUP_TEST looks like prod. Refusing." >&2; exit 1;;
esac

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

LATEST=$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/" --endpoint-url "$R2_S3_ENDPOINT" \
  | awk '{print $4}' | grep -E '\.sql\.gz$' | sort | tail -1)
[ -n "$LATEST" ] || { echo "ERROR: no backups found in bucket." >&2; exit 1; }

echo "Restoring $LATEST → scratch DB ..."
START=$(date +%s)
aws s3 cp "s3://${R2_BACKUP_BUCKET}/${LATEST}" - --endpoint-url "$R2_S3_ENDPOINT" \
  | gunzip | psql "$DATABASE_URL_BACKUP_TEST" >/dev/null
END=$(date +%s)

echo "Restore took $((END - START))s (RTO target: 1800s)."
echo "Now run the verify queries in docs/ops/backup-restore.md against DATABASE_URL_BACKUP_TEST,"
echo "record the result in the Drill Log, then drop the scratch branch/DB."
