SECURITY-DEEP REVIEW — PR #357 "fix(payments): reconcile sweeper recovers VNPay transfers (#330)"
──────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/357
Base/Head: master ← fix/vnpay-recover-330 @ bce2a60b
Decision:  (none yet)
Generated: 2026-07-26

Findings: 5  (P1: 1 · P2: 2 · P3: 2)

## Clean categories (recorded so re-reviews don't re-walk them)

- **Cat 1 crypto** — no cipher/hash/KDF/RNG construct added. The diff adds one pure parser and one barrel re-export. No `createCipher*`, no `Math.random()` for a secret, no MD5/SHA-1, no bcrypt/pbkdf2/scrypt parameter. The existing `hmacSha512` + `crypto.timingSafeEqual` + length-guard in `verifyWebhook` are untouched.
- **Cat 2 injection surface** — the new parse is `new URLSearchParams(rawBody)`; no SQL template, no shell, no `eval`/`Function`/`vm`, no HTML sink, no user-controlled `fetch` target, no redirect. Values are read via `.get()` and immediately coerced to `Number` or compared against a fixed code set. `recoverVnpayEvent` cannot throw (URLSearchParams accepts any string), so one malformed row cannot abort a sweep tick — an improvement over the `JSON.parse`+`try` path it bypasses.
- **Cat 3 rate-limit** — no new endpoint. The sweeper is an existing cron under the `reconcile-payments` advisory lock with `CLAIM_LIMIT = 200`; unchanged.
- **Cat 4 audit-log** — no new mutation handler. The paid transition still runs through the shared `applyPaidStatusTransition` + `appendBookingPaidLedger` and still emits `reconcile.booking_paid`.
- **Cat 5 authz** — no new handler, no authz decision added or removed.
- **Cat 6 PII** — the diff adds **zero** log statements and zero DB columns. No new field for the `lib/logger.ts` redact list (`vnp_*` recovery reads amount/status only; `rawBody` is never logged, consistent with the existing `// stored for audit; never logged` at `processWebhook.ts:250`).
- **Heuristic matching not armed on this rail** — worth stating explicitly, since making a payload legible is exactly what armed the dead `matchDegraded` branch in the 2026-07-23 Bug B round-2 P1. It does **not** recur here: orphan rows (`bookingId IS NULL`) are the only degraded-match candidates, and every writer of one is hard-scoped to `bank_transfer` (`processWebhook.ts:198`, `app/api/payments/bank_transfer/webhook/route.ts:80,100`). No `adapter='vnpay'` orphan can exist, so `matchDegraded` stays unreachable for VNPay. Confirmed by enumerating all `paymentEvent.create` call sites.

---

P1 — BLOCKING:

  lib/jobs/reconcilePayments.ts:185-196  🚫 P1: Threat-model delta — parser selected by a discriminator that does not determine the format; money-in bookings driven to a TERMINAL state.

    This PR makes `PaymentEvent.rawBody` security-relevant for `adapter='vnpay'` for the
    first time: previously every vnpay row recovered as `{0,false}` and was inert to the
    sweeper; now its content drives `applyPaidStatusTransition` + `appendBookingPaidLedger`
    (an operator ledger credit). Extending a trust boundary is fine — selecting the parser
    on a field that does not determine the format is not.

    `PaymentEvent.adapter` records the payment METHOD, not the producing gateway.
    `lib/payment/select.ts:46` routes method `vnpay` to the **stub** gateway whenever
    `PAYMENTS_STUB` is on, and `app/dev/stub-pay/actions.ts:57-63` persists the stub's
    **JSON** body under `adapter: 'vnpay'`. VNPay is offered in the customer UI in exactly
    that mode (`app/(customer)/booking/review/page.tsx:56`:
    `showVnpay = env.PAYMENTS_STUB || env.VNPAY_ENABLED`).

    Post-merge, such a row routes to `recoverVnpayEvent`, whose `URLSearchParams` parse of a
    JSON string finds no `vnp_ResponseCode` → `?? '99'` → `unknown` → `{0,false}` →
    `isConfirming` false. The sweeper — the designated safety net for a payment whose status
    transition was lost — then expires the booking to `payment_failed_expired`, which is
    TERMINAL (`lib/booking/transitions.ts`). Payment recorded, ticket destroyed, no automated
    recovery path. That is the same integrity failure class as Bug B, on the rail the
    deployment currently runs, introduced by the PR that fixes it on the rail that is off.

    Security-relevant because the control being defeated is a *compensating* control: this
    sweeper exists specifically to catch the case where the primary (webhook) path failed.
    Silently narrowing it is a defence-in-depth regression, and it is invisible — a starved
    or mis-parsing tick reports `{rowsAffected: 0, status: 'success'}`, identical to idle.

    Fix: select the recoverer from the gateway that actually handled the payment
    (`getGatewayFor`) rather than from the `adapter` string, or shape-detect before dispatch.
    → Filed with full detail as P1 in `docs/qa/code-review-pr357-20260726.md` and
      structurally in `docs/qa/architect-review-pr357-20260726.md`.

P2 — SHOULD FIX:

  lib/payment/adapters/vnpay.ts:189-197  ⚠️  P2: Payee/merchant field (`vnp_TmnCode`) never validated — new money-decision consumer added without it.

    `vnp_TmnCode` is set on the OUTBOUND `createPayment` (`vnpay.ts:207`) and declared in
    config + the logger redact list (`lib/config/env.ts:77`, `lib/logger.ts:109`), but is
    read by **nothing** on the inbound path: `verifyWebhook` never compares it to
    `env.VNPAY_TMN_CODE`, and `recoverVnpayEvent` does not either.

    This is the exact structural shape of the 2026-07-23 Bug B round-2 P1 — "SePay does send
    the real `accountNumber`; it is declared in `SepayWebhookPayload` and read nowhere" — a
    declared-but-unread payee field that became a wrong-payee payout. That one was closed by
    Issue 334, which now enforces `expectedAccount: env.VIETQR_ACCOUNT_NUMBER` on the
    bank_transfer rail (`app/api/payments/bank_transfer/webhook/route.ts:70`, with an
    `account_mismatch` branch that records an orphan and refuses to credit). VNPay has no
    equivalent, and this PR adds a **second** consumer that treats the payload as
    authoritative for a money decision without one.

    Not a live hole: the HMAC is keyed on the per-merchant `VNPAY_HASH_SECRET`, so a body that
    verifies did come from our merchant account, and the sweeper only reads rows written after
    that check. Rated P2 rather than P1 for that reason — but it is a defence-in-depth parity
    gap on the rail about to be enabled, and the repo has already paid once for exactly this
    "field is on the wire, nobody reads it" pattern.
    Fix: assert `vnp_TmnCode === config.tmnCode` in `verifyWebhook` (reject as a new
    `merchant_mismatch` reason) so the guarantee is enforced once, at ingest, for both consumers.

  lib/payment/adapters/vnpay.ts:179-188  ⚠️  P2: The security assumption in the new doc comment is stated more broadly than it holds.

    The comment reads: "We do NOT re-verify the HMAC: the row only exists because
    verifyWebhook already passed at ingest."

    True for `adapter='vnpay'` today, and the reasoning is sound for this function. But as a
    statement about `PaymentEvent` it is false, and a future reader will take it as a global
    invariant: `app/api/payments/bank_transfer/webhook/route.ts:80,100` writes orphan rows on
    the paths where `preVerify` **failed** (`account_mismatch`, `no_booking_ref_in_memo`).
    Those rows are authenticated only by the shared SePay API key, not by a passing signature
    verification.

    The consequence is contained today (those rows carry `adapter='bank_transfer'`, and
    `recoverSepayEvent` is written to treat them as evidence rather than authority), but the
    load-bearing invariant for `recoverVnpayEvent` is really "*no unverified row is ever
    written with adapter='vnpay'*" — which is enforced nowhere and asserted nowhere, and which
    P1 above already shows to be fragile against changes elsewhere (`STUB_ADAPTERS`).
    Fix: narrow the comment to the actual invariant, and record it where the writers live —
    a note on the `PaymentEvent` model and/or at `recordUnmatchedPaymentEvent` stating that
    unverified rows are permitted for `bank_transfer` only, because two downstream parsers
    trust verified-ness.

P3 — ADVISORY:

  lib/payment/adapters/vnpay.ts:194 + lib/jobs/reconcilePayments.ts:211  ℹ️  P3: The `currency === 'VND'` half of `isConfirming` is vacuous on the vnpay rail.

    `isConfirming` gates on `ev.success && ev.currency === 'VND' && ev.amount >= totalVnd`.
    `ev.currency` is the stored column, written from `verifyResult.event.currency` — and the
    VNPay adapter **hardcodes** `currency: 'VND'` (`vnpay.ts:162`) while never reading the
    inbound `vnp_CurrCode` (it is only ever set outbound, `vnpay.ts:210`). So one of the three
    confirmation guards can never fail for this rail, and this PR makes that the first path
    where it matters. Low real risk (VNPay domestic is VND-only, and `vnp_Amount` is
    HMAC-covered) — but the guard reads as protection it does not provide.
    Fix: read `vnp_CurrCode` in `verifyWebhook` and return it, rather than asserting VND.

  lib/jobs/reconcilePayments.ts (whole file)  ℹ️  P3: No integration-layer test asserts the trust boundary this PR relies on.

    Every claim above about "which rows can exist with which adapter" was verified by reading
    call sites, not by a test. `reconcilePayments.int.test.ts` seeds only `momo` and
    `bank_transfer` rows. A single integration case asserting that no `adapter='vnpay'` row
    can be created without a passing `verifyWebhook` — and that a stub-served vnpay booking
    still recovers — would convert two of the findings above from reasoning into a gate.
    Pairs with the already-tracked #352 (VNPay webhook integration test).

RECOMMENDED NEXT:
  - P1 blocks: it is an integrity regression on the compensating control for lost payments,
    on the configuration in production today. Resolve the discriminator before merge.
  - P2 #1 (`vnp_TmnCode`) should land before `VNPAY_ENABLED` is flipped, alongside #352 —
    it is the VNPay counterpart of a control the bank_transfer rail already enforces.
  - P2 #2 is a comment + a model note; cheap, and it is the assumption everything else rests on.

SUMMARY: 1 P1 · 2 P2 · 2 P3 · pinned to bce2a60b
