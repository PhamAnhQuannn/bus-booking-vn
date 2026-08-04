SECURITY-DEEP REVIEW (FINAL / ROUND 3) — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)"
──────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/324
Base/Head: master ← fix/bank-transfer-reconcile-orphan @ 1365cc4f
Prior:     round 1  docs/qa/security-deep-pr324-20260723.md    (pinned 0435fe17)
           round 2  docs/qa/security-deep-pr324-20260723-r2.md (pinned 320b7dc0)
Delta r2→r3: 320b7dc → 1365cc4 `fix(payments): bound the suspected-payment hold so it cannot starve the sweeper`
Decision:  (none — no review submitted)  ·  State: OPEN  ·  Draft: no
Generated: 2026-07-24T00:00:00Z

Scope note: LIVE money rail. `PAYMENTS_STUB=false` in prod, SePay bank transfer is the
primary Phase-1 method, cron cadence `*/15 * * * *`. This round audits ONLY the commit-3
delta (54 lines of source, 48 of test) against the P1 that r2 raised, plus its new blast radius.

Findings: 4  (P1: 0 · P2: 2 · P3: 2)
Prior-P1 ledger: 3 RESOLVED · 0 OPEN

---

PRIOR-P1 DISPOSITION (verified in code at 1365cc4, not taken on the commit message)

  R1-P1  Degraded match auto-pays under ambiguity ................... RESOLVED (unchanged since 320b7dc)
  R1-P2b Orphan claim never released → ledger absorption ............ RESOLVED (unchanged since 320b7dc)
  r2-P1  Suspicion-hold is permanent → sweeper starvation .......... RESOLVED by commit 3 (24h bound)

  R1-P1 / R1-P2b: commit 3 does not touch the confirming/paid path (reconcilePayments.ts
  336-440) at all. `confirming` is still `linked.find(isConfirming) ?? null` (line 336,
  LINKED-only), `matchDegraded`'s return is still bound to a separate `suspected` local
  (line 458) that is only logged — never promoted to a payment, never claims the orphan.
  The paid transition and `appendBookingPaidLedger` remain unreachable from an orphan.
  Both stay closed.

  r2-P1: the hold is now bounded. `heldForMs = now - booking.createdAt` (line 460); the
  `continue` that perpetuated the hold now fires ONLY while `heldForMs <
  SUSPECTED_HOLD_MAX_AGE_MINUTES*60_000` (24h, line 461). Past 24h the branch falls
  through to the existing guarded expiry (line 490-515) → `payment_failed_expired`, which
  drops the row out of the `status='awaiting_payment'` candidate set permanently. The four
  legs of the r2 P1 are each closed:
    · Starvation — a held row now leaves the 200-row budget after ≤24h; the candidate set
      drains, so it can no longer be *permanently* starved (residual transient contention → P2-A).
    · Log volume — the per-tick `warn` is now bounded to ≤~96 emissions/booking (24h ÷ 15min)
      instead of forever; the escalation `error` fires essentially once (the very next claim
      after 24h expires the row, removing it). Bounded.
    · Frozen seats — expiry releases the `awaiting_payment` seat at ≤24h instead of forever.
      The permanent freeze is gone (residual 24h freeze → P2-B).
    · Invisible/health — `rowsAffected` now increments (expiredCount) when a stale hold
      lapses, so a draining tick is no longer indistinguishable from idle for these rows.
  RESOLVED. The permanence that made r2-P1 a P1 is eliminated. What remains is bounded and
  self-healing (below), and is a lower severity by construction.

---

P2 — SHOULD FIX:

  lib/jobs/reconcilePayments.ts:461  ⚠️  P2-A: r2 fix (b) NOT implemented — held rows still
  draw from the shared 200-row CLAIM_LIMIT for up to 24h. Bounds, but does not segment.

    r2 recommended "(a) bound the hold AND (b) exclude held rows from the claim budget …
    (a)+(b) are enough to unblock." Commit 3 shipped (a) only. Consequence: a held booking
    still sorts to the head of `ORDER BY b."createdAt" ASC LIMIT 200` (line 286-287) and
    re-consumes one of the 200 slots on every tick for its entire 24h life. The vector is no
    longer *permanent* (that is the P1 fix), but transient contention survives.

    QUANTIFIED — does 24h merely delay starvation? No permanent starvation, but a bounded
    contention window remains. To hold the budget at 200 you now need ~200 concurrent
    suspected holds inside a rolling 24h window, i.e. a sustained arrival of ~8.3
    held-AND-in-window bookings/hour. At family-operator Phase-1 volume (1–2 buses, low
    orphan rate, low same-fare density) this is single-digit holds — nowhere near 200, so
    practically closed. Under the adversarial flood of P2-B it is reachable, but it now
    SELF-HEALS: the oldest holds expire at 24h and free their slots, so the worst case is
    *degraded throughput for a bounded interval*, not a wedged sweeper. Down from "outage"
    to "backpressure."

    Fix (r2 (b), still one predicate): segment the claim so held rows can't crowd out fresh
    recoveries — e.g. a `paymentReviewAt` sentinel column and
    `AND ("paymentReviewAt" IS NULL OR "paymentReviewAt" > NOW() - INTERVAL '24 hours')`,
    or a separate quota for suspected rows. Not blocking at current volume; do it before any
    real bank-transfer scale.

  lib/jobs/reconcilePayments.ts:461 (+ createCashBooking.ts:117-124)  ⚠️  P2-B: NEW abuse
  surface — the 24h bound weaponizes into a bounded seat-freeze DoS, ~72–96× longer per
  action than the pre-existing hold TTL.

    An `awaiting_payment` bank_transfer booking counts toward trip capacity with no time
    bound (createCashBooking.ts:117-124). Pre-PR its seat released once the ~15–20 min hold
    lapsed and the next sweeper tick expired it — a ~15–20 min freeze per abandoned booking.
    Post-PR, any abandoned booking for which `matchDegraded` finds a fitting orphan is held
    for 24h before expiry. That is a ~72–96× increase in freeze duration per booking, and a
    single orphan pins a whole cohort: every same-fare `bank_transfer` booking whose
    `holdCreatedAt` sits within ±30 min of the orphan's `receivedAt` (a 60-min-wide,
    single-fare cohort) is frozen for 24h.

    Attack: create N abandoned bookings at a trip's modal fare, then land ONE small transfer
    at that fare inside the window (or wait for a natural orphan — SePay notifies on every
    credit, so orphans occur without any attacker). Every booking in the cohort freezes its
    seat for 24h instead of ~15 min. To lock a 40-seat bus the attacker needs 40 same-fare
    abandoned bookings plus one in-window deposit.

    Materially worse than the pre-existing 10–15 min TTL? In DURATION yes (~100×) — but the
    economics blunt it: (1) it needs a real credit to the merchant account in-window, and
    that credit is an UNMATCHED ORPHAN the merchant KEEPS — the attacker is literally paying
    the operator to freeze seats; (2) booking creation is per-IP rate-limited
    (holds/route.ts:35, bookings/initiate/route.ts:51) and holds are capped
    CONCURRENT_HOLD_CAP=5/phone; (3) it SELF-HEALS in 24h, and near-term trips depart before
    the window elapses. Net: a real, bounded inventory-DoS that is worse in duration than the
    old TTL but self-limiting and self-funding-against-the-attacker. P2, not P1.

    Fix: r2 recommendation (c) — add `ev.receivedAt >= booking.createdAt` to `matchDegraded`
    (line 218+) so a transfer that landed before the booking existed can't pin it (halves the
    ±30 min window / blast radius, one line); and (e) make the cash-path capacity check
    time-bound like the online path so a held seat can't freeze past the transfer window.

---

P3 — ADVISORY:

  lib/jobs/reconcilePayments.ts:490-500  ℹ️  P3: escalated expiry silently depends on
  `holdExpiresAt !== null`; a hold-less suspected booking would loop on the ERROR log, not
  expire. Unreachable today — robustness note only.

    After the 24h escalation the branch falls through to `holdExpired = booking.holdExpiresAt
    !== null && booking.holdExpiresAt <= now; if (!holdExpired) continue;` (line 494-500). If
    `holdExpiresAt` were null the booking would NOT expire — it would re-fire the new
    `logger.error` every tick forever and re-introduce exactly the starvation/log-volume the
    commit set out to kill (just via the error branch). Verified NOT reachable: `matchDegraded`
    anchors on `holdCreatedAt ?? createdAt` and so does NOT require a hold, but every
    `bank_transfer` `awaiting_payment` booking is minted through `initiateOnlineBooking` with
    a mandatory `holdId`, and `Hold` is `onDelete: Restrict` (schema.prisma:370), so the LEFT
    JOIN always resolves a non-null `holdExpiresAt`. The escalation therefore always expires in
    practice. Left as P3 because the sweeper does not defend the invariant itself: a future
    code path that produced a hold-less `awaiting_payment` bank_transfer row would silently
    turn the escalation into a permanent error-loop. Cheap guard: in the elapsed branch,
    expire on `holdExpiresAt <= now OR holdExpiresAt IS NULL` (once past 24h the hold's
    presence is irrelevant), or assert the invariant.

  lib/jobs/reconcilePayments.ts:510-533  ℹ️  P3: lapse-expiry closes a probably-paid booking
  into a terminal state and sends the buyer an "expired" SMS — money-SAFE, but a
  customer-harm/ops gap with no runbook.

    Money safety of the lapse — CONFIRMED CLEAN on every axis the task asked:
      · The orphan PaymentEvent is NOT deleted — the expiry branch is only `UPDATE "Booking"
        SET status='payment_failed_expired'` + a notification enqueue (line 510-533). No
        DELETE, no UPDATE touches PaymentEvent; `bookingId` stays NULL. The evidence-of-money
        row survives, exactly as the commit intends.
      · No ledger entry is fabricated — the expiry path never calls `appendBookingPaidLedger`
        (that lives only under `confirming`, line 377, unreachable from an orphan). Money is
        conserved: it sits as an unmatched credit the merchant holds, refundable/reconcilable
        by hand. No double-count, no phantom credit.
    So NO new money-SAFETY issue. The residual is product/ops, not safety: `payment_failed_
    expired` is terminal (transitions.ts), so once the real payer's booking lapses at 24h it
    can no longer be confirmed-to-paid — the only remedy is manual refund + rebook — and that
    payer receives a `customerBookingExpired` SMS despite having paid. This is the deliberate
    "money-safety over convenience" tradeoff, but it needs the operator runbook the schema/
    code comments keep implying ("orphan PaymentEvent remains as evidence", "flag for manual
    reconciliation") and which does not exist. Fix: write the unresolved-orphan reconciliation
    runbook (who watches `reconcile.unmatched_payment_unresolved`, how to refund from an orphan
    row) as the human-facing half of this bound; consider suppressing/altering the "expired"
    notice when a fitting orphan exists.

---

VERIFIED CLEAN AT 1365cc4 (re-checked this round, no finding):

  · Cat 6 PII in the NEW error log (line 477-486): emits `bookingRef`, `paymentEventId`,
    `providerTxnId`, `amountVnd`, `heldForHours` — identical safe field set to the warn line
    r2 cleared, plus an integer hour count. NO payer name, NO `rawBody`, NO buyer phone. Clean.
  · Cat 1 crypto: no crypto, hashing, cipher, or randomness on the commit-3 delta.
  · Cat 2 / Cat 5: no new endpoint, method, upload, redirect, raw-SQL-with-user-input, or
    authz surface. The delta is entirely inside the cron-gated sweeper loop.
  · Cat 3 rate-limit: no new external/paid action; the only abuse surface is the seat-freeze
    (P2-B) and budget contention (P2-A).
  · Cat 4 audit-log: PaymentEvent remains this domain's audit row and is untouched; the new
    error log strictly INCREASES traceability on the one path that closes a probably-paid
    booking.
  · The new unit test (test:392-431) actually exercises the bound — same orphan, booking aged
    past 24h → asserts `mockApplyPaid` NOT called (never pays on a guess), the expire UPDATE
    ran once, and the escalated `error` fired. Commit message reports it fails when the bound
    is removed. Independent evidence the drain works, not a tautology.

CARRIED FROM r2 — OUT OF COMMIT-3 SCOPE, STILL OPEN (unchanged, not re-litigated here):
  · P2 (r2) webhook rate-limit / content-length gate on `/api/payments/bank_transfer/webhook`
    — pre-existing code, still open; P2-B above makes an orphan flood a more direct availability
    lever, reinforcing r2's "content-length gate is now load-bearing" note.
  · P3 (r2) `rawBody` absent from logger + Sentry redact lists (processWebhook.ts:129-133).
  · P3 (r2) orphan-PII locatability gap for erasure requests.
  · P3 (r2) live VietQR account number in test fixture.

---

RECOMMENDED NEXT:
  - Commit 3 correctly closes r2-P1: the hold is bounded, verified in code and by a real test,
    and no prior P1 regressed. The money-theft and ledger-absorption vectors from rounds 1–2
    stay shut. No P1 remains — this HEAD is mergeable on the money question.
  - Before real bank-transfer scale, land r2 (b) [P2-A: segment the claim budget] and r2 (c)
    [P2-B: `receivedAt >= createdAt`] — both small, both shrink the residual DoS/contention.
  - P3 (holdExpiresAt-null guard) is a one-clause hardening; P3 (reconciliation runbook) is the
    human half this whole design leans on and should exist before go-live.
  - Fold the still-open r2 carries into follow-up issues; none block this PR.

SUMMARY: 0 P1 · 2 P2 · 2 P3 · pinned to 1365cc4 · prior P1s: R1-P1 RESOLVED, R1-P2b RESOLVED,
r2-P1 RESOLVED (permanence eliminated; bounded self-healing residuals downgraded to P2).
