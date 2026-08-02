CODE REVIEW — PR #341 "fix(payments): validate SePay account + rate-limit bank_transfer webhook" @ 19633e16
────────────────────────────────
Diff scope: 7 files, +129 / -11 lines
Files: proxy.ts, __tests__/proxy.ratelimit.test.ts, lib/payment/gateway.ts,
       lib/payment/adapters/bankTransfer.ts (+test), bank_transfer/webhook/route.ts (+test)

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  (none)

Notes (checked, NOT findings):
  - Correctness: account check `String(payload.accountNumber ?? '').trim() !== expected.trim()`
    — a missing/blank account fails closed (held as orphan), which is the safe direction. ✓
  - proxy split: HMAC webhooks (RATELIMIT_EXEMPT) still skip BOTH gates; bank_transfer falls
    through to the rate-limit, then skips CSRF via `CSRF_EXEMPT.has(pathname)`. All 5 webhooks
    stay CSRF-exempt — NO CSRF regression; only bank_transfer gains rate-limiting. ✓
  - account_mismatch → 200 ack + orphan (not a drop), consistent with the no_booking_ref branch
    and the Bug B reconcile suspicion-hold (never auto-credits). ✓
  - Adapter boundary (gateway.ts:13 rule): the native `accountNumber` comparison stays INSIDE the
    adapter; the route passes only `expectedAccount`. ✓
  - Test coverage: adapter (match / mismatch+orphan / no-opts back-compat), route (mismatch → 200
    + orphan, no credit), proxy (bank_transfer 429 past limit + still CSRF-exempt; HMAC exempt). ✓
  - Failure mode: recordUnmatchedPaymentEvent awaited under withErrorHandler (throw → 500 → SePay
    retry), same as the existing orphan path. ✓
  - Hygiene: no console/debugger/.only; no VN-phone literal matching gitleaks. ✓

SUMMARY: 0 P1, 0 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → Clean. Continue to /pr-review, /security-review-deep, /architect-review.
