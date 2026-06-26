OBSERVABILITY REVIEW — PR #148 "feat(payment): bank transfer via SePay/VietQR"
Round 2 @ 2026-06-24
=====================

Diff scope: 2 new route handlers, 1 new payment adapter, barrel + type union
expansions, env config, logger redact, proxy CSRF exempt.

────────────────────────────────────────────────────────────────────────────────
1. WEBHOOK ROUTE: POST /api/payments/bank_transfer/webhook
────────────────────────────────────────────────────────────────────────────────

Auth failures logged?  YES
  - Missing auth header / empty SEPAY_API_KEY: logger.warn `payment.bank_transfer.webhook.missing_auth` (line 35)
  - Invalid bearer token: logger.warn `payment.bank_transfer.webhook.invalid_bearer` (line 42)
  - Both use timing-safe compare (crypto.timingSafeEqual) — correct.

Unmatched transfers logged?  YES
  - `no_booking_ref_in_memo` case: logger.info with reason field,
    `payment.bank_transfer.webhook.unmatched — 200 no-op` (line 51-54).
  - Returns 200 (not 400) so SePay does not retry. Correct per design doc.

Successful processing logged?  YES (via processPaymentWebhook)
  - Route delegates to `processPaymentWebhook()` which has comprehensive
    logging: verify outcome, booking lookup, status transitions, duplicate IPN
    detection, overpay, oversold, currency/amount mismatch — all logged.
  - No entry-point `webhook_received` log (unlike VNPay which logs at handler
    entry). MoMo also omits this — so the bank_transfer route is consistent
    with the MoMo pattern. Acceptable: processPaymentWebhook logs
    `payment.webhook.verify` on every call, which serves as the receipt log.

Error handling?  YES
  - Wrapped in `withErrorHandler` (line 67). Unhandled throws produce
    logger.error + 500 JSON response without stack/PII leak.
  - processPaymentWebhook internally catches P2002 (duplicate IPN) and logs
    at info level. Non-idempotent errors rethrow with captureException.

Test coverage of logging?
  - route.test.ts asserts logger.warn on missing auth (line 67) and invalid
    bearer (lines 73-76). Adequate.

VERDICT: PASS. No findings.

────────────────────────────────────────────────────────────────────────────────
2. POLLING ENDPOINT: GET /api/bookings/status
────────────────────────────────────────────────────────────────────────────────

Current logging: NONE. No logger import, no log statements.

Is this acceptable?  YES, with caveats.

Rationale:
  - This is a high-frequency polling endpoint (every 5s per active payment
    flow, up to 120 polls = ~10 min). At scale with N concurrent payments,
    this produces N*120 requests per payment window.
  - The response is deliberately minimal (`{ status }`) — no PII, no booking
    details, unauthenticated by design.
  - The endpoint has only 3 code paths: 400 (bad ref format), 404 (not found),
    200 (status returned). All are expected in normal operation.
  - Adding per-request logging would create noise in production logs with
    minimal diagnostic value. The `bookingRef` is validated via regex before
    any DB hit, so invalid-format requests are cheap rejects.

Comparison with similar endpoints:
  - Other `/api/bookings/*` routes use `withErrorHandler` but those are
    authenticated, non-polling endpoints with richer response bodies.
  - No precedent for polling-specific endpoints in the codebase to compare.

Caveats / future work (not blocking):
  - The endpoint lacks `withErrorHandler`. If `prisma.booking.findUnique`
    throws (e.g., DB connection error), Next.js returns a default 500 with
    no structured logging. This is a P3 gap — withErrorHandler would add
    structured error logging for unexpected failures. Low probability given
    the query simplicity, but a bare try/catch or withErrorHandler wrap would
    bring it in line with every other `/api/bookings/*` route.
  - No rate limiting. At 5s intervals per client this is benign, but an
    attacker could enumerate booking refs at high throughput. The 404 vs 200
    response leaks existence (not data). A future rate-limit middleware or
    Cloudflare rule would mitigate. Not in scope for this PR.

VERDICT: ACCEPTABLE. One P3 recommendation below.

────────────────────────────────────────────────────────────────────────────────
3. SEPAY_API_KEY IN REDACT LIST
────────────────────────────────────────────────────────────────────────────────

CONFIRMED PRESENT: lib/logger.ts line 106:
  `'SEPAY_API_KEY',           // bank transfer: SePay webhook bearer token (never log)`

The round-1 review flagged this as missing (P2). It has since been added.
The key is also NOT logged in any log statement — the webhook route logs
`{ adapter: 'bank_transfer' }` context only, never the raw key.

VERDICT: PASS.

────────────────────────────────────────────────────────────────────────────────
4. ERROR PATHS
────────────────────────────────────────────────────────────────────────────────

Webhook route:
  - `withErrorHandler` wraps the exported POST handler. Catches unhandled
    errors, logs at error level, returns 500 JSON. PASS.

Status route:
  - No `withErrorHandler`. Exported as a bare `async function GET()`.
  - If prisma throws, Next.js catches it and returns an opaque 500.
  - No structured logging of the failure. See P3 below.

VERDICT: Webhook PASS, status route P3.

════════════════════════════════════════════════════════════════════════════════
FINDINGS SUMMARY
════════════════════════════════════════════════════════════════════════════════

P1 (block merge): 0
P2 (fix before merge): 0
P3 (address when convenient): 1

  [P3] app/api/bookings/status/route.ts — no withErrorHandler wrap.
    Every other `/api/bookings/*` route uses `withErrorHandler`. This endpoint
    omits it. If the DB query throws, the error goes unlogged (Next.js default
    500, no Pino output). Low risk given query simplicity, but inconsistent
    with codebase convention.
    Suggested fix: import `withErrorHandler`, wrap the export:
      `export const GET = withErrorHandler(handler);`
    No logging needed for normal 200/400/404 paths (polling noise).
