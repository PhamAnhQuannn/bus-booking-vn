CODE REVIEW — PR #322 "fix(payments): bank_transfer webhook matched wrong-case bookingRef → every transfer no-op" @ 9b0a580
────────────────────────────────
Diff scope: 3 files, +33 / -10 lines
Base: master · Head SHA: 9b0a580

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  (none)

SUMMARY: 0 P1, 0 P2, 0 P3

Category notes (verified clean):
  • Cat 1 Correctness (payment path) — the fix rebuilds `BB-${m[1]}-${m[2].toLowerCase()}-
    ${m[3].toLowerCase()}`. m[1] is `\d{4}` (year, no case); segments lowercased to match the
    stored base36; `BB-` prefix restored. This EXACTLY equals generateBookingRef's output
    (`bookingRef.ts:40`) and satisfies BOOKING_REF_REGEX (`^BB-`). Resolves the case-mismatch
    findUnique miss; introduces no new mismatch (uppercase prefix is the canonical stored form).
  • Cat 2 Security — no auth/secret/injection change. orderRef flows into a parameterized Prisma
    findUnique, never raw SQL. Trust boundary unchanged.
  • Cat 3 Failure — no new external call or catch; pure string reconstruction.
  • Cat 4 Test coverage (risk path) — STRONG. The flipped assertions exercise the `BB-` output on
    the plain/hyphen-strip/space-separator memos, and a NEW regression guard feeds a real
    generateBookingRef() value (hyphens stripped, as the bank delivers) and asserts the adapter
    reconstructs the exact stored ref AND that it passes BOOKING_REF_REGEX — so a lowercase
    regression can never green again. 71 payment tests pass.
  • Cat 5/6 — naming/readability fine; no console/debugger/.only; no hygiene issues.
  • CLAUDE.md Mistake Log — this diff RESOLVES the "fixtures encode the same wrong assumption on
    both sides" pattern (the fix + the round-trip guard break that symmetry). No violation.

RECOMMENDED NEXT STEPS:
  → No blocking findings. Safe to merge on the code-review axis.
  → Follow-up (separate PR, noted in the PR body): reconcilePayments recoverEvent uses MoMo's
    resultCode — broken for bank_transfer recovery.
