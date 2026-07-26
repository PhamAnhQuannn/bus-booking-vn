CODE REVIEW — PR #357 "fix(payments): reconcile sweeper recovers VNPay transfers (#330)" @ bce2a60b
────────────────────────────────
Diff scope: 5 files, +115 / -7 lines
Base: master · Head: bce2a60b26f45f654056494de05b31087e4ee475 · State: OPEN, ready
Verification run during review: `pnpm vitest run lib/payment/__tests__/vnpay.test.ts lib/jobs/__tests__/reconcilePayments.test.ts` → 42/42 pass on PR head.

## Scope of change

- `lib/payment/adapters/vnpay.ts` — new export `recoverVnpayEvent(rawBody)`, URLSearchParams parse, reuses `classifyVnpayStatus`.
- `lib/payment/index.ts` — barrel export added alongside the already-exported `getVnpayAdapter` (no new module edge, no new cycle, no `'use client'` consumer of the payment barrel — verified).
- `lib/jobs/reconcilePayments.ts` — `recoverEvent` gains an `else if (row.adapter === 'vnpay')` arm, dispatching on the stored `adapter` column as the 2026-07-23 Bug B rule requires. **This part is correct.** The parse shape also matches what is actually persisted: `app/api/payments/vnpay/webhook/route.ts` stores the urlencoded transport string (POST `req.text()`, or a `searchParams`-reconstructed querystring on GET) as `PaymentEvent.rawBody` via `processPaymentWebhook`. Verified end-to-end by reading the route + `lib/payment/processWebhook.ts:250`.
- Two test files.

Also verified (no finding): VNPay cannot produce orphan `PaymentEvent` rows — `processWebhook.ts:198` scopes `recordUnmatchedPaymentEvent` to `adapter === 'bank_transfer'` — so making VNPay bodies legible does **not** newly arm `matchDegraded()` for the vnpay rail. This is the 2026-07-23 "widening a constraint arms dead code" class and it is clean here.

---

PRIORITY 1 — Block merge, fix first:

  [CORRECTNESS / DATA LOSS — REGRESSION ON THE CURRENTLY-ACTIVE RAIL]
  lib/jobs/reconcilePayments.ts:186-188 (new `else if (row.adapter === 'vnpay')` arm)

    `PaymentEvent.adapter` records the payment METHOD, not the gateway that produced
    the body — so it is NOT a sound key for body shape, and this is the first code to
    depend on it being one.

    `bank_transfer` happens to be the only adapter with no stub twin
    (`app/dev/stub-pay/actions.ts:22` — `STUB_ADAPTERS = { momo, zalopay, card, vnpay }`),
    which is why `recoverSepayEvent` keying on it was safe. `vnpay` HAS a stub twin.
    Under `PAYMENTS_STUB`, `submitStubPayment` calls
    `processPaymentWebhook({ rawBody: JSON.stringify(stubIpn), adapter: 'vnpay' })`
    (`app/dev/stub-pay/actions.ts:49-63`), persisting a **JSON** `{amount, resultCode}`
    body under `adapter: 'vnpay'`. VNPay is offered in the customer UI in exactly that
    mode: `app/(customer)/booking/review/page.tsx:56` —
    `showVnpay = env.PAYMENTS_STUB || env.VNPAY_ENABLED`.

    Before this diff those rows hit the `else` JSON branch → `JSON.parse` succeeds →
    `resultCode === 0` → `success: true` → **recovered correctly**.
    After this diff they hit `recoverVnpayEvent` → `URLSearchParams` over a JSON string
    finds no `vnp_ResponseCode` → `?? '99'` → `classifyVnpayStatus('99') === 'unknown'`
    → `{ amount: 0, success: false }` → `isConfirming` false → **not recovered**, and
    once the hold lapses the booking is driven to terminal `payment_failed_expired`
    while a paid PaymentEvent sits on file.

    That is Bug B reintroduced on the rail that is live today, by the PR that fixes it
    on the rail that is switched off (`VNPAY_ENABLED` defaults false, `lib/config/env.ts:73`;
    `lib/payment/select.ts:46` routes vnpay to the real adapter only when
    `VNPAY_ENABLED && !PAYMENTS_STUB`).

    Test-blind at every layer: `reconcilePayments.test.ts` covers momo + the new
    urlencoded vnpay; `reconcilePayments.int.test.ts` covers momo + bank_transfer only;
    `e2e/vnpay-booking.spec.ts` never runs the sweeper. Worse, the new adapter test
    `'does not throw on a JSON body (wrong adapter shape) → { 0, false }'`
    (`lib/payment/__tests__/vnpay.test.ts`) **asserts the regression as intended
    behaviour** — the green-test-encodes-the-bug pattern from the 2026-07-23 entry.

    Fix (pick one, and add a sweeper case with `adapter:'vnpay'` + stub-JSON `rawBody`
    in the same commit):
      a) shape-detect before dispatch — a body whose first non-space char is `{` goes
         to the JSON/stub branch regardless of `adapter`;
      b) try the adapter-specific parser and fall back to the JSON parser when it
         yields `{0,false}` and the body is valid JSON;
      c) persist the producing gateway on `PaymentEvent` and dispatch on THAT.
    (a) is the smallest and needs no migration. Whichever is chosen, the same trap is
    waiting for `momo` / `zalopay` / `card` the moment each gets a real recoverer.
    → Also filed as P1 in `docs/qa/pr-review-pr357-20260726.md` (the PR body's
      "mirrors the SePay pattern" claim is where the unsound analogy is asserted).

  [TEST / RISK PATH — MONEY LOSS] lib/jobs/__tests__/reconcilePayments.test.ts:59-60
    The assertion `expect(tx.$executeRaw).not.toHaveBeenCalled()` — commented
    "NOT expired — the whole point of #330 is the money is recovered, not lost" —
    is VACUOUS. The fixture is `baseBooking({ paymentMethod: 'vnpay', totalVnd })`,
    which inherits `holdExpiresAt: null` (line 105). In `reconcilePayments.ts` the
    expiry branch is gated on `booking.holdExpiresAt !== null && <= now` (line 546),
    so this booking can NEVER reach `payment_failed_expired` — with or without the
    fix, with or without a confirming event. The test proves the paid half only.

    The regression #330 exists to prevent is precisely the other half: a VNPay
    booking whose hold HAS lapsed, with a confirming VNPay event on file, going
    terminal `payment_failed_expired` while the money sat in the account. No test
    at any layer (unit, integration, e2e) seeds that state. `payment_failed_expired`
    is terminal (`lib/booking/transitions.ts`), so this is the data-loss path.

    Fix: add a case with `holdExpiresAt: new Date(NOW - 60_000)` + the confirming
    VNPay event, asserting `mockApplyPaid` called AND `$executeRaw` not called.
    Confirm it goes red when the `vnpay` arm is removed from `recoverEvent`.

PRIORITY 2 — Fix before merge:

  [CORRECTNESS / MONEY — PARSER DIVERGENCE] lib/payment/adapters/vnpay.ts:189-197
    `recoverVnpayEvent` re-implements `verifyWebhook`'s field-authority logic
    (`vnp_TransactionStatus` else `vnp_ResponseCode`, `vnp_Amount ÷ 100`) rather
    than sharing it. The two implementations are NOT equivalent: `recoverVnpayEvent`
    reads via `URLSearchParams.get()` (FIRST value wins) while `verifyWebhook`
    (line 102-106) builds a plain object by iterating `.entries()` (LAST value wins).
    Demonstrated on the PR head:

      body: vnp_TransactionStatus=00&vnp_TransactionStatus=24
           &vnp_Amount=15000000&vnp_Amount=100&vnp_ResponseCode=00
      verifyWebhook (ingest)      → status '24' (failed), amount 1
      recoverVnpayEvent (sweeper) → status '00' (paid),   amount 150000

    i.e. the sweeper can pay a booking on a body the ingest verifier classified as
    FAILED. Reachability is low (the body is HMAC-signed by VNPay, so it requires
    VNPay itself to emit duplicate vnp_* keys), but this is a money-path decision
    made by two independent parsers of the same payload with no test asserting
    they agree — which is the shape of the very bug this PR fixes.
    Fix: extract one `parseVnpayFields(rawBody)` used by BOTH `verifyWebhook` and
    `recoverVnpayEvent`, and add a test asserting
    `recoverVnpayEvent(b).amount === verifyWebhook(b).event.amount` and that
    `success === (status === 'paid')` for a single shared body.

  [TEST / WIRE CONTRACT — Mistake Log class] lib/jobs/__tests__/reconcilePayments.test.ts:34-40
    The sweeper-layer fixture `vnpayRawBody` is HAND-TYPED: its own field subset,
    no `vnp_SecureHash`, never run through the real adapter. It is not the body
    produced by `signVnpayBody(baseParams())` used in `lib/payment/__tests__/vnpay.test.ts`.
    Contrast the SePay guard in the SAME file (lines 353-376), which builds one
    `sepayRawBody`, asserts `getBankTransferAdapter().verifyWebhook(sepayRawBody)`
    accepts it — proving it is exactly what the route persists — and only then
    stages that SAME string as the stored `rawBody`. One producer, two consumers.
    This is the 2026-07-23 SePay ref-case rule verbatim: a hand-written fixture
    re-encodes the author's assumption on both sides, so the test stays green
    against a broken integration. The PR body claims "Round-trip a real
    adapter-produced body" — true at the adapter layer, NOT true at this layer.
    Fix: build the sweeper fixture with `signVnpayBody(baseParams())` (export the
    helper or a shared fixture module), assert `getVnpayAdapter().verifyWebhook(...)`
    accepts it, then stage that same string as `rawBody`.

  [CORRECTNESS / MONEY — TYPE-SILENT SWAP] lib/jobs/reconcilePayments.ts:185-188, 338
    `recoverEvent(row, recoverSepayEvent, recoverVnpayEvent)` now takes TWO
    positionally-injected functions of the identical type
    `(rawBody: string) => { amount: number; success: boolean }`. Swapping the two
    arguments type-checks silently and reinstates Bug B on BOTH rails at once
    (each parser returns `{0,false}` on the other's body — no throw, no log, just
    silent non-confirmation followed by terminal expiry). Every added adapter makes
    this worse.
    Fix: pass a single `Record<string, (rawBody: string) => {...}>` keyed by the
    stored `adapter` value, and look it up (`recoverers[row.adapter] ?? jsonFallback`).
    The key then IS the column, which is also what the Bug B rule asks for.

PRIORITY 3 — Address when convenient:

  [TEST / UNREACHABLE BRANCH] lib/payment/adapters/vnpay.ts:192-193
    The `vnp_TransactionStatus` absent → fall back to `vnp_ResponseCode` branch has
    no test in this diff, and appears unreachable for STORED rows: only the IPN
    webhook persists a `PaymentEvent`, and VNPay v2.1.0 IPNs always carry
    `vnp_TransactionStatus`; `app/api/payments/vnpay/return/route.ts` (the
    return-URL flow that omits it) writes no `PaymentEvent` at all. Either cover it
    or note in the doc comment that it is defensive-only.

  [READABILITY / MAGIC] lib/payment/adapters/vnpay.ts:191
    Bare `?? '99'` sentinel. Mirrors `verifyWebhook` line 137, so it is consistent —
    but now duplicated. Name it (`VNPAY_UNKNOWN_CODE`) alongside the existing
    `VNPAY_SUCCESS_CODE` / `VNPAY_FAILURE_CODES` / `VNPAY_PENDING_CODES` constants.

  [DIVERGENCE / MINOR] lib/payment/adapters/vnpay.ts:195
    `recoverVnpayEvent` requires `amount > 0`; `verifyWebhook` accepts `amount >= 0`
    (line 143). Harmless today (a 0-amount paid event is not a real confirmation
    either way) but it is one more un-asserted difference between the two parsers —
    folds into the P2 extraction above.

  [PRE-EXISTING DRIFT — not introduced here] lib/payment/__tests__/vnpay.test.ts:43,
  e2e/vnpay-booking.spec.ts:33
    Two hand-rolled copies of the adapter's `buildSignData`, both self-described as
    "mirrors the adapter's buildSignData exactly". This PR's new adapter tests build
    on the first copy. A shared exported test fixture would remove a standing
    both-sides-encode-the-same-assumption hazard. Out of scope for this PR; worth an
    issue.

SUMMARY: 2 P1, 3 P2, 4 P3

RECOMMENDED NEXT STEPS:
  → P1 #1 (stub-path regression) is the blocker: the dispatch key is unsound and the
    diff silently breaks the rail the deployment currently runs on. Resolve before
    anything else; the PR body's SePay analogy depends on it.
  → P1 #2 is a one-fixture addition (`holdExpiresAt` in the past) — cheap, and it is
    the only test that actually pins the money-loss behaviour #330 names.
  → P2 #1 and #2 are the same root cause seen from two sides (two parsers, one
    contract, no agreement assertion). Extracting `parseVnpayFields` closes both.
  → P2 #3 (recoverer map) is a small refactor that also makes the next adapter free.
  → The core dispatch change is correct and the parse matches the persisted shape;
    nothing here argues against the approach, only against the evidence backing it.
