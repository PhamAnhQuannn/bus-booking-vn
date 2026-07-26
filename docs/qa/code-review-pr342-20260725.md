CODE REVIEW — PR #342 "feat(notifications): email operators on new booking (#328)" @ b51bc64a
────────────────────────────────
Diff scope: 3 files, +47 / -0 lines
Files: lib/payment/processWebhook.ts, lib/jobs/reconcilePayments.ts (+ its test)

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [TEST] lib/payment/processWebhook.ts — the operator-email enqueue there has no direct
    test (no processWebhook unit-test harness exists in the repo; it's integration-covered).
    The identical enqueue on the reconcile path IS unit-tested (reconcilePayments.test.ts →
    3 notices incl. the operator email row). The processWebhook version is a 6-line conditional
    spread mirroring it. Non-blocking; could add an int-test assertion if a harness is stood up.

Notes (checked, NOT findings):
  - Correctness: contactEmail is NOT NULL (schema) → email always enqueued; the `? [...] : []`
    guard is defensive. Both enqueues awaited (Promise.all / await). Runs inside the existing
    paid-path tx — no new race. ✓
  - Raw SQL (reconcile): added `op."contactEmail" AS "operatorContactEmail"` (column name only;
    parameterized query unchanged — no injection) + the matching StuckBookingRow field. ✓
  - Security/PII: recipient is the OPERATOR'S OWN contactEmail (their booking notice); payload
    carries buyerPhone, which the operator legitimately needs to call the customer — same as the
    existing SMS row, no new exposure. No secret/eval/redirect. ✓
  - Not a schema change (contactEmail already exists) → no migration / no INSERT-grep rule. ✓
  - Hygiene: no console/debugger/.only; no VN-phone literal. ✓

SUMMARY: 0 P1, 0 P2, 1 P3

RECOMMENDED NEXT STEPS:
  → Clean. Continue to /pr-review, /security-review-deep, /architect-review.
