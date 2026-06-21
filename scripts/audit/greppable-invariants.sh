#!/usr/bin/env bash
# Greppable invariants G1-G6 (KG-14) — CI-runnable, exit nonzero on FAIL.
# Codifies lessons from CLAUDE.md Mistake Log into automated grep checks.
# Works on Ubuntu (CI) and Git Bash (Windows dev).
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

FAILURES=0
WARNINGS=0

# ---------- G1: No operatorId from request body in operator routes ----------
# ADR-008 D8: operatorId comes from JWT claims, never from request body.
check_g1_operator_id_body() {
  echo "--- G1: operatorId from request body ---"
  local hits
  hits=$(grep -rn --include='*.ts' \
    'body\.\(operatorId\|operator_id\)' app/api/op/ \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | grep -v '// I7-exempt:' \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  operatorId read from request body in operator routes:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- G2: No server-component self-fetch ----------
# Mistake Log Issue 002/003: server components must not fetch own API.
# Only checks files that are NOT 'use client' (server components/RSC).
check_g2_self_fetch() {
  echo "--- G2: server-component self-fetch ---"
  local hits=""

  while IFS= read -r match; do
    local file
    file=$(echo "$match" | cut -d: -f1)
    # Skip if file starts with 'use client'
    local firstline
    firstline=$(head -1 "$file" 2>/dev/null || true)
    if echo "$firstline" | grep -q "use client"; then
      continue
    fi
    hits+="$match"$'\n'
  done < <(grep -rn --include='*.ts' --include='*.tsx' \
    -e "fetch.*localhost" -e "fetch.*NEXT_PUBLIC_BASE_URL" \
    app/ \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | grep -v 'node_modules/' \
    | grep -v '.next/' \
    | grep -v "app/api/" \
    | grep -v "// self-fetch-exempt:" \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  Server-component self-fetch detected:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- G3: No JSON payload cron predicates ----------
# Mistake Log Issue 014: cron WHERE predicates must be top-level indexed columns.
check_g3_json_cron() {
  echo "--- G3: JSON payload cron predicates ---"
  local hits
  hits=$(grep -rn --include='*.ts' \
    "payload->>" app/api/cron/ \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  JSON payload predicate in cron route (promote to top-level column):"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- G4: No Math.round/floor in money modules ----------
# Mistake Log Issue 016: currency math must use BigInt.
# Excludes BigInt(Math.round(...)) which is the correct coercion pattern,
# comments, and PSP adapter amount parsing (integer division, not currency math).
check_g4_money_math() {
  echo "--- G4: Math.round/floor in money modules ---"
  local hits
  hits=$(grep -rn --include='*.ts' \
    -e 'Math\.round' -e 'Math\.floor' -e 'Math\.ceil' \
    lib/payouts/ lib/ledger/ lib/payment/ \
    2>/dev/null \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | grep -v '// bigint-exempt:' \
    | grep -v 'BigInt(Math\.' \
    | grep -v ' \* ' \
    | grep -v '^\s*//' \
    | grep -v 'adapters/' \
    | grep -v 'halfEvenRound' \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  Math.round/floor/ceil in money module (use BigInt):"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- G5: No Date.now() in RSC render bodies ----------
# Mistake Log Issue 016: RSC render bodies must be pure.
check_g5_date_now_rsc() {
  echo "--- G5: Date.now()/Math.random() in page components ---"
  local hits
  hits=$(grep -rn --include='*.ts' --include='*.tsx' \
    -e 'Date\.now()' -e 'Math\.random()' -e 'crypto\.randomUUID()' \
    app/**/page.tsx \
    2>/dev/null \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | grep -v '// rsc-exempt:' \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  Non-deterministic call in RSC page component:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- G6: No 'use client' barrel imports (extended) ----------
# Mistake Log Issue 092b: client files must deep-import, not barrel.
check_g6_client_barrel() {
  echo "--- G6: use-client server barrel imports ---"
  local hits=""
  local BARRELS="@/lib/auth @/lib/booking @/lib/payment @/lib/notification @/lib/admin @/lib/onboarding"

  while IFS= read -r f; do
    for barrel in $BARRELS; do
      local barrel_hits
      barrel_hits=$(grep -n "from ['\"]${barrel}['\"]" "$f" 2>/dev/null | grep -v 'import type' || true)
      if [ -n "$barrel_hits" ]; then
        hits+="$f: $barrel_hits"$'\n'
      fi
    done
  done < <(grep -rl --include='*.ts' --include='*.tsx' -m1 "^['\"]use client['\"]" app/ components/ 2>/dev/null || true)

  if [ -n "$hits" ]; then
    echo "FAIL  use-client files importing server-only barrel:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- Run all checks ----------
check_g1_operator_id_body
check_g2_self_fetch
check_g3_json_cron
check_g4_money_math
check_g5_date_now_rsc
check_g6_client_barrel

# ---------- Summary ----------
echo ""
echo "=== Greppable Invariants (G1-G6) ==="
echo "Failures: $FAILURES"
echo "Warnings: $WARNINGS"
exit $((FAILURES > 0 ? 1 : 0))
