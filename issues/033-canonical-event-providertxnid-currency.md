---
depends-on: []
type: FIX
wave: 0
spec: [S01, S12, SYS06]
---

> 🔎 **Reality-check 2026-06-01: CONFIRMED REAL (medium).** `lib/payment/gateway.ts:34-47`
> `ParsedIpn` has no `currency` field + MoMo-native names; dedup is on `externalRef` not
> `providerTxnId`. Full scope stands. (Amount verify itself already done — issue 032.)

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S01] / [S12] / [SYS06]

## What to build

Kill the canonical-event field drift. `lib/payment/gateway.ts:34-47` `ParsedIpn` carries
MoMo-native names (`orderId`, `transId`, `resultCode:number`) with **no `currency`** and
no pinned `status`; idempotency dedups on `PaymentEvent.externalRef` not a pinned
`providerTxnId` (`schema:265`, `@@unique([adapter, externalRef])`).

Spec ([S01] glossary, [S12]): one canonical event `{orderRef, providerTxnId, amount,
currency, status}` — **`providerTxnId` is the one pinned dedup name everywhere**.

- Define the provider-agnostic canonical type `{orderRef, providerTxnId, amount,
  currency, status}`; each adapter (`momo.ts`, `stub.ts`, future rails) maps its native
  shape INTO it. Native names stop leaking past the adapter boundary.
- Add `currency` (default `'VND'`) to the canonical event + `PaymentEvent` model
  (migration). **Verify currency == booking currency (VND)** server-side alongside the
  amount check (issue 032) — reject mismatched currency.
- Normalize the dedup key to `providerTxnId`; keep the `@@unique` idempotency guarantee
  (rename/remap, not weaken). P2002 → 200 no-op preserved.
- Add `providerTxnId` + `currency` to the logger redact/allow review as appropriate.

## Acceptance criteria

- [ ] Canonical event type exposes exactly `{orderRef, providerTxnId, amount, currency,
      status}`; no MoMo-native field name appears outside `lib/payment/adapters` (or
      `momo.ts`).
- [ ] `PaymentEvent` has a `currency` column (migration declared in BOTH schema.prisma +
      SQL per Mistake-Log Issue 007).
- [ ] Webhook dedup keys on `providerTxnId`; duplicate IPN → 200 no-op (idempotent).
- [ ] Currency mismatch (non-VND) IPN does NOT mark booking paid.
- [ ] Stub adapter (`PAYMENTS_STUB`) still round-trips through the canonical event.

## Blocked by

- none (coordinate with 032 — both touch processWebhook)

## User stories addressed

- [S12] per-provider adapter → one canonical event, idempotent dedup by providerTxnId.
