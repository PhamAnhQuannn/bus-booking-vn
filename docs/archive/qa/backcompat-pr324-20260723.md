BACKCOMPAT REVIEW — PR #324 "fix(payments): reconcile sweeper could not recover ANY bank transfer (Bug B)"
───────────────────────────────────────────────────────────────────────────────────────────────────────
PR:        https://github.com/PhamAnhQuannn/bus-booking-vn/pull/324
Base/Head: master ← fix/bank-transfer-reconcile-orphan @ 0435fe17
Decision:  (none yet)
Size:      +846 / -59 across 15 files
Project license: private (no `license` field in package.json — no dependency license-compat check applicable)
Generated: 2026-07-23T23:18:27Z

Findings: 0  (P1: 0 · P2: 0 · P3: 0)

## Cat 1 — Schema back-compat: column widening (`PaymentEvent.bookingId` → nullable)

Migration `20260723120000_payment_event_orphan_bookingid/migration.sql` is a single
`ALTER TABLE "PaymentEvent" ALTER COLUMN "bookingId" DROP NOT NULL;` — catalog-only,
no rewrite, no backfill. Widening in the write direction is trivially safe; the risk
is entirely on the *reader* side (relation filters that silently exclude NULL-FK rows,
and TS consumers that assumed `bookingId: string`).

**Every reader of `PaymentEvent.bookingId` / `Booking.paymentEvents` was enumerated:**

| Site | Access pattern | Verdict |
|---|---|---|
| `lib/jobs/reconcilePayments.ts` | raw `$queryRaw` already typed the row as `bookingId: string \| null` *before* this diff (dead-code path per the PR's own commit message) | unaffected, now live as intended |
| `lib/payment/processWebhook.ts` | `tx.paymentEvent.updateMany({ where: { adapter, providerTxnId, bookingId: null }, ... })` then conditional `create` | correct — claim-then-insert added by this PR, exercised by a real-Postgres int test (`bankTransferWebhook.int.test.ts`) that specifically catches the P2002-inside-tx trap the author's own Mistake Log entry documents |
| `scripts/prod/purge-demo-catalog.ts` | `tx.paymentEvent.deleteMany()` — **no `where`** | deletes ALL rows unconditionally; nullability is irrelevant, no leak |
| `prisma/seed.ts` | `prisma.paymentEvent.deleteMany()` — no `where` | same, unaffected |
| `e2e/op-reports.spec.ts`, `e2e/op-staff-client.spec.ts` | raw SQL `DELETE ... WHERE "bookingId" IN (SELECT ...)` scoped to the test's own bookings | these specs never create orphan rows, so the scoped subquery is correct as-is |
| `lib/ledger/__tests__/ledgerCreditFee.int.test.ts` | `paymentEvent.deleteMany({ where: { bookingId } })` — literal id, not a relation filter | unaffected |
| **`lib/jobs/__tests__/reconcilePayments.int.test.ts`** (modified by this PR) | had a pre-existing `deleteMany({ where: { booking: { trip: { operatorId } } } })` relation filter — this is exactly the trap the task asked to check for | **PR already fixes it**: adds `paymentEvent.deleteMany({ where: { providerTxnId: { in: [BT_SOLO_TXN, BT_PAIR_TXN] } } })` *before* the relation-filtered delete, with an inline comment explaining orphans are unreachable via the `booking` relation |
| **`lib/payment/__tests__/bankTransferWebhook.int.test.ts`** (modified by this PR) | same trap, same fix pattern (`orphanTxnIds` array, deleted by key before the `bookingId`-keyed deletes) | fixed in the same commit |
| `Booking.paymentEvents` back-relation | grepped `paymentEvents` project-wide | **zero non-schema references** — the back-relation is declared but never queried by any app/lib/e2e/script code, so there is no consumer that could silently receive a shorter list or choke on it |

No consumer accesses `paymentEvent.bookingId` and passes it into a context requiring
a non-null `string` (e.g. as a required function arg) without a null-check already in
place. The two production writers that create orphan rows on purpose
(`recordUnmatchedPaymentEvent`, the `matchDegraded` → CAS-claim path in
`reconcilePayments.ts`) are new code introduced by this same PR, so there is no
pre-existing caller that could be broken by the column suddenly containing NULLs —
every code path that produces or consumes an orphan ships together in this diff.

**Conclusion: no back-compat break.** The one relation-filter leak pattern the task
flagged (`prisma/seed.ts`, `scripts/prod/purge-demo-catalog.ts`, `e2e/**` cleanup,
`*.int.test.ts` afterAll hooks) was searched exhaustively; the only two occurrences
that could actually leak orphan rows are inside this same PR's own modified test
files, and both are already patched with an explicit by-key delete ahead of the
relation-filtered delete.

## Cat 2 — Exported-type back-compat: `VerifyWebhookResult` gains optional `unmatched`

`lib/payment/gateway.ts` — the `ok: false` union member gains
`unmatched?: { providerTxnId: string }`. Checked every implementor of
`PaymentGateway.verifyWebhook`:

- `lib/payment/adapters/momo.ts` — returns `{ ok: false, reason }` (no `unmatched`) — valid, optional field
- `lib/payment/adapters/vnpay.ts` — same, 3 failure sites, none touched — valid
- `lib/payment/adapters/stub.ts` — same, 4 failure sites, none touched — valid
- `lib/payment/adapters/bankTransfer.ts` — the only adapter populating `unmatched`, on the two `no_booking_ref_in_memo` sites — intentional, per this PR

Checked every caller of `verifyWebhook`:

- `app/api/payments/vnpay/webhook/route.ts`, `app/api/payments/vnpay/return/route.ts` — only read `.ok` / (implicitly) `.reason` via `processPaymentWebhook`; never destructure `unmatched` — unaffected
- `app/api/payments/bank_transfer/webhook/route.ts` — new `preVerify.unmatched` read, guarded (`if (preVerify.unmatched)`), consistent with the optional type — no widening hazard
- momo webhook route calls `processPaymentWebhook` (shared), not `verifyWebhook` directly — unaffected

Adding an optional field to a discriminated-union member is additive and cannot break
any existing consumer at the type level (structural typing — objects without the key
still satisfy the type) or at runtime (no consumer destructures `unmatched` without
already checking `preVerify.unmatched` truthiness). **No break.**

## Cat 3 — New barrel exports

`lib/payment/index.ts` adds:
```
export { getBankTransferAdapter, recoverSepayEvent } from './adapters/bankTransfer';
...
export { processPaymentWebhook, recordUnmatchedPaymentEvent } from './processWebhook';
```
Diffed against the full existing export list (`getMomoAdapter`, `getVnpayAdapter`,
`getBankTransferAdapter`, `buildStubIpn`, `createStubAdapter`, `refundPaymentStub`,
`StubOutcome` (type), `PaymentGateway`/`CreatePaymentInput` (types),
`processPaymentWebhook`, `applyPaidStatusTransition`, `appendBookingPaidLedger`,
`refundPayment`, `getGatewayFor`). No name collision with either new export.
**Additive only.**

## Cat 4 — API/endpoint contract (bank_transfer webhook ack)

Read `app/api/payments/bank_transfer/webhook/route.ts` end to end. Every response
path is unchanged from before this PR:
- Missing/invalid auth → 401 `{ error: 'UNAUTHORIZED' }` (unchanged)
- `no_booking_ref_in_memo` short-circuit → now also calls
  `recordUnmatchedPaymentEvent` (fire-and-forget-safe: the function is documented
  "NEVER throws," wrapped in try/catch, P2002 swallowed, other errors logged +
  captured to Sentry but not re-thrown) → still returns `sepayAck()` = 200
  `{"success": true}`, byte-for-byte identical to pre-PR behavior
- `processPaymentWebhook` delegate path → still re-emits `sepayAck()` for any 2xx,
  passes non-2xx through untouched — unchanged

`recordUnmatchedPaymentEvent`'s inability to throw means it cannot flip a would-be
200 into a 500, which is the one way this change could have altered the ack contract.
**No contract change; SePay's retry semantics are preserved on every branch.**

## Cat 5 — Deprecation window

Confirmed no export, field, endpoint, or column was removed or renamed:
- `PaymentEvent.bookingId` — widened (NOT NULL → nullable), not renamed
- `Booking.booking` relation — widened (`Booking` → `Booking?`), not renamed; `onDelete: Restrict`
  explicitly pinned to match the already-deployed FK (prevents Prisma diff drift toward `SET NULL`)
- `VerifyWebhookResult` — optional field added, not removed
- `lib/payment/index.ts` — only additions
- webhook route — no endpoints added or removed

**Claim holds — nothing removed or renamed in this diff.**

## Cat 6 — Dependencies

`package.json` / lockfiles are not in the changed-files list for this PR
(15 files: `CLAUDE.md`, 2 route/test files under `app/api/payments/**`, 3 files
under `lib/jobs/**`, 4 files under `lib/payment/**`, 1 migration, `prisma/schema.prisma`).
**No dependency or lockfile change — Cat 4/5/6 of the generic supply-chain checklist
are all N/A for this PR.**

RECOMMENDED NEXT:
  - No P1/P2/P3 findings — safe to merge from a back-compat standpoint.
  - This PR's own two modified integration test files already demonstrate the exact
    "relation-filter misses orphan FK rows" failure mode the task asked to guard
    against, and fix it inline — worth using as the canonical pattern (delete by
    natural key first, then by relation) for any future PaymentEvent-touching
    cleanup code.
  - Standard companions if not already run: `/code-review 324`, `/security-review-deep 324`.

SUMMARY: 0 P1 · 0 P2 · 0 P3 · pinned to 0435fe17
