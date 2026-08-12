#!/usr/bin/env bash
#
# Post-deploy smoke test (go-live gate GL-005). Hits the key public surfaces and asserts
# each responds as expected. Exit non-zero on ANY failure so it can gate a deploy / run in CI.
#
# Usage:
#   scripts/smoke-test.sh                       # defaults to https://lenxevn.com
#   scripts/smoke-test.sh https://<preview>.vercel.app
#
# Only hits UNAUTHENTICATED GETs (auth'd flows belong in e2e/). Deliberately does not book
# or mutate anything — safe to run against production after every deploy.
#
set -uo pipefail

BASE="${1:-https://lenxevn.com}"
BASE="${BASE%/}"
FAILED=0

# check <method> <path> <expected-status> [substring-that-must-appear-in-body]
check() {
  local path="$1" expect="$2" needle="${3:-}"
  local url="${BASE}${path}"
  local body status
  body=$(curl -sS -m 20 -o - -w '\n%{http_code}' "$url" 2>/dev/null) || { echo "FAIL  $path  (curl error)"; FAILED=1; return; }
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"
  if [ "$status" != "$expect" ]; then
    echo "FAIL  $path  expected $expect got $status"; FAILED=1; return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$body" | grep -q "$needle"; then
    echo "FAIL  $path  body missing '$needle'"; FAILED=1; return
  fi
  echo "ok    $path  ($status)"
}

echo "Smoke test → $BASE"
echo "-----------------------------------------"

# Liveness — the endpoint UptimeRobot watches.
check /api/health           200 '"status":"ok"'
# Public marketing + catalog pages (must render, not 500).
check /                     200
check /routes               200
# Cached reference endpoint (max-age 86400) — proves the API layer is up.
check /api/geo              200
# Auth entry points render (page GET, no session needed).
check /op/login             200
check /admin/login          200

echo "-----------------------------------------"
if [ "$FAILED" -ne 0 ]; then
  echo "SMOKE TEST FAILED"; exit 1
fi
echo "SMOKE TEST PASSED"
