ARCHITECT REVIEW (Round 2) — PR #148 "feat(payment): bank transfer via SePay/VietQR" @ da63468f
─────────────────────────────
Base: master  ·  Head: feat/bank-transfer-payment  ·  State: open
URL: https://github.com/PhamAnhQuannn/bus-booking-vn/pull/148

Scanned: payment, booking, config, core, app/(customer)/booking, app/api/bookings,
         app/api/payments, proxy.ts. 21 files in diff (incl. tests).

───────────────────────────────────────────────────────────────────────────────
PRIORITY 1 — BLOCKING
───────────────────────────────────────────────────────────────────────────────

  (none)

───────────────────────────────────────────────────────────────────────────────
PRIORITY 2 — SHOULD FIX BEFORE MERGE
───────────────────────────────────────────────────────────────────────────────

  P2-1  [STATUS ENDPOINT — RATE-LIMIT]
        GET /api/bookings/status has no per-route rate-limit.
        The BankTransferClient polls every 5s (up to 120 times = 10 min per session).
        The proxy rate-limit only covers non-safe methods (POST/PUT/PATCH/DELETE);
        GET requests pass through. An attacker could enumerate valid bookingRefs by
        brute-forcing the status endpoint at high volume. The BOOKING_REF_REGEX
        validation blocks garbage, but the 200-vs-404 response is an oracle.
        Recommendation: add a lightweight per-IP rate-limit (same ratelimit.limit()
        pattern as other GET endpoints), OR require the bb_hold cookie/bookingRef
        ownership proof, OR return 200 with a generic status for not-found refs.
        Severity: medium — enumeration risk on a non-PII endpoint, but bookingRef
        format (BB-YYYY-xxxx-xxxx with base36) has ~1.7 billion combinations per
        year, making blind enumeration impractical. Still, defence-in-depth warrants
        a rate-limit or flattened response.

  P2-2  [QR IMAGE URL — PARAMETER INJECTION]
        page.tsx line 76 interpolates user-controlled URL search params (bankBin,
        accountNumber, template) directly into the VietQR image URL:
          `https://img.vietqr.io/image/${bankBin}-${accountNumber}-${template}.png?...`
        While these come from the server-side adapter's createPayment (which sources
        them from env), the page.tsx server component reads them from searchParams,
        so a crafted URL could inject arbitrary path segments into the VietQR URL.
        Risk: the img.vietqr.io domain is third-party; path traversal or unexpected
        path shapes could cause confusing rendered output or serve a phishing QR.
        The values are not user-entered in the normal flow (they come from the
        adapter redirect), but the URL is shareable.
        Recommendation: validate bankBin (must be numeric, 6 digits), accountNumber
        (must be numeric), and template (must match a known set like compact/compact2/
        qr_only/print) in the server component before interpolation. Simple regex
        guards suffice.

───────────────────────────────────────────────────────────────────────────────
PRIORITY 3 — NON-BLOCKING, ADDRESS LATER
───────────────────────────────────────────────────────────────────────────────

  P3-1  [DOUBLE verifyWebhook CALL]
        The bank_transfer webhook route calls gateway.verifyWebhook() for the
        no_booking_ref_in_memo early-return (line 49), then passes the same rawBody
        + gateway to processPaymentWebhook which calls verifyWebhook() again (line
        89 of processWebhook.ts). The second call re-parses the JSON and re-runs the
        regex extraction. This is consistent with the VNPay webhook pattern (which
        also pre-verifies then delegates), and the overhead is negligible (JSON parse
        of a small payload). No fix needed now, but a future refactor could pass the
        pre-verified event into processPaymentWebhook to skip redundant parsing.

  P3-2  [POLLING APPROACH — URL PARAM COUNTER]
        BankTransferClient increments a `r` counter in the URL search params on each
        poll cycle, causing a client-side navigation every 5 seconds. This triggers
        React's router to re-render the entire page tree, including the server
        component (which re-queries the DB for getBookingByRef). A more efficient
        approach would poll via fetch() only and update local state, without touching
        the URL. The current approach works but causes unnecessary server-component
        re-renders during each poll cycle. Low priority — the page is simple and the
        query is indexed.

───────────────────────────────────────────────────────────────────────────────
ARCHITECTURE CHECKS — ALL PASSED
───────────────────────────────────────────────────────────────────────────────

  [DEPENDENCY FLOW] PASS
    app/ -> lib/<domain>/ -> lib/core/. No reverse deps. Verified:
    - bankTransfer.ts: imports from @/lib/config (barrel) + ../gateway (intra-domain). Correct.
    - page.tsx: imports from @/lib/booking (barrel). Correct.
    - webhook/route.ts: imports from @/lib/payment (barrel), @/lib/config (barrel),
      @/lib/logger (core-adjacent), @/lib/withErrorHandler. Correct.
    - status/route.ts: imports from @/lib/core/db/client + @/lib/booking (barrel). Correct.
    - processWebhook.ts: imports from @/lib/booking (barrel). Existing pattern, not new.
    No lib/ -> app/ reverse dependencies found.

  [MODULE BOUNDARIES — BARREL RULE] PASS
    Cross-domain imports go through barrels only:
    - bankTransfer.ts -> @/lib/config (barrel). Not @/lib/config/env deep path. Correct.
    - webhook route -> @/lib/payment (barrel). Correct.
    - status route -> @/lib/booking (barrel) for BOOKING_REF_REGEX. Correct.
    Intra-domain deep imports (bankTransfer.ts -> ../gateway) are allowed. Correct.

  ['use client' DEEP-IMPORT RULE] PASS
    BankTransferClient.tsx ('use client') imports:
    - react (useEffect, useState)
    - next/navigation (useRouter, useSearchParams)
    - lucide-react (Loader2, CheckCircle2)
    ZERO @/lib/* imports. No risk of server-only transitive pull. Fully clean.

    layout.tsx ('use client') imports:
    - next/navigation (usePathname, useRouter)
    - @/lib/state (barrel) — client-safe zustand store only. Verified: lib/state/index.ts
      exports only useBookingStore. No server-only transitives.

  [ADAPTER PATTERN CONFORMANCE] PASS
    Bank transfer adapter follows the exact same pattern as MoMo and VNPay:
    - Factory function createBankTransferAdapter() returns PaymentGateway
    - Module-level singleton with getBankTransferAdapter()
    - Test reset helper _resetBankTransferAdapter()
    - Implements both createPayment() and verifyWebhook() from the interface
    - Return types match: CreatePaymentResult and VerifyWebhookResult

  [NO CYCLES] PASS
    payment -> booking: processWebhook.ts imports legalPredecessors from @/lib/booking (barrel).
    booking -> payment: initiateOnlineBooking.ts imports getGatewayFor from @/lib/payment (barrel).
    This is the EXISTING bidirectional dependency between booking and payment domains.
    The new bank transfer code does NOT add any new cross-domain edges:
    - bankTransfer.ts imports only from @/lib/config (not booking).
    - status/route.ts imports from @/lib/booking (app/ -> lib/, not a cycle).
    - webhook/route.ts imports from @/lib/payment (app/ -> lib/, not a cycle).
    No new cycles introduced.

  [CSRF_EXEMPT — EXACT-MATCH Set] PASS
    proxy.ts CSRF_EXEMPT Set now includes '/api/payments/bank_transfer/webhook'.
    Uses exact-match Set.has() — not startsWith. Per CLAUDE.md Issue 010 mandate.
    Grouped correctly with other payment webhook exemptions (momo, zalopay, card, vnpay).

  [BOOKING LAYOUT GUARD BYPASS] PASS
    layout.tsx TOKEN_LANDING_PREFIXES includes '/booking/bank-transfer'.
    This correctly bypasses the tripId guard for the bank transfer page, which is
    reached after initiateOnlineBooking redirects (no client-side booking state needed).
    Same pattern as /booking/confirmation and /booking/result.

  [ENV CONFIG — Zod SCHEMA] PASS
    New env vars added to lib/config/env.ts:
    - SEPAY_API_KEY: z.string().optional() — correct, only required when PAYMENTS_STUB=false.
    - VIETQR_BANK_BIN: z.string().default('970405') — sensible Agribank default.
    - VIETQR_ACCOUNT_NUMBER: z.string().default('3516205005863') — dev default.
    - VIETQR_ACCOUNT_NAME: z.string().default('BUS BOOK VN') — dev default.
    - VIETQR_TEMPLATE: z.string().default('compact2') — dev default.
    superRefine enforces SEPAY_API_KEY when PAYMENTS_STUB=false. Consistent with
    the VNPay/MoMo credential enforcement pattern.

  [CI COMPATIBILITY] PASS
    CI runs with PAYMENTS_STUB='true'. The SEPAY_API_KEY superRefine only fires
    when PAYMENTS_STUB=false, so CI is unaffected. No new production-required var
    in the superRefine's NODE_ENV=production block. Per CLAUDE.md mistake log WT-20:
    checked — SEPAY_API_KEY not in CI scope guards, not in the production-required
    list (it's gated on PAYMENTS_STUB, not NODE_ENV).

  [GATEWAY SELECTOR — STUB BYPASS] PASS (note)
    select.ts returns getBankTransferAdapter() BEFORE the PAYMENTS_STUB check.
    This means bank_transfer NEVER routes through the stub adapter, even in dev.
    This is architecturally correct: bank transfer has no external PSP API call
    (createPayment returns an internal redirect URL), so stubbing is unnecessary.
    The webhook is the only external touchpoint, and it's authenticated via bearer
    token in the route handler.

  [LOGGER REDACTION] PASS
    SEPAY_API_KEY is in the logger redact paths list (lib/logger.ts line 106).
    Added in the same commit as the feature — per CLAUDE.md PII & Secrets rule.

  [.env.example UPDATED] PASS
    New SePay/VietQR vars documented in .env.example with comments.
    SEPAY_API_KEY is commented out (optional for dev). VietQR defaults match
    the Zod schema defaults.

  [TEST COVERAGE] PASS
    - lib/payment/__tests__/bankTransfer.test.ts: 9 test cases covering createPayment
      + verifyWebhook (valid, invalid JSON, invalid amount, outbound transfer,
      no booking ref, case-insensitive extraction). Uses BOOKING_REF_REGEX spirit
      (lowercase assertion). Reset helper used in beforeEach.
    - app/api/payments/bank_transfer/webhook/__tests__/route.test.ts: 6 test cases
      covering auth (missing, invalid, unconfigured key), no-booking-ref early-return,
      valid delegation, and non-memo-failure delegation. Mocks follow barrel-import
      pattern (@/lib/payment, not deep paths).
    - app/api/bookings/status/__tests__/route.test.ts: 6 test cases covering
      validation (invalid ref, empty ref, uppercase rejection), not-found, valid
      response, and correct select shape.

  [SECURITY — WEBHOOK AUTH] PASS
    Bearer token comparison uses crypto.timingSafeEqual with length guard (line 41
    of webhook route). Matches the constant-time comparison pattern used by MoMo/VNPay
    HMAC verification. Empty token or missing SEPAY_API_KEY both return 401 before
    any processing.

  [SECURITY — OPEN REDIRECT GUARD] PASS
    page.tsx line 62-64: redirectUrl from search params validated to start with '/'.
    Non-relative redirectUrl returns notFound(). Prevents open-redirect via the
    bank transfer page.

  [processPaymentWebhook ADAPTER LABEL] PASS
    ProcessPaymentWebhookInput.adapter documented as 'bank_transfer' in the JSDoc.
    Webhook route passes adapter: 'bank_transfer'. Stored on PaymentEvent.adapter
    column for reconciliation.

───────────────────────────────────────────────────────────────────────────────
SUMMARY
───────────────────────────────────────────────────────────────────────────────

  0 P1 (blocking)
  2 P2 (should fix before merge)
  2 P3 (non-blocking, address later)

  P2-1: Add rate-limit or flatten response for GET /api/bookings/status
  P2-2: Validate bankBin/accountNumber/template params before VietQR URL interpolation

  Architecture is clean. Dependency flow, barrel boundaries, client-safety, adapter
  conformance, CSRF exemption, and cycle analysis all pass. The PR integrates bank
  transfer into the existing payment architecture with minimal surface area and no
  structural violations.
