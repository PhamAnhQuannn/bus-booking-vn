SECURITY-DEEP REVIEW — PR #341 "fix(payments): validate SePay account + rate-limit bank_transfer webhook"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/341
Base/Head: master ← fix/bank-transfer-webhook-security @ 19633e16
Decision:  (none yet)
Generated: 2026-07-25

Findings: 0  (P1: 0 · P2: 0 · P3: 0)

No security-deep findings. This PR is itself a security hardening:
  - Cat 3 (rate-limit): #329 ADDS edge rate-limiting to the bank_transfer webhook, which
    was un-throttled (Apikey auth, wrongly sharing the HMAC webhooks' exempt set). The 4
    HMAC webhooks stay exempt; bank_transfer now rate-limited + still CSRF-exempt. ✓
  - #334 adds a trust check on the payment SOURCE: reject/hold a transfer whose destination
    accountNumber isn't our configured VietQR account (foreign/spoofed account never credited).

Checked, clean:
  - Crypto (Cat 1): none added. Webhook Apikey compare still uses crypto.timingSafeEqual
    (unchanged). accountNumber is a public bank number, not a secret → plain compare is fine. ✓
  - Threat-model (Cat 2): no new route file; no upload; no req-input flowing to SQL/shell/HTML/
    redirect; JSON.parse of the SePay body is pre-existing + field-validated in the adapter, not
    introduced here. ✓
  - Authz (Cat 5): webhook auth (Apikey timingSafeEqual) unchanged; no new handler. ✓
  - PII (Cat 6): the new logger.warn logs only { adapter, reason } — deliberately NOT the
    accountNumber or any customer field. No new PII column. ✓

RECOMMENDED NEXT:
  - No blockers. Proceed to /architect-review.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to 19633e16
