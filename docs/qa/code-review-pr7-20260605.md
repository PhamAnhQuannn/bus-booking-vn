CODE REVIEW — PR #7 "feat: push rebuild backlog + OTA polish + pay/profile/OTP fixes" @ 3fc5afba
────────────────────────────────
Diff scope: 849 files, +59,299 / −7,700 lines (vs master)
Method: 5 parallel domain reviewers (money / ledger+payout / auth+OTP / admin+charter / session-top-of-stack).
        Line-level full-pass on every changed file was infeasible at 849 files; review concentrated on the
        risk-path domains (payment, auth, schema, admin, ledger) per skill severity rules + the AGENTS.md
        Mistake Log auto-P1 set.

PRIORITY 1 — Block push, fix first:

  [SECURITY / AUTH — REPLAY] app/api/auth/register/route.ts:~56-68 (and the login counterpart)
    The route does a RAW `jwtVerify` of the `otpProof` JWT and never consumes its `jti`. In
    lib/auth/otpProof.ts:30-33 the `JTI_REQUIRED_PURPOSES` set contains only `'reset_password'`
    and `'phone_change'` — the `'otp_proof'` purpose (register/login) is absent, so
    `verifyOtpProof()` would NOT enforce single-use even if called.
    Effect: the same otpProof is replayable for its full 5-min TTL — the one-shot guarantee the
    AGENTS.md Issue 007 Mistake Log explicitly documents ("Register/login jwt.verify + jti-consume
    (Redis SETNX) makes the proof one-shot, replay-safe via jti") is NOT in force.
    Severity: Category-2 security finding + direct Mistake-Log deviation → P1 by skill rule.
    Mitigating context (why it's not catastrophic, but still fix): register is also gated by the
    `PHONE_TAKEN` unique constraint + IP rate-limit, so blind replay can't mint duplicate accounts
    for an already-registered phone. The exposure is the lost replay-safety property itself
    (e.g. a captured proof reused within 5 min on the login leg).
    Fix: add `'otp_proof'` to `JTI_REQUIRED_PURPOSES` in lib/auth/otpProof.ts AND route
    register/login through `verifyOtpProof()` (jti Redis SETNX consume) instead of raw `jwtVerify`.
    Confirm `otpProof` stays in the logger redact list (it is, per Issue 007).
    NOTE: if the team made a deliberate decision to drop jti for register/login, that decision is
    undocumented and contradicts the Mistake Log — document the exemption inline either way.

PRIORITY 2 — Fix before merge:

  [FAILURE MODE / ATOMICITY] lib/onboarding/payoutVerify.ts:~131-156
    `confirmPayoutAccountOwnership` does `payoutAccount.update` + `writeAdminAuditLog` WITHOUT a
    wrapping `$transaction`. If the audit write throws after the update commits, the account is
    marked verified with no audit trail — breaks the "privileged mutation ⇒ audit row" invariant
    (Issue 062/065 pattern).
    Fix: wrap the update + audit write in `prisma.$transaction`.
    (Same defect surfaces via the route at app/api/admin/operators/[id]/confirm-payout-account/route.ts:~55.)

  [FAILURE MODE / SWALLOW] lib/charter/declineCharter.ts:~63
    try/catch around `createNotificationLog` swallows the error silently ("state change is source
    of truth"). Best-effort notify is a legitimate choice, but a silent drop with no log/telemetry
    hides delivery-enqueue failures from ops.
    Fix: keep best-effort, but `logger.warn`/Sentry-breadcrumb the swallowed error instead of
    discarding it; or document the best-effort contract inline.

PRIORITY 3 — Address when convenient:
  (none surfaced in the risk-path sweep beyond the above. UI/top-of-stack session fixes reviewed
   clean — no leftover console.log/debugger/.only, no client-side barrel leak.)

CLEAN DOMAINS (verified, no findings):
  - MONEY (lib/payment, lib/booking, lib/holds, app/api/{holds,bookings,payments}): BigInt fee math
    (no Number*rate), half-even ties correct; race-safe INSERT…ON CONFLICT + trip FOR UPDATE;
    MoMo FAILURE/PENDING codes pinned to Issue 004 spec; VND-currency-then-amount guard order;
    underpay rejects with no transition, overpay flags post-commit refundOut; PaymentEvent
    @@unique([adapter,providerTxnId]) + monotonic status guard idempotent; I7 price server-derived
    (`t.price * h.ticketCount` in SQL), no client price.
  - LEDGER / PAYOUT (lib/ledger, app/api/op/payouts, app/api/admin/finance): BigInt throughout;
    appendLedgerEntry P2002-idempotent on sourceEventId; withdrawal locks Operator row FOR UPDATE
    before balance read + payout_debit under deterministic sweep key (double-debit safe);
    refund_out excluded from balance via explicit IN-list (not negation); admin finance routes
    require TOTP + role + step-up + audit.
  - SESSION TOP-OF-STACK (pay/profile/otp/op-client fixes): no `'use client'` → `@/lib/auth`
    barrel leak (greppable CI guard returns zero); server-action bound-arg correct; profile
    dirty-tracking sends only changed fields; optionalPhoneSchema ''→undefined server-side; OTP
    test-sink globalThis-dedup; account routes behind requireCustomerAuth.

SUMMARY: 1 P1, 2 P2, 0 P3

RECOMMENDED NEXT STEPS:
  → P1 (otpProof replay): smallest, highest-value fix in this PR — add 'otp_proof' to
    JTI_REQUIRED_PURPOSES + route through verifyOtpProof. ~10-line change, closes a documented
    security regression. Do before merge OR document the deliberate exemption.
  → P2s (payout-verify atomicity, charter notify swallow): low-risk; can ride this PR or a fast follow.
  → Risk paths are otherwise remarkably clean — the per-issue QA discipline (Mistake Log) shows.
