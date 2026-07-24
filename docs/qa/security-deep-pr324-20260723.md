SECURITY-DEEP REVIEW — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)"
─────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/324
Base/Head: master ← fix/bank-transfer-reconcile-orphan @ 0435fe17
Decision:  (none — no review submitted)
Generated: 2026-07-23T23:19:33Z

Scope note: LIVE money rail. `PAYMENTS_STUB=false` in prod and SePay bank transfer is
the primary Phase-1 payment method, so every finding below is reachable in production
the moment this merges.

Findings: 6  (P1: 1 · P2: 2 · P3: 3)

---

P1 — BLOCKING:

  lib/jobs/reconcilePayments.ts:178  🚫 P1: Degraded match auto-pays under ambiguity — free-ticket harvest of another customer's unmatched transfer.
    `matchDegraded()` selects an orphan on (exact `totalVnd` + `adapter` + ±30 min around
    `holdCreatedAt`) and returns the FIRST qualifying row; the caller (reconcilePayments.ts:299)
    CAS-claims it and marks the booking `paid`. The CAS claim makes the payout ONE-SHOT but it
    does not make it CORRECT — it simply awards the money to whichever stuck booking the
    `ORDER BY b."createdAt" ASC` loop reaches first. Under one shared receiving account across
    all operators, none of the three predicates is unique to a booking.

    Before this PR the branch was dead code (orphans could not exist — `bookingId` was NOT
    NULL and both ack sites returned before any insert). This PR makes it live, so the vector
    is newly introduced by #324 even though the matcher predates it.

    FAILURE SCENARIO (no API key, no privileged access required):
      1. Attacker keeps one 1-ticket booking alive at the modal fare F (`awaiting_payment`,
         re-created every ~15 min so it is always inside the sweep candidate set and always
         has the earliest `createdAt` among same-fare candidates).
      2. Victim books the same fare F and bank-transfers F with a memo the bank mangled past
         `EXTRACT_REGEX` (or never typed) → orphan PaymentEvent written by the new
         `no_booking_ref_in_memo` path in app/api/payments/bank_transfer/webhook/route.ts:78.
      3. Next sweep tick: attacker's booking is first in `createdAt ASC`, amount matches
         exactly, adapter is `bank_transfer`, orphan `receivedAt` is inside ±30 min of the
         attacker's hold → attacker CAS-claims it, `applyPaidStatusTransition` runs,
         `appendBookingPaidLedger` credits the operator, attacker gets a valid ticket.
      4. Victim's booking finds no orphan (claimed), hold has lapsed → `payment_failed_expired`,
         which is TERMINAL. Victim's real money is gone and attributed to the attacker's seat.
    Cost to attacker: zero. Payoff: a ticket plus a denial-of-payment against the victim.
    The PR's own integration test (`lib/jobs/__tests__/reconcilePayments.int.test.ts` — "one
    transfer pays exactly ONE of two same-amount bookings") documents the ambiguous case and
    asserts that the earliest booking wins, i.e. picking a winner under ambiguity is a
    deliberate design choice, not an oversight. That choice is the vulnerability.

    Exploitability caveat, stated honestly: the attacker cannot manufacture the victim's
    orphan; they can only harvest one opportunistically. Base rate depends on how often VN bank
    memos arrive unparseable — but that rate is precisely the reason this feature exists, so it
    cannot be assumed low.

    FIX (cheapest option first):
      a. ABSTAIN ON AMBIGUITY. Before claiming, count the stuck bookings that would qualify for
         the same orphan (same `totalVnd`, adapter in `usedAdapters`, window overlapping the
         orphan's `receivedAt`). If > 1, do not claim — leave the orphan for manual
         reconciliation and log `reconcile.degraded_ambiguous`. This alone fully defeats the
         harvest: the attacker's decoy booking is what creates the ambiguity, so their own
         attack blocks the auto-pay. It is a strictly safer default than "first writer wins".
      b. Add `orphan.receivedAt >= booking.createdAt` to `matchDegraded`. A transfer that landed
         before the booking existed cannot be that booking's payment. Today the ±30 min window
         is symmetric around `holdCreatedAt`, so a pre-existing orphan can pay a later booking —
         that half of the window has no legitimate use case and should be closed regardless.
      c. Strongest: route every degraded match to an operator/admin confirmation queue instead
         of auto-transitioning. The money is real; which booking it belongs to is a guess, and
         a guess should not move a booking to `paid` unattended on a live rail.

---

P2 — SHOULD FIX:

  app/api/payments/bank_transfer/webhook/route.ts:78  ⚠️  P2: Unbounded orphan-row write amplification on a route that is explicitly exempt from rate limiting.
    `proxy.ts:75` lists `/api/payments/bank_transfer/webhook` in `CSRF_EXEMPT`, and
    `proxy.ts:296-301` uses that SAME Set to bypass the edge rate limiter — the route returns
    before `ratelimit.limit(ip)` is ever called. The route has no per-route limiter of its own
    and no request-body size cap (`await req.text()` on line 68; only Vercel's 4.5 MB platform
    cap applies).

    Before this PR, an authenticated caller posting bodies with unusable memos produced ZERO
    writes (short-circuit ack). After it, EVERY distinct `payload.id` writes a `PaymentEvent`
    row carrying the full `rawBody` TEXT. Row count is bounded only by the attacker's request
    rate; row size is bounded only by the platform body cap. There is no orphan cap, no age-out,
    no alert threshold, and no retention job that touches `PaymentEvent` at all (see P3 below) —
    and `prisma/schema.prisma:419` explicitly instructs operators never to delete an orphan
    without bank-statement reconciliation, so the table only grows.

    Auth mitigates this: the write is unreachable without `SEPAY_API_KEY` (checked with a
    length pre-check + `crypto.timingSafeEqual` at route.ts:61-66 — that comparison is correct).
    But the exemption's stated justification is wrong in a way that matters here:
    proxy.ts:296-298 says webhooks are exempt because they "authenticate via HMAC and must not
    be edge-rate-limited." SePay does NOT sign the body. This route's credential is a single
    long-lived static bearer key with no body signature, no timestamp, and no nonce — the only
    replay defence is the `@@unique([adapter, providerTxnId])` constraint, which an attacker
    trivially sidesteps by incrementing `id`. So the route is both the weakest-authenticated
    webhook in the exempt Set and now the only one with an unbounded write per request.

    Secondary consequence of the same weakness: a key-holder can now mint a payment for a
    booking WITHOUT knowing its `bookingRef` — post a memo-less body with `transferAmount`
    equal to the target fare and let the sweeper's degraded match (P1) attach it. Previously a
    key-holder needed the exact ref. Rotating the key is not a fix; bounding the writes is.

    Fix: (1) apply a per-IP rate limit to this route specifically — remove it from the
    rate-limit half of the exempt Set and split `CSRF_EXEMPT` into two Sets so the comment stops
    justifying the wrong thing, or add a route-local `ratelimit.limit(ip)` before the body read;
    (2) reject bodies over a few KB before `req.text()` resolves (`content-length` check) — a
    legitimate SePay payload is < 1 KB; (3) add a cap/alert on unlinked-orphan row count and
    row age so runaway growth pages someone instead of filling the volume silently.

  lib/jobs/reconcilePayments.ts:317  ⚠️  P2: Orphan claim is never released when the paid transition no-ops — a real payment is silently absorbed with no ledger entry and no refund.
    The CAS claim at lines 311-316 commits `bookingId = booking.id` on the orphan. Control then
    reaches `applyPaidStatusTransition` (line 332). When that returns `updated === 0` — the
    booking already advanced, e.g. it raced to `paid` via a concurrent live webhook — the
    `if (updated > 0)` guard at line 337 skips `appendBookingPaidLedger`, skips the
    notifications, and line 431 `continue`s. The claim is NOT reverted and nothing is logged at
    warn/error level.

    Result: a genuine inbound transfer is permanently attached to a booking that was paid by a
    DIFFERENT payment. The money produced no `booking_credit`, no `platform_fee`, and no
    overpay `refundOut` — it has left the ledger entirely. Because the row now fails
    `bookingId IS NULL`, no later sweep can ever re-match it, and the only trace is a
    `PaymentEvent` whose amount lives inside `rawBody` and is therefore invisible to every
    reconciliation query. On a live rail with one shared receiving account this is a
    customer-money-loss path with no detection.

    Fix: only claim after the paid transition is known to have applied, or roll the claim back
    (`UPDATE ... SET "bookingId" = NULL WHERE id = ? AND "bookingId" = ?`) when `updated === 0`,
    and emit a `logger.error` on that branch — this is the case a human must look at.

---

P3 — ADVISORY:

  prisma/schema.prisma:419  ℹ️  P3: Orphan rows create a class of PII that no retention or erasure path can ever reach.
    A SePay `rawBody` carries the payer's identity in free text (`content` /`description`, e.g.
    "CK tu NGUYEN VAN A ..."). Orphan rows hold that text with `bookingId` NULL, so they are
    unreachable from every customer-scoped path in the codebase: `lib/jobs/retentionSweeper.ts`
    scrubs `Booking` snapshots and `KybDocument` only and never touches `PaymentEvent`;
    `lib/jobs/anonymizeCustomers.ts` walks `Customer` → `Booking` → `NotificationLog` and never
    touches it either; `lib/account/**` contains no `PaymentEvent` reference at all. The schema
    comment added by this PR ("never delete one without reconciling it against the bank
    statement first") makes indefinite retention explicit.

    ADR-008 permits long retention of financial records, and DS-015:196 already excludes
    `PaymentEvent` from DSAR export — so this is not a policy violation. What is new is that a
    PDPL/GDPR erasure request now has NO key by which to locate the data: there is no
    customerId, no bookingId, and the payer name exists only inside an unindexed TEXT blob.
    Fix: add an orphan-aging entry to the retention policy (e.g. after N days unmatched, scrub
    `rawBody` down to the reconciliation-critical fields — `transferAmount`, `transferType`,
    `transactionDate`, `referenceCode` — and drop the payer free text), and write the operator
    runbook the schema comment implies exists.

  lib/payment/processWebhook.ts:129  ℹ️  P3: New failure log emits raw third-party error text, and an unscrubbed error object reaches Sentry, on the one path whose entire input is the raw SePay body.
    `logger.error({ ..., err: err instanceof Error ? err.message : String(err) }, ...)` at
    line 130 and `captureException(err, ...)` at line 133 both fire inside
    `recordUnmatchedPaymentEvent`, whose only variable input is `rawBody`. Prisma error messages
    on a create generally name the column rather than echo the value, so a leak is unlikely
    rather than impossible — but `lib/observability/sentry.ts:148` passes the raw `err` straight
    to `Sentry.captureException` (only the `extra` context is run through `scrubPii`), so
    anything Prisma does put in the message crosses to a third-party sink.

    `rawBody` is not on the logger redact list (`lib/logger.ts:54-110`) even though the file
    header of processWebhook.ts states "NEVER log ... raw webhook body". The project's own rule
    (CLAUDE.md, PII & Secrets) is that new sensitive fields go on the redact list in the same
    commit. Fix: add `'rawBody'` and `'*.rawBody'` to `loggerOptions.redact.paths` and to
    `REDACT_KEYS` in sentry.ts, and log `err.code` / a constant instead of `err.message` here.
    Both are one-line defence-in-depth changes on a path that already knows it is handling money.

  lib/jobs/__tests__/reconcilePayments.test.ts:311  ℹ️  P3: Production VietQR receiving account number copied into a new committed test fixture.
    The new SePay fixture hardcodes `accountNumber: '030027766656'`, which is the live default
    of `VIETQR_ACCOUNT_NUMBER` in `lib/config/env.ts:123`. The project's own redact list treats
    `accountNumber` as sensitive PII ("a leaked bank account number is a real, direct harm —
    Issue 078"). Disclosure harm is low here because it is the merchant's own inbound account
    (already printed on every customer-facing QR) and it is already committed in env.ts — but
    the fixture propagates it to two more files and normalises the pattern.
    Fix: use a masked placeholder in fixtures (the sibling int fixture's `030976167267` is
    already a non-production value); reserve the real number for env config.

---

VERIFIED CLEAN (attack surfaces checked, no finding):

  · Enumeration on `booking_not_found` (processWebhook.ts:190-204). Status, body and headers are
    byte-identical across branches — every path through the bank_transfer route exits via
    `sepayAck()` → `{"success": true}` / 200, and processWebhook's not-found branch returns the
    same `{message:'ok'}` / 200 it always did. Timing: the not-found branch gained ONE indexed
    INSERT while the found branch still runs a full `$transaction` (claim + insert + guarded
    UPDATE + capacity check + ledger + notification writes). The gap therefore NARROWS rather
    than widens — the change is timing-neutral-to-positive. The route is key-authenticated
    before the body is read, so enumeration presupposes key compromise regardless.
  · Unauthenticated reachability of the new writes. `recordUnmatchedPaymentEvent` is called from
    exactly two sites, both behind the `SEPAY_API_KEY` check (route.ts:56-66, executed before
    `req.text()`), and `recoverSepayEvent` is called only from the cron-gated sweeper. Neither
    is exported to any client bundle or to any unauthenticated handler. No new endpoint, no new
    HTTP method, no authz-surface change (Cat 2/Cat 5 clean).
  · Poisoning the sweeper with a non-payment. `unmatched` is populated only AFTER the adapter
    validates `transferAmount > 0` and `transferType === 'in'`
    (lib/payment/adapters/bankTransfer.ts:84-96), so outbound transfers, zero/negative amounts
    and non-JSON bodies cannot create orphans. Asserted by the new adapter tests.
  · Claim-then-insert in processWebhook. The `updateMany({ ..., bookingId: null })` predicate
    cannot steal an already-linked row, and `@@unique([adapter, providerTxnId])` means at most
    one row can match — a claimed row is by construction the same transfer, not a different one.
    The currency guard, underpay guard and monotonic paid transition all still run after the
    claim, unchanged.
  · Crypto (Cat 1). No crypto is introduced by this diff. The pre-existing key comparison
    (route.ts:61-63) correctly length-checks before `crypto.timingSafeEqual`. No hashing, no
    cipher, no randomness on the changed paths.
  · Audit-log emission (Cat 4). `PaymentEvent` IS this domain's audit row. The PR strictly
    increases audit coverage — two ack paths that previously wrote nothing now persist evidence
    — and the new mutations (`unmatched_recorded`, `orphan_claimed`, `degraded_claim_lost`) each
    emit a structured log. The only gap is the silent `updated === 0` branch, filed as P2 above.
  · Migration. `ALTER TABLE "PaymentEvent" ALTER COLUMN "bookingId" DROP NOT NULL` is
    catalog-only on PG16, and the FK is deliberately held at `onDelete: Restrict` in both the SQL
    and `schema.prisma:425` so a deleted booking's event cannot decay into a sweepable orphan.
    Correct call — `SET NULL` here would have been a direct free-ticket feed into the P1 matcher.

RECOMMENDED NEXT:
  - Address the P1 before merge. Option (a) — abstain when two or more stuck bookings qualify
    for the same orphan — is a small, self-contained change to `matchDegraded` plus its caller
    and closes the vector without touching the rest of the fix.
  - The two P2s are both one-function changes and should land in the same PR: this is the last
    checkpoint before orphan rows start accumulating in production.
  - P3s can follow up, but the `rawBody` redact-list entry is one line and the project's own
    rule says it lands with the field that introduced it.

SUMMARY: 1 P1 · 2 P2 · 3 P3 · pinned to 0435fe17
