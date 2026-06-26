CODE REVIEW — PR #148 "feat(payment): bank transfer via SePay/VietQR" @ da63468f
────────────────────────────────
Diff scope: 21 files, ~1068 lines (excl lockfile)
Round: 2 (post-P1 fixes)

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  [FAILURE MODE / RATE-LIMIT] app/api/bookings/status/route.ts
    Unauthenticated GET endpoint with no rate limiting. Booking ref space is large
    (~2.8T combinations) so brute-force enumeration is infeasible, but a determined
    attacker could still abuse this for targeted ref polling. Non-blocking because
    response is minimal ({ status } only) and ref is not secret.
    Fix: consider adding lightweight rate-limit in a follow-up issue (not blocking for Phase 1).

PRIORITY 3 — Address when convenient:
  [READABILITY / MAGIC] app/(customer)/booking/bank-transfer/BankTransferClient.tsx:58
    Magic number `5000` in setTimeout for poll interval.
    Fix: extract to named constant `POLL_INTERVAL_MS = 5000` alongside `MAX_REFRESHES`.

  [TEST / NON-RISK] app/(customer)/booking/bank-transfer/BankTransferClient.tsx
    Client component with polling logic has no unit test. Non-risk path (UI only).

  [TEST / NON-RISK] lib/payment/select.ts
    `getGatewayFor('bank_transfer')` branch added but no test covers it directly.
    The branch is a trivial early-return; adapter itself is well-tested.

CLAUDE.md MISTAKE LOG AUDIT:
  ✓ Issue 002 — page.tsx calls getBookingByRef in-process (no self-fetch)
  ✓ Issue 003 — EXTRACT_REGEX is non-anchored+case-insensitive for extraction;
    BOOKING_REF_REGEX (anchored) used for validation in status route
  ✓ Issue 007 — SEPAY_API_KEY added to logger redact list (same commit)
  ✓ Issue 092b/operator-smoke — BankTransferClient.tsx ('use client') imports only
    from lucide-react/next/navigation, NOT from @/lib/auth barrel
  ✓ WT-20 — SEPAY_API_KEY not added to Zod schema top-level (optional field);
    superRefine only fires when PAYMENTS_STUB=false; CI uses PAYMENTS_STUB=true

SUMMARY: 0 P1, 1 P2, 3 P3

RECOMMENDED NEXT STEPS:
  → No P1 findings. Proceed to CI.
  → P2 rate-limit is a follow-up issue, not blocking Phase 1.
