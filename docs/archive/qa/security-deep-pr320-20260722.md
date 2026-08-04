SECURITY-DEEP REVIEW — PR #320 "fix(payments): SePay bank-transfer go-live — Apikey auth, memo hyphen-strip, 15m window"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/320
Base/Head: master ← fix/sepay-bank-transfer-golive @ 4eea40ef
Generated: 2026-07-22

Findings: 0  (P1: 0 · P2: 0 · P3: 0)

No blocking security-deep findings.
(Crypto, authz, rate-limit, audit-log, injection, PII patterns clean.)

Category walk (payment auth boundary — reviewed with care):

  • Cat 1 Crypto — key comparison uses `crypto.timingSafeEqual` with a length
    pre-check (constant-time, no throw on length mismatch). No createCipher, no IV
    reuse, no Math.random for secrets, no MD5/SHA1 on a secret path, no new
    crypto-crossing-boundary function. The regex changes are parsing, not crypto.

  • Cat 2 Threat-model delta — NO new endpoint; the webhook route is modified, not
    added, and still authenticates (must match SEPAY_API_KEY). The auth change WIDENS
    accepted schemes from Bearer-only to `Apikey`|`Bearer` — NOT a weakening: both
    require the same valid secret via timingSafeEqual; `Basic`/unknown schemes still
    401 (tested). The more-permissive memo regex affects only which bookingRef is
    extracted; its output is a structured `bb-\d{4}-…` string used in a PARAMETERIZED
    Prisma lookup (processPaymentWebhook), never raw SQL/HTML/shell — no injection
    sink. No eval/exec, no open redirect, no user-input SSRF.

  • Cat 3 Rate-limit — no new auth/otp/email/sms/payment-creating endpoint. The
    webhook's edge rate-limit + CSRF exemption (proxy.ts CSRF_EXEMPT) is PRE-EXISTING
    and deliberate (webhooks authenticate by key and must not drop SePay's backoff
    retries). Unchanged by this PR.

  • Cat 4 Audit-log — no new mutation handler. The paid transition + append-only
    LedgerEntry writes (the payment audit trail) live in the unchanged shared
    processPaymentWebhook. seed-test-trip.ts is a one-off ops CLI (mirrors
    purge-demo-catalog.ts), not an admin/payment HTTP mutation → no audit-log expectation.

  • Cat 5 Authz — no new handler; the shared-secret check IS the webhook's authz and
    is preserved (key still required). No sibling inconsistency introduced.

  • Cat 6 PII — the missing_auth log carries only `{adapter}` (no PII; diagnostic
    reverted before commit). seed-test-trip.ts logs cuids + a gitleaks-safe phone
    placeholder `+8490xxxxxx1` + a test email — no real customer PII. No new PII column.

Context (not a finding against this PR): SePay "API Key" auth is a shared static
secret with no HMAC body signing — that is the vendor's documented contract
(docs.sepay.vn), inherent to the integration, not introduced here. The secret is the
sole auth boundary; treat it like a password and rotate on leak (already noted in the
setup guide's Security Notes).

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to 4eea40ef

RECOMMENDED NEXT:
  - Clean. No security remediation required before merge.
