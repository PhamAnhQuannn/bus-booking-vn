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
#
# Scope note: this used to also grep lib/payouts/, which has not existed since payouts
# folded into lib/ledger post-091. The clause silently contributed nothing — grep's
# error went to /dev/null and the `|| true` swallowed the status — so the check looked
# broader than it was. A dead path inside a money-safety script is worse than no path:
# it reads as coverage. lib/ledger/ owns calcPayout, settlePayout, retryPayout and
# getPayoutReport, so the real surface is still covered.
check_g4_money_math() {
  echo "--- G4: Math.round/floor in money modules ---"
  local hits
  hits=$(grep -rn --include='*.ts' \
    -e 'Math\.round' -e 'Math\.floor' -e 'Math\.ceil' \
    lib/ledger/ lib/payment/ \
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

  # Issue 348: derive the server-only barrel set dynamically instead of a
  # hand-maintained list of 6. The old hardcoded list left ledger/op/trips —
  # the exact 2026-06-04 operator-portal-outage domains — with zero coverage.
  # A domain barrel is "server-only" (client files must NOT barrel-import it) if
  # it transitively reaches `import 'server-only'` or `@/lib/core/db`.
  #   Pass 1: taint a domain whose own subtree imports a server-only marker.
  #   Pass 2 (fixpoint): taint a domain whose barrel re-exports an already-
  #           tainted domain's barrel (e.g. `export ... from '@/lib/payment'`).
  local domains="" name idx d t changed tainted=""
  for idx in lib/*/index.ts; do d=$(dirname "$idx"); domains="$domains ${d#lib/}"; done

  # Domains that are server-only BY CONTRACT but carry no `server-only` import and
  # never reach lib/core/db, so the marker scan below cannot see them. Each reads
  # secrets through getEnv() or ships a server-only payload; keep in sync with the
  # barrel headers.
  #   config   — lib/config/env.ts exports getEnv(), i.e. HOLD_SECRET / JWT_SECRET /
  #              REFRESH_TOKEN_SECRET / SEPAY_API_KEY / DATABASE_URL.
  #   geo      — lib/geo/vnAdmin.ts is a ~690KB admin dataset; barrel header says
  #              "SERVER-SIDE ONLY … Do NOT import this barrel from 'use client'".
  #   einvoice — lib/einvoice/misaClient.ts reads getEnv() for the MISA credentials.
  #   ratelimit— reads UPSTASH_REDIS_REST_TOKEN directly.
  local EXTRA_SERVER_ONLY="config geo einvoice ratelimit"

  # Domains that MUST end up tainted, asserted BY NAME below. A count floor cannot
  # say WHICH domain vanished: pass 1 greps each domain independently and this
  # script runs without `set -e`, so a single grep exiting 2 drops exactly one
  # domain while the total stays comfortably above any floor. The first six were a
  # hardcoded literal before #348 and were therefore unconditional — a count-only
  # guard would be a REGRESSION in guarantee for them. The rest are contract-only
  # and have no marker that could rediscover them after a rename.
  local G6_REQUIRED="auth booking payment notification admin onboarding config geo einvoice ratelimit"

  for name in $domains; do
    if grep -rqE "import[[:space:]]+['\"]server-only['\"]|from[[:space:]]+['\"]@/lib/core/db" "lib/$name" 2>/dev/null \
       || [ -e "lib/$name/db/client.ts" ]; then
      tainted="$tainted $name"
    fi
  done

  for name in $EXTRA_SERVER_ONLY; do
    case " $tainted " in
      *" $name "*) ;;
      *) [ -f "lib/$name/index.ts" ] && tainted="$tainted $name" ;;
    esac
  done

  changed=1
  while [ "$changed" -eq 1 ]; do
    changed=0
    for name in $domains; do
      case " $tainted " in *" $name "*) continue ;; esac
      for t in $tainted; do
        if grep -q "from ['\"]@/lib/$t['\"]" "lib/$name/index.ts" 2>/dev/null; then
          tainted="$tainted $name"; changed=1; break
        fi
      done
    done
  done

  # Floor assertion — the derivation is the single point of failure for this check.
  # This script runs `set -uo pipefail` WITHOUT -e, so a grep exiting 2 (unreadable
  # path, bad glob, tree moved) silently shrinks $tainted instead of aborting. At
  # zero the alternation below collapses to `@/lib/()`, which matches nothing and
  # prints PASS with live violations on disk — the same vacuous-gate class as #333.
  # Print the derived set so a silent shrink is visible in CI logs, and hard-fail
  # below a floor rather than degrading quietly.
  local G6_MIN_TAINTED=20 tainted_count missing=""
  tainted_count=$(echo "$tainted" | wc -w | tr -d '[:space:]')
  echo "      derived server-only barrels ($tainted_count):$tainted"

  # (a) Required-NAME assertion. This is the real invariant; the count below is
  # only a backstop. Catches a partial collapse (one domain lost to a grep
  # exit-2) and a renamed EXTRA_SERVER_ONLY entry, neither of which moves the
  # count enough to trip a floor.
  for name in $G6_REQUIRED; do
    case " $tainted " in
      *" $name "*) ;;
      *) missing="$missing $name" ;;
    esac
  done
  if [ -n "$missing" ]; then
    echo "FAIL  G6 required server-only domain(s) missing from the derived set:$missing"
    echo "      Either the derivation regressed, or a domain was renamed/removed."
    echo "      Fix the derivation, or update G6_REQUIRED deliberately — do not just"
    echo "      delete the name, which silently drops that barrel's client-leak cover."
    FAILURES=$((FAILURES + 1))
    return
  fi

  # (b) Count floor — backstop for a TOTAL collapse in domains not on the
  # required list. At zero the alternation would degenerate to `@/lib/()`, match
  # nothing, and print PASS with live violations on disk (the #333 class).
  if [ "$tainted_count" -lt "$G6_MIN_TAINTED" ]; then
    echo "FAIL  G6 barrel derivation collapsed: $tainted_count tainted domain(s), expected >= $G6_MIN_TAINTED."
    echo "      The check cannot be trusted in this state — fix the derivation, do not lower"
    echo "      the floor. (If domains were legitimately consolidated, lower it deliberately"
    echo "      in the same commit that removes them.)"
    FAILURES=$((FAILURES + 1))
    return
  fi

  # Single alternation regex over all tainted barrels — one grep per client file
  # (looping every barrel per file is ~2k process spawns; the per-barrel loop was
  # measurably slower in CI, hence the single alternation).
  local alt
  alt=$(echo "$tainted" | tr -s ' ' '|' | sed 's/^|//;s/|$//')

  while IFS= read -r f; do
    local barrel_hits
    barrel_hits=$(grep -nE "from ['\"]@/lib/(${alt})['\"]" "$f" 2>/dev/null | grep -v 'import type' || true)
    if [ -n "$barrel_hits" ]; then
      hits+="$f: $barrel_hits"$'\n'
    fi
  done < <(grep -rl --include='*.ts' --include='*.tsx' -m1 "^['\"]use client['\"]" app/ components/ 2>/dev/null || true)

  if [ -n "$hits" ]; then
    echo "FAIL  use-client files importing server-only barrel:"
    echo "$hits"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS"
  fi
}

# ---------- G7: no placeholder contact data in shipped code ----------
#
# WHY THIS IS A CI CHECK AND NOT A COMMENT
#
# components/home/homePlaceholders.ts carried a header reading, verbatim: "Every one
# of them must be replaced with real data (or the element removed) before this ships
# to production." It shipped to production. Customers saw a `1900 xxxx` support
# hotline, five invented bus operators and hash-generated 4.5-4.9 star ratings on
# lenxevn.com. The same literal ALSO sat in lib/notification/esms.ts, printed into
# the payment-failure email a buyer receives after their money has left their
# account, and survived the first cleanup because that pass fixed the footer and
# never grepped for siblings.
#
# A comment cannot fail a build. This can. Scoped to shipped code — app/, components/,
# lib/ — so docs, tests, issues and QA reports may still quote the strings.
check_g7_placeholder_contacts() {
  echo -n "G7  no placeholder hotline/contact literals in shipped code ... "
  local hits
  # Match the masked hotline only inside a STRING LITERAL — '1900 xxxx' / "1900 xxxx"
  # / `1900 xxxx`. Matching bare text also flagged lib/notification/esmsClient.ts's
  # doc comment explaining the E.164 "+84xxxxxxxxx" format, which is a correct
  # comment about a real format and not a placeholder anyone can ship. A check that
  # cries wolf on accurate documentation gets silenced, so it is scoped to literals.
  # PLACEHOLDER_* exports are matched anywhere: that prefix has no innocent use.
  hits=$(grep -rnE "['\"\`][^'\"\`]*1900[[:space:]]*x{3,}|PLACEHOLDER_(HOTLINE|OPERATORS|SUPPORT|RATING|REVIEW)" \
    --include='*.ts' --include='*.tsx' app/ components/ lib/ 2>/dev/null \
    | grep -v '__tests__' \
    | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(\*|//|/\*)' \
    || true)
  if [ -n "$hits" ]; then
    echo "FAIL  placeholder contact data reachable from shipped code:"
    echo "$hits"
    echo "      Replace with a real value or delete the element. Do not mask it."
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
check_g7_placeholder_contacts

# ---------- Summary ----------
echo ""
echo "=== Greppable Invariants (G1-G7) ==="
echo "Failures: $FAILURES"
echo "Warnings: $WARNINGS"
exit $((FAILURES > 0 ? 1 : 0))
