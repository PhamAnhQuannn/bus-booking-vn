ARCHITECT REVIEW — PR #341 "fix(payments): validate SePay account + rate-limit bank_transfer webhook" @ 19633e16
─────────────────────────────
Base: master · Head: fix/bank-transfer-webhook-security · State: open
Note: scoped assessment against the known diff + repo graph (not a full temp-branch
re-audit — working tree carries this session's untracked docs/qa reports; the skill's
PR-mode checkout refuses a dirty tree, and the change is small + localized).

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before next release:
  (none)

Architectural notes (checked, clean):
  - Module graph: no new import edges. gateway.ts widens PaymentGateway.verifyWebhook with an
    OPTIONAL opts param (additive); bankTransfer.ts reads it; route.ts passes the already-imported
    env. proxy.ts adds a local const Set. No new cross-domain edge, no cycle. ✓
  - Adapter boundary (gateway.ts:13 invariant — native PSP field names stay behind the adapter):
    the SePay `accountNumber` comparison lives INSIDE the bank_transfer adapter; the route passes
    only `expectedAccount`. The native field never leaks past the boundary. ✓ (the one
    architecturally-relevant decision here, and it's correct)
  - Payment-invariant (crypto/verify at the webhook boundary): Apikey verify (timingSafeEqual)
    stays in the webhook route; the account trust check is a plain compare in the adapter. No
    payment crypto moved out of place. ✓
  - No schema mutation in app code; no secret referenced client-side (webhook route is server-only;
    account number is not a secret). ✓
  - proxy.ts change is a set-membership refinement (RATELIMIT_EXEMPT ⊂ CSRF_EXEMPT) — no new
    dependency, no layering change. ✓

SUMMARY: 0 P1, 0 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → Clean. Proceed to CI.
