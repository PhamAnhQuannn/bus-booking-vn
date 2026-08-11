#!/usr/bin/env bash
#
# Weekly logical backup: pg_dump the Neon Postgres → gzip → Cloudflare R2.
# Secondary backup (Neon PITR is primary). Run from GitHub Actions (has postgresql-client),
# NOT Vercel Cron (no pg_dump binary + 300s function cap). See docs/ops/backup-restore.md.
#
# Required env (GitHub Actions secrets):
#   PG_DUMP_URL         Neon DIRECT_URL (non-pooled — pg_dump over PgBouncer is unreliable)
#   R2_S3_ENDPOINT      https://<account>.r2.cloudflarestorage.com
#   R2_ACCESS_KEY_ID    R2 token access key   (maps to AWS_ACCESS_KEY_ID)
#   R2_SECRET_ACCESS_KEY R2 token secret       (maps to AWS_SECRET_ACCESS_KEY)
#   R2_BACKUP_BUCKET    e.g. bus-booking-backups
#
set -euo pipefail

: "${PG_DUMP_URL:?PG_DUMP_URL (Neon DIRECT_URL) is required}"
: "${R2_S3_ENDPOINT:?R2_S3_ENDPOINT is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_BACKUP_BUCKET:?R2_BACKUP_BUCKET is required}"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"   # R2 ignores region but the CLI wants one

TIMESTAMP=$(date -u +%Y%m%d-%H%M)
DUMP_FILE="$(mktemp -d)/busbooking-${TIMESTAMP}.sql.gz"

echo "pg_dump → ${DUMP_FILE} ..."
# --no-owner/--no-acl: restore into any role. Plain format so a plain psql can restore it.
pg_dump "$PG_DUMP_URL" --no-owner --no-acl --format=plain | gzip > "$DUMP_FILE"

echo "upload → s3://${R2_BACKUP_BUCKET}/${TIMESTAMP}.sql.gz ..."
aws s3 cp "$DUMP_FILE" "s3://${R2_BACKUP_BUCKET}/${TIMESTAMP}.sql.gz" \
  --endpoint-url "$R2_S3_ENDPOINT"

rm -f "$DUMP_FILE"

# Prune dumps older than 90 days.
CUTOFF=$(date -u -d '90 days ago' +%Y%m%d || date -u -v-90d +%Y%m%d)
aws s3 ls "s3://${R2_BACKUP_BUCKET}/" --endpoint-url "$R2_S3_ENDPOINT" \
  | awk '{print $4}' | grep -E '\.sql\.gz$' | while read -r key; do
    keydate="${key%%-*}"           # YYYYMMDD prefix
    if [ "$keydate" -lt "$CUTOFF" ] 2>/dev/null; then
      echo "prune old backup: $key"
      aws s3 rm "s3://${R2_BACKUP_BUCKET}/${key}" --endpoint-url "$R2_S3_ENDPOINT"
    fi
  done

echo "Backup complete: ${TIMESTAMP}"
