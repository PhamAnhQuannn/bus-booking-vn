#!/usr/bin/env bash
# Data-leak pattern audit — CI-runnable, exit nonzero on any FAIL.
# Works on Ubuntu (CI) and Git Bash (Windows dev).
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

FAILURES=0
WARNINGS=0

# ---------- A1: tempPasswordPlain leak ----------
check_temp_password_plain() {
  echo "--- A1: tempPasswordPlain leak ---"
  local hits
  hits=$(grep -rn --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=.next \
    'tempPasswordPlain' . \
    | grep -v 'prisma/migrations/' \
    | grep -v 'lib/admin/createOperatorAccount\.ts' \
    | grep -v 'lib/admin/getOperatorDetail\.ts' \
    | grep -v 'app/admin/(console)/operators/\[id\]/CreateAccountAction\.tsx' \
    | grep -v 'app/api/admin/operators/\[id\]/create-account/route\.ts' \
    | grep -v 'app/api/op/auth/password/change/route\.ts' \
    | grep -v 'app/api/op/auth/forgot-password/reset/route\.ts' \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | grep -v 'e2e/' \
    | grep -v 'AGENTS\.md\|CLAUDE\.md' \
    | grep -v '\.md:' \
    | grep -v 'scripts/audit/' \
    | grep -v 'prisma/schema\.prisma' \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  tempPasswordPlain found outside allowlist:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- A2: accessToken in response body ----------
check_access_token_in_body() {
  echo "--- A2: accessToken in NextResponse.json ---"
  local hits
  hits=$(grep -rn --include='*.ts' --exclude-dir=node_modules --exclude-dir=.next \
    'accessToken' app/api/ \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | grep 'NextResponse\.json' \
    | grep -v 'app/api/auth/login/route\.ts' \
    | grep -v 'app/api/op/auth/password/change/route\.ts' \
    | grep -v 'app/api/auth/refresh/route\.ts' \
    | grep -v 'app/api/op/auth/refresh/route\.ts' \
    | grep -v 'app/api/auth/register/route\.ts' \
    | grep -v 'app/api/admin/auth/login/route\.ts' \
    | grep -v 'app/api/admin/auth/refresh/route\.ts' \
    | grep -v 'app/api/admin/auth/totp/confirm/route\.ts' \
    | grep -v 'app/api/admin/auth/totp/verify/route\.ts' \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  accessToken returned in unexpected response body:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- A3: 'use client' importing server barrel ----------
check_client_server_barrel() {
  echo "--- A3: use-client importing server barrel ---"
  local hits=""

  # Find all 'use client' files, then check for server barrel imports
  while IFS= read -r f; do
    local barrel_imports
    barrel_imports=$(grep -n "from ['\"]@/lib/auth['\"]" "$f" 2>/dev/null | grep -v 'import type' || true)
    barrel_imports+=$(grep -n "from ['\"]@/lib/booking['\"]" "$f" 2>/dev/null | grep -v 'import type' || true)
    barrel_imports+=$(grep -n "from ['\"]@/lib/payment['\"]" "$f" 2>/dev/null | grep -v 'import type' || true)
    if [ -n "$barrel_imports" ]; then
      hits+="$f:"$'\n'"$barrel_imports"$'\n'
    fi
  done < <(grep -rl --include='*.ts' --include='*.tsx' -m1 "^['\"]use client['\"]" . 2>/dev/null || true)

  if [ -n "$hits" ]; then
    echo "FAIL  use-client files importing server-only barrel:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- A5: sameSite lax baseline ----------
check_samesite_lax_baseline() {
  echo "--- A5: sameSite lax baseline ---"
  local BASELINE=10
  local count
  count=$(grep -rn --include='*.ts' -i 'sameSite.*lax' app/api/ \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | wc -l)
  count=$((count + 0))  # trim whitespace (macOS wc quirk)

  if [ "$count" -gt "$BASELINE" ]; then
    echo "FAIL  sameSite lax count ($count) exceeds baseline ($BASELINE)"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS  (count=$count, baseline=$BASELINE)"
  fi
}

# ---------- A6: Referrer-Policy existence ----------
check_referrer_policy() {
  echo "--- A6: Referrer-Policy existence ---"
  local hits
  hits=$(grep -rn --include='*.ts' --include='*.tsx' \
    -e 'Referrer-Policy' -e 'referrerPolicy' \
    --exclude-dir=node_modules --exclude-dir=.next . \
    | grep -v '\.md:' \
    | grep -v 'scripts/audit/' \
    || true)

  if [ -z "$hits" ]; then
    echo "WARN  No Referrer-Policy / referrerPolicy found in codebase (gap not yet fixed)"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "PASS  Referrer-Policy found"
  fi
}

# ---------- A7: devtunnels wildcard ----------
check_devtunnels() {
  echo "--- A7: devtunnels wildcard ---"
  local hits
  hits=$(grep -n 'devtunnels' next.config.ts 2>/dev/null || true)

  if [ -n "$hits" ]; then
    echo "WARN  devtunnels reference in next.config.ts (ensure removed before prod):"
    echo "$hits"
    WARNINGS=$((WARNINGS + 1))
  else
    echo "PASS"
  fi
}

# ---------- A8: OTP_PEEK_ENABLED scope ----------
check_otp_peek_scope() {
  echo "--- A8: OTP_PEEK_ENABLED scope ---"
  local hits
  hits=$(grep -rn --include='*.ts' --exclude-dir=node_modules --exclude-dir=.next \
    'OTP_PEEK_ENABLED' . \
    | grep -v 'app/api/auth/otp/test-peek/route\.ts' \
    | grep -v 'lib/auth/operatorOtp\.ts' \
    | grep -v '\.env' \
    | grep -v '__tests__/' \
    | grep -v '\.test\.ts' \
    | grep -v 'e2e/' \
    | grep -v 'scripts/audit/' \
    || true)

  if [ -n "$hits" ]; then
    echo "FAIL  OTP_PEEK_ENABLED referenced outside allowed scope:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- Run all checks ----------
check_temp_password_plain
check_access_token_in_body
check_client_server_barrel
check_samesite_lax_baseline
check_referrer_policy
check_devtunnels
check_otp_peek_scope

# ---------- Summary ----------
echo ""
echo "=== Data Leak Audit ==="
echo "Failures: $FAILURES"
echo "Warnings: $WARNINGS"
exit $((FAILURES > 0 ? 1 : 0))
