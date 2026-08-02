SECURITY-DEEP REVIEW — PR #342 "feat(notifications): email operators on new booking (#328)"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/342
Base/Head: master ← feat/operator-booking-email @ b51bc64a
Decision:  (none yet)
Generated: 2026-07-25

Findings: 1  (P1: 0 · P2: 0 · P3: 1)

P1 — BLOCKING:
  (none)

P2 — SHOULD FIX:
  (none)

P3 — ADVISORY:
  lib/payment/processWebhook.ts / lib/jobs/reconcilePayments.ts  ℹ️  P3: the
    operatorNewBooking payload (contains buyerPhone) is now persisted on a SECOND
    NotificationLog row (channel=email) in addition to the existing SMS row. Same
    PII kind already stored by the SMS row — not a new exposure class, just a wider
    at-rest footprint. Route to the filed NotificationLog PII-retention follow-up
    (#332). No code change in this PR.

Checked, clean:
  - Crypto (Cat 1): none. ✓
  - Threat-model (Cat 2): no new route file; the added `contactEmail` is a static SELECT
    column (parameterized query unchanged → no SQLi); no user-input→sink, no JSON.parse of
    network input, no eval/redirect. ✓
  - Rate-limit (Cat 3): the email is a NotificationLog enqueue delivered by the dispatch cron,
    not a per-request external send — no unthrottled send path. ✓
  - Audit-log (Cat 4): not an admin/payment mutation handler — a notification enqueue in the
    existing paid path. ✓
  - Authz (Cat 5): no new handler. Recipient is the operator's OWN contactEmail. ✓
  - PII in logs (Cat 6): no new logger call emitting email/phone; the enqueue stores the
    payload but does not log it. ✓

RECOMMENDED NEXT:
  - No blockers. P3 rides the existing #332 retention follow-up.

SUMMARY: 0 P1 · 0 P2 · 1 P3 · pinned to b51bc64a
