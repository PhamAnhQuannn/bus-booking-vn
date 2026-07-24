SECURITY-DEEP REVIEW (ROUND 2) — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)"
─────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/324
Base/Head: master ← fix/bank-transfer-reconcile-orphan @ 320b7dc0
Round 1:   docs/qa/security-deep-pr324-20260723.md (pinned to 0435fe17) — kept for comparison
Delta:     0435fe17 → 320b7dc `fix(payments): never auto-pay a booking from a guessed payment match`
Decision:  (none — no review submitted)
Generated: 2026-07-24T00:00:00Z

Scope note: LIVE money rail. `PAYMENTS_STUB=false` in prod, SePay bank transfer is the
primary Phase-1 method, cron cadence `*/15 * * * *` (vercel.json:45-47).

Findings: 5  (P1: 1 · P2: 1 · P3: 3)
Round-1 status: 2 RESOLVED · 1 CHANGED SEVERITY (still open) · 3 STILL OPEN

---

ROUND-1 DISPOSITION (verified, not accepted on assertion)

  R1-P1  Degraded match auto-pays under ambiguity ................ RESOLVED
  R1-P2a Rate-limit exemption + unbounded orphan writes .......... STILL OPEN (harm re-characterised)
  R1-P2b Orphan claim never released on paid no-op ............... RESOLVED
  R1-P3a Orphan rows are PII no erasure path reaches ............. STILL OPEN (unchanged)
  R1-P3b Unscrubbed error to Sentry on the rawBody path .......... STILL OPEN (unchanged)
  R1-P3c Live VIETQR account number in a committed fixture ....... STILL OPEN (unchanged)

VERIFICATION OF THE THREE CLAIMS MADE BY ROUND 2

  1. "Nothing writes PaymentEvent in the sweeper." — CONFIRMED.
     `grep -nE 'UPDATE |INSERT |DELETE |\.create\(|\.update|\.upsert|executeRaw'` over
     lib/jobs/reconcilePayments.ts returns exactly three write sites: the candidate claim
     (`FOR NO KEY UPDATE OF b SKIP LOCKED`, line 261 — a lock, not a write), the guarded
     `UPDATE "Booking" SET status = 'payment_failed_expired'` (line 466), and
     `tx.notificationLog.create` (line 519). Every remaining `PaymentEvent` reference is
     a SELECT (line 281) or a comment. The CAS block (`UPDATE "PaymentEvent" SET
     "bookingId" = …  WHERE "bookingId" IS NULL`) is fully deleted, not disabled.

  2. "Only a LINKED event can pay." — CONFIRMED.
     `linked = events.filter(e => e.bookingId === booking.id)` (line 297);
     `confirming = linked.find(e => isConfirming(e, booking.totalVnd)) ?? null` (line 309)
     is a `const` — there is no later reassignment, and `matchDegraded`'s return value is
     bound to a separate `suspected` local (line 431) that is only logged. The paid
     transition at line 313 is therefore unreachable from an orphan. Round-1's P1 attack
     (harvest a victim's blank-memo transfer by keeping a decoy booking alive) no longer
     terminates in `applyPaidStatusTransition` / `appendBookingPaidLedger`. RESOLVED.

  3. "R1-P2b and the ABBA deadlock go away with the claim." — CONFIRMED, both.
     R1-P2b required a committed orphan claim followed by `updated === 0`. With no claim,
     the only event reaching line 318 is one processWebhook already linked by exact
     `(adapter, providerTxnId)` — a row that is by construction this booking's own
     transfer, so `updated === 0` (booking raced to `paid` elsewhere) now means the ledger
     was written by the racing path, not skipped. No absorption remains.
     Lock order: processWebhook takes PaymentEvent (`updateMany … bookingId: null`,
     line 232) → Booking (`applyPaidStatusTransition`, line 291). The sweeper previously
     took Booking (line 261) → PaymentEvent (the deleted CAS) — a true A→B / B→A
     inversion. The sweeper now takes Booking only. Inversion eliminated.

  Round 2 also adds `20260723180000_payment_event_orphan_receivedAt_idx` — a partial
  btree on `("receivedAt") WHERE "bookingId" IS NULL`. Correct call: it bounds the orphan
  scan by row count. It does NOT bound the bytes fetched (see P2), and it does not affect
  the P1 below.

---

P1 — BLOCKING:

  lib/jobs/reconcilePayments.ts:430  🚫 P1: NEW — the suspicion-hold has no drain, no
  operator surface, and no in-app resolution path; accumulated holds head-of-line-block
  the sweeper's fixed 200-row budget and silently re-introduce Bug B.

    Round 2 replaced "guess a winner" with "hold and expire nothing". That is the right
    call on the money question. But the hold is PERMANENT and INVISIBLE, and the sweeper
    is not built to carry permanent candidates.

    (i) A hold never clears by itself. The branch `continue`s while the booking stays
        `awaiting_payment`, which is exactly the claim predicate (line 257). The orphan
        that triggered the match is never claimed and never deleted — prisma/schema.prisma
        instructs operators never to delete one — and the window is anchored on the
        booking's own fixed `holdCreatedAt`. Every input to the match is therefore
        immutable, so a booking held on tick N is held on every subsequent tick, forever.

    (ii) Nothing in the app can resolve one. `grep -rln "applyPaidStatusTransition"`
        over app/api returns no operator or admin route — the only callers are
        processWebhook and this sweeper. `listOperatorBookings.ts:83` filters
        `status: { in: PAID_STATUSES }`, so operators never see an `awaiting_payment`
        booking at all, and app/admin/(console)/ has no booking or PaymentEvent surface
        (finance is payout-queue only). "Held for manual reconciliation" means
        hand-written SQL against production by whoever notices.

    (iii) Nothing notices. The sole signal is `logger.warn(... 'reconcile.unmatched_
        payment_suspected')` — re-emitted for the SAME booking every 15 minutes forever.
        200 held bookings produce ~19,200 identical warn lines per day, indefinitely,
        which makes the one log line that was supposed to be the alert un-alertable and
        buries genuine first-occurrence events. Meanwhile the job's own health metric,
        `rowsAffected = paidCount + expiredCount`, trends to 0 — a fully-starved sweeper
        is indistinguishable from a healthy idle one.

    (iv) Starvation. The claim is `ORDER BY b."createdAt" ASC LIMIT 200`
        (CLAIM_LIMIT, line 88), and `SKIP LOCKED` does not persist between ticks. Held
        bookings are by definition older than everything created after them, so they sort
        to the head and re-consume the budget every tick. At 200 accumulated holds the
        sweeper reaches nothing else: no bank transfer is ever recovered again (Bug B
        returns as a delayed-action failure, in the PR that fixes it) and no
        `awaiting_payment` booking is ever expired again.

    (v) Seats. `createCashBooking.ts:114-121` counts `awaiting_payment` toward capacity
        with NO time bound, unlike the online path, which releases after
        `PSP_WINDOW_MINUTES = 20` (holdRepo.ts:138-146). A held booking therefore
        permanently consumes a seat against operator cash sales on that trip.

    FAILURE SCENARIO — no attacker required, this is the normal case:
      A blank-memo transfer of exactly fare F lands. `matchDegraded` pins EVERY stuck
      booking with `totalVnd === F`, `paymentMethod === 'bank_transfer'`, whose
      `holdCreatedAt` is within ±30 min of `receivedAt`. On a shared receiving account
      with modal fares that is typically several bookings, of which exactly one is the
      real payer; the rest are ordinary abandons that should expire. All of them are now
      held forever, hold their cash-path seats forever, and occupy sweeper budget forever.
      Growth is monotonic and proportional to (orphan rate × same-fare booking density).
      The migration comment added by this same PR states orphans accumulate from ordinary
      non-ticket business deposits too, so the orphan side of that product is not small.

    ATTACKER AMPLIFICATION (cheap, but secondary to the above):
      Booking creation is per-IP rate-limited (`app/api/holds/route.ts:35`,
      `app/api/bookings/initiate/route.ts:51`) and holds are capped at
      CONCURRENT_HOLD_CAP = 5 per phone — but that caps concurrent ACTIVE HOLDS, not
      accumulated `awaiting_payment` bookings, which are unbounded. An attacker who
      continuously creates abandoned bookings at the modal fares needs no payment, no
      account and no key; every naturally-occurring orphan then pins their whole batch,
      driving the count to 200 on the attacker's schedule rather than the market's.
      A holder of `SEPAY_API_KEY` can do it deterministically by posting synthetic
      orphans at each common fare (see P2).

    Honest severity note: this is strictly less severe than round-1's P1 — no money moves
    to the wrong party and no ledger entry is fabricated. It is still P1 because it
    silently disables the recovery mechanism this PR exists to ship, freezes real
    inventory, and has no detection signal that survives its own volume.

    FIX (smallest first; (a)+(b) are enough to unblock):
      a. Bound the hold. Give the branch an exit: a `reconcileHeldAt` / `suspectedAt`
         column (or a `NotificationLog`-style sentinel row) set on first suspicion, and
         (1) log at warn ONLY on the first tick, info/silent after, (2) after N days
         unresolved, escalate — expire with an explicit `manual_review_required` marker,
         or page. Anything that terminates.
      b. Exclude held bookings from the claim budget so they cannot starve the sweeper —
         e.g. `AND ("suspectedAt" IS NULL OR "suspectedAt" > NOW() - INTERVAL '1 day')`,
         or raise/segment CLAIM_LIMIT so held rows draw from a separate quota. Head-of-
         line blocking on a fixed LIMIT with permanent candidates is the core defect.
      c. Close the pre-booking half of the window — add `ev.receivedAt >= booking.createdAt`
         to `matchDegraded` (round-1 recommendation (b), still not applied). A transfer
         that landed before the booking existed cannot be that booking's payment, and
         today it pins it anyway. One line; directly shrinks the false-hold blast radius.
      d. Give it a surface: an operator/admin "unresolved payments" queue listing held
         bookings + windowed orphans, with a confirm/expire action that calls
         `applyPaidStatusTransition`. Without this, (a) has nowhere to escalate to.
      e. Make the cash-path capacity check time-bound like the online path
         (holdRepo PSP_WINDOW_MINUTES) so a held booking cannot freeze a seat forever.

---

P2 — SHOULD FIX:

  app/api/payments/bank_transfer/webhook/route.ts:68  ⚠️  P2: Unbounded orphan-row write
  amplification on a route explicitly exempt from rate limiting — CHANGED SEVERITY
  (still open; harm re-characterised from money-loss enabler to inventory/sweeper freeze,
  and newly aggravated by per-tick re-read).

    Code unchanged since round 1. `proxy.ts:70-75` lists
    `/api/payments/bank_transfer/webhook` in `CSRF_EXEMPT`; `proxy.ts:296-300` returns
    `nextWithRid()` on that SAME Set before `ratelimit.limit(ip)` at line ~305 is ever
    reached. No route-local limiter, no `content-length` gate before `await req.text()`
    (route.ts:68). Auth is a single long-lived static key — no body signature, no
    timestamp, no nonce (route.ts:56-66; the `timingSafeEqual` itself is correct) — so
    the proxy comment's justification ("webhooks authenticate via HMAC and must not be
    edge-rate-limited") is factually wrong for this route. Replay protection is only
    `@@unique([adapter, providerTxnId])`, sidestepped by incrementing `id`.

    Severity direction — assessed both ways, net unchanged at P2:
      DOWN: the secondary consequence round 1 flagged is gone. A key-holder can no longer
      "mint a payment without knowing the bookingRef" by posting a memo-less body at the
      target fare and letting the sweeper attach it — the sweeper will not pay an orphan.
      The money-loss link is severed.
      UP: a flood of orphans is now a direct availability attack via P1. Each synthetic
      orphan at a live fare permanently freezes every matching booking. And each orphan in
      the window is re-read IN FULL, with its `rawBody` TEXT, once per candidate booking
      per tick (reconcilePayments.ts:271-294 selects `pe."rawBody"` and runs inside the
      loop) — up to 200 times every 15 minutes, inside the single advisory-lock
      transaction, forever, because P1 guarantees the candidate set never drains. The
      new partial index bounds the ROWS scanned; it does not bound the BYTES fetched, and
      with no body cap a single 4.5 MB orphan is re-materialised ~200×/tick. That is a
      memory and transaction-duration vector on the cron, not just disk growth.

    Fix (unchanged from round 1, now with a second reason):
      1. Split `CSRF_EXEMPT` into two Sets so the comment stops justifying the wrong thing,
         and apply a per-IP limit to this route (or a route-local `ratelimit.limit(ip)`
         before the body read).
      2. Reject on `content-length` before `req.text()` — a legitimate SePay payload is
         < 1 KB. This is now load-bearing for the sweeper, not only for storage.
      3. Cap/alert on unlinked-orphan row count and age.

---

P3 — ADVISORY (all three carried unchanged from round 1; re-verified at 320b7dc):

  prisma/schema.prisma  ℹ️  P3: Orphan rows create PII no retention or erasure path reaches.
    STILL OPEN, unchanged. Re-verified: `grep -n "PaymentEvent" lib/jobs/retentionSweeper.ts
    lib/jobs/anonymizeCustomers.ts lib/account/*.ts` returns nothing. A SePay `rawBody`
    carries the payer's name in free text; an orphan has no `customerId` and no
    `bookingId`, so a PDPL/GDPR erasure request has no key to locate it. ADR-008 permits
    long financial retention and DS-015:196 already excludes PaymentEvent from DSAR
    export, so this is a locatability gap, not a policy violation.
    P1 interacts: round 2 makes orphans strictly longer-lived (they are never claimed
    now, so `bookingId` stays NULL indefinitely rather than being linked on match).
    Fix: age-out that scrubs `rawBody` to the reconciliation-critical fields
    (`transferAmount`, `transferType`, `transactionDate`, `referenceCode`) and drops the
    payer free text; write the operator runbook the schema comment implies exists.

  lib/payment/processWebhook.ts:129-133  ℹ️  P3: Raw third-party error text logged and an
  unscrubbed error object sent to Sentry on the one path whose entire input is `rawBody`.
    STILL OPEN, unchanged. `logger.error({ …, err: err instanceof Error ? err.message :
    String(err) }, …)` and `captureException(err, …)` both fire inside
    `recordUnmatchedPaymentEvent`. `grep -n rawBody lib/logger.ts lib/observability/sentry.ts`
    → no match: `rawBody` is still absent from both redact lists, contradicting the file
    header's own "NEVER log … raw webhook body" and the CLAUDE.md rule that a new
    sensitive field lands on the redact list in the same commit.
    Fix: add `'rawBody'` + `'*.rawBody'` to `loggerOptions.redact.paths` and to
    `REDACT_KEYS` in sentry.ts; log `err.code` instead of `err.message` here.

  lib/jobs/__tests__/reconcilePayments.test.ts:329  ℹ️  P3: Live VietQR receiving account
  number in a committed fixture.
    STILL OPEN, unchanged (line moved from 311 → 329 by the round-2 test rewrite).
    `grep -rn 030027766656` → lib/config/env.ts:123 (the `VIETQR_ACCOUNT_NUMBER` default),
    env.ts:406, and this fixture. `accountNumber` is on the project's own redact list as
    sensitive PII (Issue 078). Disclosure harm is low — it is the merchant's own inbound
    account, already printed on every customer QR — but the fixture normalises the pattern.
    Fix: masked placeholder in fixtures (the sibling int fixture's `030976167267` is
    already non-production).

---

VERIFIED CLEAN AT 320b7dc (attack surfaces re-checked this round, no finding):

  · No new endpoint, no new HTTP method, no authz-surface change. `recordUnmatchedPaymentEvent`
    still has exactly two callers, both behind the API-key check executed before
    `req.text()`; `recoverSepayEvent` is reached only from the cron-gated sweeper.
    (Cat 2 / Cat 5 clean.)
  · Cat 1 crypto: no crypto introduced or altered by the round-2 delta. The pre-existing
    key comparison length-checks before `crypto.timingSafeEqual`. No hashing, cipher or
    randomness on any changed path.
  · Cat 3 rate-limit: the only new abuse surface is the sweeper's candidate budget (P1);
    the webhook exemption is P2. Booking-creation endpoints remain limited.
  · Cat 4 audit-log: `PaymentEvent` is this domain's audit row and the PR still strictly
    increases coverage. The round-1 gap (silent `updated === 0` with no log) survives at
    reconcilePayments.ts:318-411 but is now benign — `confirming` is LINKED-only, so
    `updated === 0` means a concurrent path already applied the transition AND its ledger.
    Worth a `logger.info` for traceability; not a finding.
  · Cat 6 PII in new logs: the suspicion warn (line 433-441) emits `bookingRef`,
    `paymentEventId`, `providerTxnId`, `amountVnd` — no payer name, no `rawBody`, no
    buyer phone. Correct field selection. (Its VOLUME is the problem, filed under P1(iii).)
  · Enumeration: unchanged and still clean — every branch of the bank_transfer route exits
    via `sepayAck()` → 200 `{"success": true}`, byte-identical.
  · Poisoning the sweeper with a non-payment: still gated by `transferType === 'in'` +
    positive amount in the adapter before an orphan is recorded.
  · Migration `20260723180000`: `CREATE INDEX … WHERE "bookingId" IS NULL` is a plain
    partial btree; correctly SQL-only (Prisma DSL cannot express a partial index), so
    schema↔DB parity holds. Not `CONCURRENTLY`, which is right — it runs in the migration
    transaction while the table is small, as the comment states.
  · Migration `20260723120000` (`ALTER COLUMN "bookingId" DROP NOT NULL`) is catalog-only
    on PG16; the FK is still `onDelete: Restrict` in both SQL and schema.prisma, so a
    deleted booking's event cannot decay into a matchable orphan.

---

RECOMMENDED NEXT:
  - Round 2 fixed the right thing: R1-P1 and R1-P2b are genuinely gone, verified at the
    code level, not taken on the commit message's word. The money-theft vector is closed.
  - The new P1 is the mirror image of the old one — round 1 was "the sweeper decides too
    much", round 2 is "the sweeper decides nothing and never lets go". Fixes (a) bound the
    hold and (b) keep held rows out of the 200-row budget are both small and self-contained;
    (c) is one line and shrinks the blast radius on its own. Ship at least a+b+c before merge.
  - P2 is unchanged code but is now load-bearing for P1's severity (orphan flood → hold
    flood → sweeper starvation). The `content-length` gate is a two-line change.
  - P3b (`rawBody` on the redact lists) is one line and the project's own rule says it
    lands with the field that introduced it.

SUMMARY: 1 P1 · 1 P2 · 3 P3 · pinned to 320b7dc · round-1: 2 RESOLVED, 1 CHANGED, 3 OPEN
