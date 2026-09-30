#!/usr/bin/env bash
# G7 disclosure-drift (#778) — CI-runnable, exit nonzero on FAIL.
#
# WHY: Every outbound third-party call that processes personal data is a cross-border
# sub-processor that PDPL 2025 (Art. 25 / Nghị định 356/2025/NĐ-CP) requires us to
# disclose in the "Cross-border data transfer" (6a) section of the privacy policy —
# see messages/{vi,en}/legal.json → privacy.s6a.items. It is easy to add a new vendor
# `fetch()` (an SMS/LLM/PSP/analytics endpoint) or a new external-service SDK dependency
# and forget the legal disclosure; that ships an undisclosed sub-processor to prod.
#
# RULE: if the PR diff ADDS a new outbound external-host `fetch('https://…')` call, OR a
# new external-service runtime dependency in package.json, WITHOUT also changing any
# messages/*/legal.json (the sub-processor disclosure), FAIL and name the addition.
#
# Diff-aware (like G9): compares the PR base against the checked-out tree. Passes gracefully
# (no-op) on push events and when the base ref is missing/unfetched — the gate only guards PR
# diffs. POSIX sh; works on Ubuntu (CI) and Git Bash (Windows dev).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# ---------- Resolve the base ref to diff against ----------
# CI passes BASE_SHA=${{ github.event.pull_request.base.sha }} (empty on push).
# Fall back to origin/$GITHUB_BASE_REF, then to a local origin/HEAD, else no-op.
BASE=""
if [ -n "${BASE_SHA:-}" ] && git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  BASE="$BASE_SHA"
elif [ -n "${GITHUB_BASE_REF:-}" ] && git cat-file -e "origin/${GITHUB_BASE_REF}" 2>/dev/null; then
  BASE="origin/${GITHUB_BASE_REF}"
fi

if [ -z "$BASE" ]; then
  echo "--- G7 disclosure-drift ---"
  echo "PASS  (no PR base ref — push event or shallow checkout; gate is diff-only, no-op)"
  exit 0
fi

echo "--- G7 disclosure-drift (base: $BASE) ---"

# ---------- Collect ADDED lines from the PR diff ----------
# `git diff <base>` compares <base> against the working tree. On CI's clean PR checkout the
# tree == PR head, so this is the PR's net diff; run locally it also catches uncommitted work.
# '^+[^+]' = added content lines only (drops the '+++' file header). Failures inside the
# pipeline must not abort under `set -e`, hence the `|| true`.
CODE_ADDED=$(git diff "$BASE" -- '*.ts' '*.tsx' '*.mts' '*.mjs' '*.js' '*.jsx' \
  | grep '^+[^+]' 2>/dev/null || true)
PKG_ADDED=$(git diff "$BASE" -- package.json \
  | grep '^+[^+]' 2>/dev/null || true)

# ---------- Detect newly-added outbound external vendor fetches ----------
# Match fetch("https://<host>… / fetch('https://<host>…  (literal external URLs only —
# a fetch to a template-var base URL, localhost, or a relative path is not a new vendor).
# Allowlist first-party / non-personal-data hosts that are not sub-processors.
VENDOR_FETCHES=$(printf '%s\n' "$CODE_ADDED" \
  | grep -oE "fetch\(['\"]https://[A-Za-z0-9.-]+" 2>/dev/null \
  | sed -E "s/^fetch\(['\"]https:\/\///" \
  | grep -viE '^(localhost|127\.0\.0\.1|0\.0\.0\.0)' \
  | grep -viE '(^|\.)lenxevn\.com$' \
  | grep -viE '(^|\.)(w3|schema)\.org$' \
  | sort -u || true)

# ---------- Detect newly-added external-service runtime dependencies ----------
# Only package name patterns that denote an external service / sub-processor SDK (SMS,
# email, PSP, LLM, storage, OAuth, analytics, error-tracking). Ordinary utility deps
# (zod, clsx, date-fns…) are not sub-processors and must not trip the gate.
VENDOR_REGEX='aws-sdk|resend|sendgrid|mailgun|postmark|nodemailer|twilio|esms|stripe|vnpay|sepay|paypal|momo|zalopay|@sentry|@upstash|upstash|ioredis|openai|@google|googleapis|gemini|groq|@anthropic|mistral|cohere|firebase|supabase|@vercel/analytics|posthog|mixpanel|segment|datadog|arctic'
VENDOR_DEPS=$(printf '%s\n' "$PKG_ADDED" \
  | grep -E "^\+[[:space:]]*\"($VENDOR_REGEX)" 2>/dev/null \
  | sed -E 's/^\+[[:space:]]*//; s/[[:space:]]*$//' \
  | sort -u || true)

if [ -z "$VENDOR_FETCHES" ] && [ -z "$VENDOR_DEPS" ]; then
  echo "PASS  (no new outbound vendor call or external-service dependency in this diff)"
  exit 0
fi

# ---------- A new vendor was added — require a matching legal.json disclosure ----------
LEGAL_CHANGED=$(git diff --name-only "$BASE" -- 'messages/*/legal.json' 2>/dev/null || true)

if [ -n "$LEGAL_CHANGED" ]; then
  echo "PASS  (new vendor(s) added, and legal disclosure was updated:)"
  printf '        %s\n' $LEGAL_CHANGED
  exit 0
fi

echo "FAIL  new outbound sub-processor(s) added WITHOUT a cross-border disclosure update."
echo "      PDPL 2025 requires listing each cross-border sub-processor in the privacy"
echo "      policy. Update the 'Cross-border data transfer' section (privacy.s6a.items)"
echo "      in every messages/*/legal.json, then re-run."
if [ -n "$VENDOR_FETCHES" ]; then
  echo "      New outbound vendor host(s):"
  printf '        https://%s\n' $VENDOR_FETCHES
fi
if [ -n "$VENDOR_DEPS" ]; then
  echo "      New external-service dependency line(s) in package.json:"
  printf '        %s\n' "$VENDOR_DEPS"
fi
exit 1
