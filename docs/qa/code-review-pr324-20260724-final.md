CODE REVIEW (FINAL / ROUND 3) — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)" @ 1365cc4f
────────────────────────────────
Diff scope (vs master): 16 files, +987 / -82 lines
Round-3 delta (320b7dc..1365cc4): 2 files, +96 / -6 — one commit,
  `1365cc4 fix(payments): bound the suspected-payment hold so it cannot starve the sweeper`
Base: master · Head: fix/bank-transfer-reconcile-orphan · Mode: PR (read-only)
Reviewed: 2026-07-24
Prior reports: code-review-pr324-20260723.md @ 0435fe17 (round 1),
               code-review-pr324-20260723-r2.md @ 320b7dc0 (round 2)

Scope note: line-level only. Commit 3 is the only new material; commits 1–2 were
reviewed twice and their fixes re-confirmed unchanged at HEAD. Re-ran
`pnpm vitest run lib/jobs/__tests__/reconcilePayments.test.ts` → 14/14 pass.


─────────────────────────────────────────────────────────────────────────
PRIOR P1 DISPOSITION — both remain RESOLVED
─────────────────────────────────────────────────────────────────────────

  R1 P1  wrong-payee auto-pay from a guessed match (bankTransfer / sweeper)
      → RESOLVED and NOT regressed by commit 3. The lapse path added in commit 3
        does NOT claim the orphan and does NOT pay: it falls through to the
        branch-(b) expire, and the new unit test asserts `mockApplyPaid` is never
        called on the lapse. `matchDegraded` remains a suspicion finder; no CAS
        claim exists anywhere in the file (grep confirms the only PaymentEvent
        write was removed in commit 2 and stays removed).

  R2 P1  suspicion-hold had no drain → starvation + invisible + frozen seats
      → RESOLVED by commit 3. This commit exists specifically to close it.
        `SUSPECTED_HOLD_MAX_AGE_MINUTES = 24*60` bounds the hold: once
        `now - booking.createdAt >= 24h`, the booking expires through the same
        guarded monotonic UPDATE branch (b) instead of holding forever.
        - Starvation loop is genuinely CLOSED, not merely delayed (see below):
          an expired booking leaves the `status='awaiting_payment'` candidate
          set permanently, freeing its slot in the `ORDER BY createdAt ASC
          LIMIT 200` budget. Accumulation is bounded to a rolling 24h, not
          monotonic-forever.
        - Frozen-seat concern (createCashBooking counts awaiting_payment with no
          time bound) is bounded to 24h — the seat is released at expiry.
        - The error escalation at lapse fires once per booking as it crosses the
          threshold (next tick it is no longer a candidate), so it is a
          closure signal, not per-tick spam.


─────────────────────────────────────────────────────────────────────────
COMMIT 3 — VERIFIED CORRECT
─────────────────────────────────────────────────────────────────────────

  ✔ Bound math is correct and consistent. `heldForMs = now - booking.createdAt`;
    `< MAX*60_000` holds, `>=` expires. Boundary at exactly 24h expires (no
    off-by-one on a money path). The bound anchors on `booking.createdAt`, the
    SAME column the candidate query filters/orders on (`createdAt < thresholdAt`,
    `ORDER BY createdAt ASC`), so "oldest candidate" and "past the hold bound"
    are measured against one clock — the drain provably targets exactly the rows
    that head the starvation ordering. (The ±30min match window separately
    anchors on `holdCreatedAt ?? createdAt` — a different, correct purpose.)

  ✔ Lapse path reuses the unchanged guarded expire. After the error log there is
    no `continue`; control reaches the branch-(b) monotonic UPDATE at line 510
    (`status IN (legalPredecessors('payment_failed_expired'))`, issue-034
    single-source map). No claim, no pay, no ledger write — the double-credit and
    wrong-payee fixes from commits 1–2 are untouched. A row that raced to paid via
    a concurrent webhook matches 0 rows and is never regressed.

  ✔ Orphan PaymentEvent survives the lapse as evidence. The expire UPDATE touches
    only "Booking"; the orphan row (bookingId still NULL) is never modified or
    deleted, so the bank-statement-triage artifact the whole PR exists to preserve
    stays on file. This is asserted implicitly (no delete) and stated in the code
    comment.

  ✔ Escalated `error` level is appropriate. This is the one place a booking whose
    money PROBABLY arrived is force-closed; error (vs the held-state warn) is the
    right level for a single, actionable, terminal event, and it carries
    `heldForHours` for triage.

  ✔ Test quality is sound and independent. `SUSPECTED_HOLD_MAX_AGE_MINUTES` is
    IMPORTED from source (not re-typed) and used to derive the stale `createdAt`,
    so the test tracks the constant automatically. The orphan is re-anchored to
    sit inside the ±30min window around the stale timestamp (otherwise the test
    would pass for the wrong reason). It pins the full contract: not paid
    (`mockApplyPaid` not called), expired (`$executeRaw` called once,
    `rowsAffected: 1`), and closure logged (`mockLogger.error` with
    `unmatched_payment_unresolved`). Removing the bound flips the booking back to
    held → `$executeRaw` 0 calls → test fails, exactly as the commit message
    claims. The sibling "still expires when NO orphan fits" control is retained.


─────────────────────────────────────────────────────────────────────────
PRIORITY 1 — none
─────────────────────────────────────────────────────────────────────────

  Commit 3 introduces no P1. Both prior P1s are resolved; the whole PR now hangs
  together as a coherent "detect, hold briefly, then expire with evidence
  retained" design.


─────────────────────────────────────────────────────────────────────────
PRIORITY 2 — fix before merge (carried from round 2, untouched by commit 3)
─────────────────────────────────────────────────────────────────────────

  [SECURITY / INPUT VALIDATION — receiving account still never validated]
  lib/payment/adapters/bankTransfer.ts:30, :93
    `payload.accountNumber` is still declared and read NOWHERE (grep: one type
    decl at :30, one doc mention at :11, zero comparisons). `unmatched` is
    populated for any inbound credit on any SePay-connected account. No longer a
    money-movement path, but it is the false-suspicion fuel for the hold: a
    deposit into an unrelated connected account, at a stuck booking's exact fare
    within the window, now pins that booking for 24h AND emits
    `reconcile.unmatched_payment_suspected` telling a human "money arrived for
    this booking" about money that landed elsewhere. Commit 3's 24h bound caps the
    damage but does not remove the misdirection.
    Fix (unchanged, still cheap): gate `unmatched` on
    `payload.accountNumber === getEnv().VIETQR_ACCOUNT_NUMBER` (env.ts:123,
    prod-required, default-rejected at env.ts:407-412), decide `subAccount` policy
    in a comment, cite the SePay payload doc URL at the site, add the negative
    unit test (foreign accountNumber → `unmatched` UNDEFINED). NOTE: adds a
    `getEnv()` edge to the adapter's unit-test module graph — watch Mistake Log
    092b when adding it.

  [PII / RETENTION — orphan rows still outside every cleanup path]
  prisma/schema.prisma:418, lib/jobs/retentionSweeper.ts
    Re-verified at HEAD: `retentionSweeper.ts` has ZERO references to PaymentEvent;
    `anonymizeCustomer.ts` likewise. Orphans carry payer name (`content`),
    `accountNumber`, `gateway`, `referenceCode` in `rawBody` indefinitely, with no
    subject linkage. Commit 3 hardens the "must not auto-delete" constraint (the
    orphan is now the evidence backing the expiry), so a REDACTION arm — not a
    delete — is the only compatible answer: null/redact `rawBody` on
    `bookingId IS NULL AND receivedAt < now() - <policy>` (policy via
    lib/account/retentionPolicy.ts, window well beyond the 30-min match window and
    beyond the 24h hold). The new partial index makes this arm cheap. Filable as a
    follow-up if the deploy is time-boxed, but file it before merge.


─────────────────────────────────────────────────────────────────────────
PRIORITY 3 — address when convenient
─────────────────────────────────────────────────────────────────────────

  [DOC DRIFT — inline comment now contradicts the code it sits above] NEW
  lib/jobs/reconcilePayments.ts:452-456
    The block comment still reads "critically — we do NOT fall through to expiry"
    and "Leave it `awaiting_payment` and flag it for manual reconciliation" — but
    commit 3's whole point is that it DOES fall through to expiry after 24h. The
    top-of-file docstring (lines 28-32) was correctly updated; this inline comment
    was not, so the two now disagree. In a file whose Mistake Log lesson is
    literally "stale framing surviving a fix is the trap that produced the bug",
    this is worth the one-line correction: "…we do not pay and do not claim the
    row; we hold in `awaiting_payment` for up to SUSPECTED_HOLD_MAX_AGE_MINUTES,
    then expire via (b)."

  [CORRECTNESS / LOG ACCURACY — "expiring" is still conditional on holdExpired] NEW
  lib/jobs/reconcilePayments.ts:477-495
    The error log asserts "expiring booking", but the actual expire below is still
    gated on `holdExpired = holdExpiresAt !== null && holdExpiresAt <= now`. For a
    bank_transfer booking this is a non-issue — those bookings are created with a
    NOT-NULL holdId (bookingRepo CreateBookingInput.holdId: string) and the hold
    lapses ~15 min after creation, so at 24h+ `holdExpired` is always true and the
    booking really does expire. But IF a suspected booking ever had a null/future
    `holdExpiresAt`, the error would fire and then `continue` WITHOUT expiring →
    the same log re-fires every tick, now at error level (worse than the warn spam
    the commit set out to bound). Not reachable on the current data model, so P3.
    Fix if desired: compute `holdExpired` before the lapse block and only emit the
    "expiring" error when it is actually true; otherwise emit a distinct
    "held past window but hold still active" line.

  [OBSERVABILITY — closure signal has no alert route]
  lib/jobs/reconcilePayments.ts:477
    `logger.error('reconcile.unmatched_payment_unresolved…')` is the ONLY signal
    that a probably-paid booking was force-expired, and `logger` has no
    Sentry/`captureMessage` hook (only `captureException` on throw paths is
    routed). The design self-heals without a human, so this is P3 not P1 — but the
    money-arrived-then-expired event is exactly what ops wants paged on. Worth
    routing this one error line to the alert channel, or documenting the log query
    in the runbook, before relying on it in prod.

  [PRODUCT DECISION — customer whose money arrived gets an expiry SMS at 24h]
  lib/jobs/reconcilePayments.ts:457-517
    A held booking that lapses falls into branch (b), which enqueues
    `customerBookingExpired`. So a customer whose transfer DID arrive but couldn't
    be matched receives an "expired" SMS 24h later. This is the documented,
    accepted trade-off (better than a permanent silent hold, and the orphan
    evidence lets ops refund/rebook), so it is not a defect — but confirm it is a
    conscious product call and not an oversight, and consider a distinct
    "we're reviewing your transfer" copy for this path.

  Carried unchanged from rounds 1–2 (all still open, all one-to-three lines):
    stale `rawBody`/`currency` on the webhook-side claim (processWebhook.ts:232);
    `recordUnmatchedPaymentEvent` "NEVER throws" has no unit test for either
    swallow arm; no test asserts a momo/vnpay `booking_not_found` writes NO orphan
    (processWebhook.ts:196); `sepayOrphanBody` derives `id:1` for both digit-free
    txn names (int test:57); `verifyWebhook` parsed twice per delivery
    (route.ts:71); the seven MoMo fakeTx mocks hardcoding `updateMany → {count:0}`;
    `matchDegraded` docstring still says "(or cross-linked)" (unreachable);
    partial-index plan never EXPLAIN-verified against a seeded orphan set.


SUMMARY: 0 P1, 2 P2, 4 (+7 carried) P3
  (round 1: 1 P1, 4 P2, 7 P3 · round 2: 1 P1, 2 P2, 8 P3)

Commit 3 is a correct, well-tested, and well-argued close of the round-2 P1. The
bound math is right and anchored on the same column the candidate query uses, so
the starvation loop is provably closed (rows drain out of the candidate set at
24h) rather than merely delayed; the lapse reuses the existing guarded expire so
neither the wrong-payee nor double-credit fix regresses; the orphan survives as
evidence; and the new unit test genuinely fails when the bound is removed. Both
prior P1s are resolved and the PR now hangs together as one coherent flow.

Two P2s remain and are unchanged by this commit — both were already flagged in
round 2 and neither blocks the sweeper's correctness: (1) the receiving-account
input is still unvalidated, which is now the main false-suspicion source, and
(2) orphan PaymentEvents still sit outside every retention/redaction path. Neither
is a merge-blocker for the payment-safety property, but the accountNumber gate is
cheap and materially improves the signal the hold depends on, and the retention
arm should at least be filed before merge. The new P3s are the usual stale-framing
drift this repo's Mistake Log warns about — a two-line comment fix at 452-456.


RECOMMENDED NEXT STEPS:
  → Merge is not blocked on new work: commit 3 adds no P1 and no P2.
  → Land the accountNumber gate (R2 P2) in this PR if time permits — cheapest
    single improvement to the hold's trustworthiness; re-run /code-review after,
    per Mistake Log 092b (new getEnv edge in the adapter's unit graph).
  → File the orphan retention/redaction arm (R2 P2) as a tracked follow-up before
    merge.
  → Fix the 452-456 comment drift in this push — it directly contradicts the code.
  → No round 4 needed on the sweeper: the hold is now bounded, tested, and drains.
