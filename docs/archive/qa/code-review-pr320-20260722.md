CODE REVIEW — PR #320 "fix(payments): SePay bank-transfer go-live — Apikey auth, memo hyphen-strip, 15m window" @ 4eea40ef
────────────────────────────────
Diff scope: 12 files, +289 / -58 lines
Base: master · Head SHA: 4eea40ef2a52fb3e3026656d4c422d5dd5aac3be

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [CORRECTNESS / REGEX] lib/payment/adapters/bankTransfer.ts:42
    EXTRACT_REGEX is now more permissive (`[-\s]?` between segments). A memo
    containing `BB` + 4 digits + 8 base36 chars in sequence matches even without
    separators. Practically safe: no ReDoS (fixed-length classes, no nested
    quantifiers), and a spurious match resolves to a non-existent ref → 200 no-op
    (processWebhook finds no booking). Amount + booking-existence gates remain.
    Accepted as the intended tolerance for VN memo hyphen-stripping.

  [SEED SCRIPT / COMPLETENESS] scripts/prod/seed-test-trip.ts:60
    The seeded test Operator has no PayoutAccount / OperatorUser. Booking + paid
    transition work (LedgerEntry keys only on operatorId, which exists), but the
    T+3 payout job for the test booking may later no-op/error for lack of a payout
    account. Harmless for the payment-confirm test; note before running payouts.

SUMMARY: 0 P1, 0 P2, 2 P3

Category notes (verified clean):
  • Cat 1 Correctness — auth regex anchored (`^…$`), key captured with `.+` (rejects
    empty key). Window threshold 15 > hold TTL 10 (holdRepo.ts:30). orderRef rebuilt
    from capture groups to canonical `bb-YYYY-xxxx-xxxx` — matches DB lookup.
  • Cat 2 Security — auth compared via crypto.timingSafeEqual (constant-time) with a
    length pre-check. No secret literals (SEPAY_API_KEY only referenced via env).
    Regex widened to accept `Apikey`|`Bearer` only — intentional, `Basic` rejected
    (tested). Seed script writes to prod DB but is a CONFIRM_SEED-gated manual CLI,
    not an HTTP surface (mirrors purge-demo-catalog.ts).
  • Cat 3 Failure — ack passes non-2xx through untouched so SePay retries correctly;
    2xx re-emitted as {"success":true}. Seed script main().catch → exit(1), pool.end
    in finally.
  • Cat 4 Test coverage — new auth branch tested (Apikey accepted, Basic rejected,
    ack shape); memo hyphen-strip + space-separator branches tested; reconcile
    threshold covered by existing 40-min fixture. 33 payment tests green.
  • Cat 5/6 Hygiene — no console.log in product code (seed script console is intended
    CLI output), no debugger/.only, no dead exports, PII placeholder gitleaks-safe.
  • CLAUDE.md Mistake Log — this diff RESOLVES the 2026-07-21 SePay entry (Apikey auth
    + {"success":true} ack), does not repeat any logged pattern. No schema/migration.

RECOMMENDED NEXT STEPS:
  → No blocking findings. Safe to merge on the code-review axis.
  → P3s are advisory; fold into follow-up if desired (neither blocks the prod fix).
