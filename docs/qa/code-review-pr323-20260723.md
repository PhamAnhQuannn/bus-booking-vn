CODE REVIEW — PR #323 "test(payments): lock the bank_transfer ref round trip + in-adapter guardrail" @ f72a8c72
────────────────────────────────
Diff scope: 4 files, +204 / -0 lines
Base: master · Head: f72a8c72

PRIORITY 1 — Block push, fix first:
  (none)
PRIORITY 2 — Fix before merge:
  (none)
PRIORITY 3 — Address when convenient:
  (none)

SUMMARY: 0 P1, 0 P2, 0 P3

Category notes (verified clean):
  • Cat 1 Correctness — the guardrail `if (!BOOKING_REF_REGEX.test(orderRef)) return {ok:false,
    reason:'no_booking_ref_in_memo'}` is sound: given EXTRACT_REGEX constraints the rebuilt ref
    already satisfies the canonical regex, so it never falsely rejects a valid memo; it only trips
    on future drift. The int test drives the REAL processPaymentWebhook → findUnique and asserts
    paid + 1 PaymentEvent + 2 LedgerEntry; verified it FAILS on the reverted (buggy) adapter and
    passes on the fix. Control test proves DB case-sensitivity.
  • Cat 2 Security — none. Guardrail is defensive; int test seeds test-only data.
  • Cat 4 Test coverage (risk path) — this IS the coverage: closes the exact live-DB round-trip
    blind spot that let Bug A ship. Strong.
  • Cat 6 Hygiene — no console/debugger/.only; int-test Date.now() for a unique providerTxnId is
    fine in a test; +0 deletions (pure additions).
  • CLAUDE.md Mistake Log — this diff logs Bug A + adds the guard; resolves the pattern, no violation.

RECOMMENDED NEXT STEPS: No blocking findings. Safe to merge.
