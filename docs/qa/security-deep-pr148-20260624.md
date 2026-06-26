SECURITY-DEEP REVIEW — PR #148 "feat(payment): bank transfer via SePay/VietQR"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/148
Base/Head: master ← feat/bank-transfer-payment @ b0ffc7dc
Decision:  (none)
Generated: 2026-06-24

Findings: 3  (P1: 1 · P2: 1 · P3: 1)

P1 — BLOCKING:
  app/(customer)/booking/bank-transfer/BankTransferClient.tsx:44  🚫 P1: Open redirect via user-controlled redirectUrl.
    `redirectUrl` originates from URL search params (set by bankTransfer adapter from
    `input.redirectUrl`). On payment success, `router.replace(target)` navigates to
    this URL. An attacker can craft a link with `redirectUrl=https://evil.com` — after
    the user completes a real payment, they're redirected to a phishing site that mimics
    the confirmation page.
    Chain: initiateBooking body.redirectUrl → adapter createPayment → URL param → page
    searchParams → BankTransferClient prop → router.replace.
    Fix: validate redirectUrl at the page.tsx level — reject non-relative URLs:
    `if (redirectUrl && !redirectUrl.startsWith('/')) { notFound(); }` or use an
    allowlist of known confirmation paths. Also validate at the initiate route level
    as defense-in-depth.

P2 — SHOULD FIX:
  app/api/bookings/status/route.ts  ⚠️  P2: Unauthenticated GET endpoint with no rate limit.
    Endpoint returns booking status by ref. While response is minimal ({ status }),
    it enables existence enumeration (404 vs 200). Booking ref space is ~2^41 so
    brute force is impractical, but automated scanning at scale could probe for
    valid refs. Sibling POST endpoints (/api/bookings/initiate) use rate limiting.
    Fix: add per-IP rate limit (e.g. 30 req/min) via existing ratelimit infra, or
    always return 200 with status='unknown' for non-existent refs.

P3 — ADVISORY:
  app/api/payments/bank_transfer/webhook/route.ts:35  ℹ️  P3: Log line on missing auth includes no request context.
    `logger.warn({ adapter: 'bank_transfer' }, ...)` logs adapter label but not
    request IP or any request identifier. Sibling webhook routes have the same
    pattern so this is consistent, but for a bearer-token-auth endpoint, logging
    the source IP on auth failure aids incident response.
    Fix: add `ip: req.headers.get('x-forwarded-for')` to the log context.

CRYPTO CHECKS (all clean):
  ✓ crypto.timingSafeEqual for bearer token comparison (webhook/route.ts:41)
  ✓ Buffer.from(key, 'utf8') — correct encoding for string token comparison
  ✓ Length check before timingSafeEqual (prevents timing leak on length mismatch)
  ✓ No createCipher, no Math.random for secrets, no weak hash on auth path
  ✓ BOOKING_REF_REGEX anchored (^...$) for validation; non-anchored for extraction — correct

AUTHZ CHECKS (clean for context):
  ✓ Webhook: bearer token auth before processing
  ✓ Status endpoint: intentionally unauthenticated (returns only status field)
  ✓ No sibling audit-log pattern exists in payment webhook routes — consistent

RECOMMENDED NEXT:
  - Fix P1 open redirect before merge (validate redirectUrl is relative path)
  - Consider P2 rate limit on status endpoint
  - P3 IP logging is advisory — consistent with existing pattern

SUMMARY: 1 P1 · 1 P2 · 1 P3 · pinned to b0ffc7dc
