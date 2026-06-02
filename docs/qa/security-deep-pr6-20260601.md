SECURITY-DEEP REVIEW — PR #6 "feat: OTA redesign + payment/booking correctness fixes + rebuild backlog"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/6
Base/Head: master ← feat/ota-redesign @ 02e6eab5
Decision:  (none)
Generated: 2026-06-01

Findings: 1  (P1: 0 · P2: 0 · P3: 1)

P1 — BLOCKING:
  (none)

P2 — SHOULD FIX:
  (none)

P3 — ADVISORY:
  app/api/op/trips/route.ts (POST create) · lib/trips/createTrip.ts, reassignBus.ts
    ℹ️  P3: Operator trip create/reassign/cancel are state mutations with no actor-audit trail.
    The project has NotificationLog but no formal "who did what when" audit-log pattern. Not blocking
    (routes are tenant-isolated via requireOperatorAuth + JWT operatorId), but operator mutations on
    trips/payouts are the kind of action a dispute later needs to attribute.
    Fix: establish an audit-log pattern — see /audit-log-design. Defer to a follow-up issue.

CLEAN PASSES (the security-relevant changes in this PR):

  ✓ Cat1 Crypto — no createCipher, no Math.random()-for-secret, no md5/sha1 on a password/sig path,
    no weak KDF rounds, no ECB. The createHmac usages (lib/auth/operatorSession.ts, refreshToken.ts)
    are SHA-256 session-token signing with crypto.timingSafeEqual constant-time compare — correct.

  ✓ Cat2 Threat-model delta — the one NEW endpoint (app/api/op/activity) is tenant-isolated
    (requireOperatorAuth, operatorId from JWT, limit clamped 1-100). No user input reaches a raw-SQL
    template unparameterized: searchTrips/busOverlap use Prisma.sql tagged templates (${param} bound,
    not interpolated). No new eval/exec/open-redirect/upload surface.

  ✓ Cat3 Rate-limit — bookings/initiate gates on ratelimit.limit(ip) before work. Webhook authenticates
    via MoMo HMAC signature (vendor IPN — rate-limit N/A). No new auth/otp/email/sms endpoint added.

  ✓ Cat5 Authz — getCustomerOptional (lib/auth/requireCustomerAuth.ts) cryptographically verifies the
    access token via verifyAccess(token) and returns null on missing/invalid — it does NOT trust a
    spoofable header. Correct optional-auth trust boundary.

  ✓ Cat6 PII — webhook amount_mismatch/overpaid logs carry only {adapter, bookingRef, VND amounts};
    no phone/email. lib/logger.ts redact list includes buyerPhone (Issue 015). No unredacted PII added.

SECURITY IMPROVEMENTS introduced by this PR (worth calling out):
  ★ fix(booking) guest-attach — REMOVES the spoofable phone-match attach at payment. Previously any
    typed buyerPhone matching a registered account would link the booking to that account (account-
    takeover-adjacent). Now ownership is proven by session (Booking.customerId stamped at initiate);
    guests link only via OTP-proven register backfill. This is the highest-value security change here.
  ★ fix(payment) underpay guard — a success-code IPN that UNDERPAYS no longer transitions the booking
    to paid (money-loss prevention); overpay no longer silently kept (logged for refund-out rail).

RECOMMENDED NEXT:
  - No blocking security findings. The money/auth changes are net security-POSITIVE.
  - Optional: /audit-log-design for the operator-mutation audit trail (P3, follow-up issue).

SUMMARY: 0 P1 · 0 P2 · 1 P3 · pinned to 02e6eab5
