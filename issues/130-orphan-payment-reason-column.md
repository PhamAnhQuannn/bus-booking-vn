---
depends-on: []
type: FEAT
wave: 2
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\with-all-the-issues-reactive-llama.md` — PR 5. GitHub #370.

## What to fix

The admin "Giao dịch chưa khớp" tile counts **all** `PaymentEvent` rows with `bookingId IS NULL`
(`lib/admin/getFailureAlerts.ts:61`). That conflates two populations:

- **actionable** — unmatched-memo transfers a human can reconcile;
- **unactionable** — `account_mismatch` rows ("not our money"), which no admin action resolves.

The only decrement path is a webhook redelivery with the same `providerTxnId`, so the tile is a
lifetime cumulative counter with a permanent floor. A "needs action" metric that never returns to
zero trains operators to ignore it — the exact failure the alert exists to prevent.

**The reason is never persisted**, so "just filter the query" is not available. `account_mismatch`
is an in-memory string from `gateway.verifyWebhook` that is only logged. This needs a migration.

### There are THREE call sites, not two

The function's own docstring (`lib/payment/processWebhook.ts:97-98`) claims "two callers" and is
**wrong** — correct it in the same commit.

| # | Site | Reason in scope |
|---|---|---|
| 1 | `app/api/payments/bank_transfer/webhook/route.ts:100-105` | `preVerify.reason === 'account_mismatch'` |
| 2 | `app/api/payments/bank_transfer/webhook/route.ts:120-125` | `preVerify.reason === 'no_booking_ref_in_memo'` |
| 3 | `lib/payment/processWebhook.ts:192-200` | **none** — caller must synthesise `'booking_not_found'` |

### Fix

1. Migration: nullable `PaymentEvent.unmatchedReason String?`. Additive + nullable, so it does not
   re-arm a previously-impossible branch (contrast the 2026-07-23 `DROP NOT NULL` entry). Historical
   rows stay NULL → counted as actionable, which is the safe direction.
2. Populate at all three sites; site 3 passes the literal.
3. Count becomes `bookingId IS NULL AND (unmatchedReason IS NULL OR unmatchedReason <> 'account_mismatch')`.
4. Add `@@index([status, attemptCount])` to `NotificationLog` — the dead/retrying counts
   (`getFailureAlerts.ts`) have no covering index for `attemptCount` and scan the whole
   `status='failed'` partition.
5. `recent` selects `attemptCount` so dead rows aren't buried under newer retrying blips.

Newest migration today is `20260723180000_payment_event_orphan_receivedat_idx` (78 total).

## Acceptance criteria

- [ ] `unmatchedReason` written at all three call sites with the correct discriminator.
- [ ] The actionable orphan count can reach zero once every reconcilable transfer is matched.
- [ ] `account_mismatch` rows remain queryable (evidence retained) but excluded from the tile.
- [ ] `NotificationLog` has `@@index([status, attemptCount])` in both `schema.prisma` and SQL.
- [ ] The "two callers" docstring is corrected.
- [ ] Real-DB integration test — mocked Prisma cannot catch a constraint or an index.

## Blocked by

- none. Unblocks #332 (orphan PII retention) by giving it a discriminator to sweep on.

## Files

- `prisma/schema.prisma` + new migration
- `lib/payment/processWebhook.ts`, `app/api/payments/bank_transfer/webhook/route.ts`
- `lib/admin/getFailureAlerts.ts`

## Severity

P2 — no money at risk; the harm is alert fatigue on the one signal that surfaces stuck transfers.
