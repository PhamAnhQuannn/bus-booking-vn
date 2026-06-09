# Payment Go-Live Readiness — 2026-06-07

Scope: what's needed to go live with real money on **MoMo, ZaloPay, card, Apple Pay**.
Grounded in the actual code (`lib/payment/**`, `lib/ledger/**`, `lib/jobs/**`), not the spec.
Canonical task checklist: `issues/094-go-live-real-payment-keys.md`.

**TL;DR:** the money *core* is already production-grade. The gaps are (1) real PSP **adapters**
for non-MoMo rails, (2) real **refund** + **payout disbursement** execution (both stubbed), (3)
real **credentials + merchant accounts + contracts**, (4) flipping `PAYMENTS_STUB`/`NOTIFY_STUB`
off. Apple Pay is **not** a standalone rail — it rides a card PSP.

---

## 1. Already done (go-live-grade, verified in code — NOT stub-dependent)

| Capability | Where |
|---|---|
| Canonical event `{orderRef, providerTxnId, amount, currency, status}` | `lib/payment/gateway.ts` |
| Idempotent webhook dedup (`PaymentEvent @@unique([adapter, providerTxnId])`) | `lib/payment/processWebhook.ts` |
| Monotonic transition guard (no paid→pending regress) | `lib/payment/applyPaidTransition.ts` |
| Underpay reject · overpay→refund-difference · non-VND reject | `lib/payment/processWebhook.ts` |
| Shared provider-agnostic webhook core | `lib/payment/processWebhook.ts` |
| Double-entry **append-only ledger**, DB-trigger immutability | `prisma/migrations/20260602020000_ledger_entry` |
| `booking_credit` + `platform_fee` on paid (same tx) | `lib/payment/applyPaidTransition.ts` |
| Refund-out **ledger** rail (`refund_debit` + `refund_out`) | `lib/ledger/refund.ts` |
| Chargeback + `payout_reversal` + platform bad-debt backstop | `lib/ledger/chargeback.ts` |
| Effective-dated `FeeConfig` (global + per-operator), BigInt half-even | `lib/ledger/feeConfig.ts` |
| T+1 settlement delay (pending→available bucketing) | `lib/ledger/balance.ts`, `constants.ts` |
| Recon sweeper (confirming event / expired hold / degraded bank match) | `lib/jobs/reconcilePayments.ts` |
| Payout cron + payout state machine + PayoutAccount verify gate | `lib/jobs/processPayouts.ts` |
| Consent gate (no-refund + PII) version-checked at checkout | `app/(customer)/booking/review/ReviewClient.tsx` |

So: correctness, idempotency, money-safety, ledger, recon — **built**. What's missing is the
real-world plumbing below.

---

## 2. Cross-rail blockers (every rail, before flipping `PAYMENTS_STUB` off)

1. **Per-rail real adapter** wired in `lib/payment/select.ts` — today **only `momo`** has a real
   adapter; `zalopay`/`card` fall back to the stub *even with `PAYMENTS_STUB=false`*.
2. **Real PSP refund execution** — `lib/payment/refund.ts` throws `PspRefundNotImplementedError`
   when stub is off. The refund-out + chargeback *ledger* rails are built but call this stub →
   implement the real refund API **per rail first**, or refund-out crashes in prod.
3. **Real operator payout/disbursement** — `lib/ledger/settlePayout.ts` is a stub (no bank HTTP).
   Operators can't withdraw real money until a real disbursement rail (bank/aggregator payout API,
   or a documented manual payout) replaces it.
4. **`NOTIFY_STUB=false` + real eSMS + email creds** — ticket QR/PDF over SMS+email is the
   paid-booking payoff; currently stubbed.
5. **Public callback URL registered with each PSP** — prod domain (or the dev tunnel for sandbox).
   IPN/redirect URLs are header-derived (`app/api/bookings/initiate/route.ts:93-97`), so they
   already follow the serving host.
6. **Secrets in a real secret store** (never committed). Redaction already covers payment secrets.
7. **Pre-go-live security/fraud gate** — `issues/101`.
8. **Webhook matrix** per rail (success / fail / pending / underpaid / overpaid / replay /
   out-of-order) — `issues/094` AC.

---

## 3. Per-rail status + what's needed

### MoMo — closest to ready
- **Code:** real adapter EXISTS (`lib/payment/adapters/momo.ts`) — create-order + IPN
  HMAC-SHA256 canonical-string verify done; on sandbox defaults today.
- **Needs:** MoMo **merchant account** (VN business license + signed contract + settlement bank
  account); production `MOMO_PARTNER_CODE` / `MOMO_ACCESS_KEY` / `MOMO_SECRET_KEY`; switch
  `MOMO_ENDPOINT` to prod; register prod `ipnUrl` + `redirectUrl`; implement MoMo **refund** call
  in `lib/payment/refund.ts` (reuse the same HMAC canonical-string scheme).

### ZaloPay — adapter missing
- **Code:** STUB only. Webhook route exists (`app/api/payments/zalopay/webhook`) but routes to the
  stub.
- **Needs:** build `lib/payment/adapters/zalopay.ts` to the `PaymentGateway` interface — ZaloPay
  create-order + **MAC verify** (note: `mac` field with `key1`/`key2`, *not* MoMo's `signature`);
  add `ZALOPAY_*` env; ZaloPay refund call; ZaloPay **merchant account** + contract.

### Card (ATM / Visa / Mastercard) — needs a PSP choice first
- **Code:** STUB only. `card` is a generic placeholder.
- **Needs:** **pick a VN card aggregator** — rebuild-plan [S12] wants ONE aggregator covering
  cards + QR + wallets (candidates: VNPAY, OnePay, 2C2P, Adyen). Then: adapter + env + that PSP's
  webhook signature scheme + refund.
- **Business / compliance:** PSP contract; **PCI-DSS scoping** — use the PSP's hosted/redirect
  checkout so raw card PAN never touches our server (keeps us at SAQ-A); settlement account.
- **OPEN DECISION (S15):** which aggregator. Choosing one that also does QR + wallets can collapse
  card + Apple Pay + (possibly) ZaloPay into a single integration.

### Apple Pay — NOT a standalone rail
- Apple Pay in VN is card-network tokenization delivered **through a card PSP** that supports it
  (Stripe/Adyen/2C2P…). There is no independent Apple Pay gateway or merchant settlement.
- **Needs:** choose a card PSP offering Apple Pay (ties to the Card decision) → enable Apple Pay on
  that merchant account → **Apple Pay web domain verification** (serve
  `/.well-known/apple-developer-merchantid-domain-association` over HTTPS on the prod domain) → add
  the Apple Pay button via the PSP SDK / PaymentRequest API in the card flow. Settlement + webhook
  ride the **card adapter**.
- Optional: add `applepay` to the `PaymentMethod` enum + a UI radio only if you want it tracked
  separately; not required (settlement is still the card PSP).
- **Cannot go live before the card PSP is chosen and live.**

---

## 4. Recommended go-live order

1. **MoMo** — prod keys + refund impl (smallest delta; adapter already real).
2. Flip **`NOTIFY_STUB` off** — real eSMS + email so tickets actually deliver.
3. **Choose the card/QR aggregator** (business decision — gates 4 & 5).
4. **Card + Apple Pay** — one PSP, one adapter, Apple Pay rides it.
5. **ZaloPay** — or drop it if the chosen aggregator already covers wallets.
6. **Real disbursement rail** for operator payouts (replace `settlePayout` stub) — required before
   operators withdraw real money.
7. Per rail: `issues/094` webhook matrix + `issues/101` security gate, **sandbox then prod**.

---

## 5. Decisions needed from the business (not code)

- [ ] Which **card/QR aggregator** (single-aggregator vs per-rail). Drives card + Apple Pay + maybe ZaloPay.
- [ ] Keep **ZaloPay** as a distinct rail, or let the aggregator's wallet support cover it?
- [ ] **Operator payout** mechanism for v1: real bank/aggregator disbursement API vs documented manual payout.
- [ ] Production **domain** (also finalizes `NEXT_PUBLIC_SITE_URL` + Apple Pay domain verification).
