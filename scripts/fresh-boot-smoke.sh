#!/usr/bin/env bash
# fresh-boot-smoke.sh — Smoke test for GET /api/trips/search
#
# Asserts:
#   - HTTP 200 response
#   - Body is a JSON array (may be empty)
#   - Cache-Control: no-store header present
#
# Usage:
#   ./scripts/fresh-boot-smoke.sh [BASE_URL]
#
# Example:
#   ./scripts/fresh-boot-smoke.sh http://localhost:3000
#   ./scripts/fresh-boot-smoke.sh https://bbvn.example.com

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

# ---- 0. Apply migrations + seed (AC-8: fresh-boot flow) ----
if [ -z "${DATABASE_URL:-}" ]; then
  echo "FAIL: DATABASE_URL not set — fresh-boot requires DB connection"
  exit 1
fi
echo "Applying migrations..."
pnpm prisma migrate deploy
echo "Seeding database..."
pnpm prisma db seed

# Compute tomorrow's date in YYYY-MM-DD format (works on Linux and macOS)
if date --version 2>/dev/null | grep -q GNU; then
  TOMORROW=$(date -d "+1 day" +%Y-%m-%d)
else
  TOMORROW=$(date -v+1d +%Y-%m-%d)
fi

SEARCH_URL="${BASE_URL}/api/trips/search?origin=H%C3%A0%20N%E1%BB%99i&destination=TP.HCM&date=${TOMORROW}&ticketCount=1"

echo "=== Fresh-boot smoke test ==="
echo "Target: ${SEARCH_URL}"
echo ""

# ---- 1. HTTP status 200 ----
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Accept: application/json" \
  "${SEARCH_URL}")

if [ "${HTTP_STATUS}" != "200" ]; then
  echo "FAIL: Expected HTTP 200, got ${HTTP_STATUS}"
  exit 1
fi
echo "PASS: HTTP 200"

# ---- 2. Body is JSON array ----
BODY=$(curl -s \
  -H "Accept: application/json" \
  "${SEARCH_URL}")

# jq exits non-zero if not valid JSON; type check for array
IS_ARRAY=$(echo "${BODY}" | jq 'if type == "array" then "yes" else "no" end' -r 2>/dev/null || echo "no")

if [ "${IS_ARRAY}" != "yes" ]; then
  echo "FAIL: Response body is not a JSON array"
  echo "Body: ${BODY}"
  exit 1
fi
echo "PASS: Body is JSON array"

# ---- 3. Cache-Control: no-store ----
CACHE_HEADER=$(curl -s -I \
  -H "Accept: application/json" \
  "${SEARCH_URL}" | grep -i "cache-control" | tr -d '\r')

if ! echo "${CACHE_HEADER}" | grep -qi "no-store"; then
  echo "FAIL: Cache-Control header missing 'no-store'"
  echo "Got: ${CACHE_HEADER}"
  exit 1
fi
echo "PASS: Cache-Control: no-store"

# ---- 4. If results present, check field shape ----
RESULT_COUNT=$(echo "${BODY}" | jq 'length')
echo ""
echo "Result count: ${RESULT_COUNT}"

if [ "${RESULT_COUNT}" -gt "0" ]; then
  FIRST=$(echo "${BODY}" | jq '.[0]')
  MISSING_FIELDS=""

  for field in tripId departureAt price availableSeats operatorLegalName routeOrigin routeDestination; do
    VAL=$(echo "${FIRST}" | jq -r --arg f "${field}" '.[$f] // "MISSING"')
    if [ "${VAL}" = "MISSING" ]; then
      MISSING_FIELDS="${MISSING_FIELDS} ${field}"
    fi
  done

  if [ -n "${MISSING_FIELDS}" ]; then
    echo "FAIL: First result missing fields:${MISSING_FIELDS}"
    echo "First result: ${FIRST}"
    exit 1
  fi
  echo "PASS: All 7 contract fields present in first result"
fi

# ---- 5. 400 on invalid params ----
STATUS_400=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE_URL}/api/trips/search?origin=&destination=TP.HCM&date=${TOMORROW}&ticketCount=1")

if [ "${STATUS_400}" != "400" ]; then
  echo "FAIL: Expected HTTP 400 for empty origin, got ${STATUS_400}"
  exit 1
fi
echo "PASS: HTTP 400 for invalid params (empty origin)"

echo ""
echo "=== All smoke tests passed ==="
