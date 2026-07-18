---
depends-on: [120-vnpay-adapter-test-harden]
type: FEATURE
wave: 1
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\what-is-jwt-why-sparkling-crescent.md` — §A + §B + §C.

## What to build

The customer-facing tracer bullet: let a buyer **choose VNPay or bank transfer** at checkout, end-to-end. Adds the payment-method selector, opens the API gate, and creates the 3 VNPay return-destination pages that currently 404.

## Acceptance criteria

- [ ] `app/(customer)/booking/review/ReviewClient.tsx` — replace the static payment-method card (lines 108-117) with a **two-option native-radio selector** (bank_transfer default first / vnpay). Reuse the `fieldset`/`legend`/`accent-primary` pattern from `app/(customer)/booking/customer/CustomerForm.tsx:219-251` (NOT `components/ui/radio-group.tsx`). Selected state `border-primary bg-primary/5` vs `border-border hover:border-primary/30` via `cn`.
- [ ] `useState<'bank_transfer'|'vnpay'>('bank_transfer')`; the initiate `fetch` body sends the selected method (replace hardcoded `'bank_transfer'`). Radios `disabled={submitting}`.
- [ ] VN copy: `"Chuyển khoản ngân hàng (VietQR)"` + `"Quét mã QR và chuyển khoản, xác nhận tự động trong vài phút"`; `"VNPay (thẻ ATM / thẻ quốc tế / QR)"` + `"Bạn sẽ được chuyển đến trang thanh toán của VNPay"`.
- [ ] `app/api/bookings/initiate/route.ts:36` Zod enum widened `['bank_transfer']` → `['bank_transfer','vnpay']`; header comment updated. `initiate.route.test.ts` gains a `vnpay`→200 positive case (keep momo/zalopay/card→400).
- [ ] Three return-destination pages created: `app/(customer)/booking/confirmation` (query-param `?ref=` form — distinct from existing `[token]` route), `app/(customer)/booking/payment-pending`, `app/(customer)/booking/payment-error`. `app/api/payments/vnpay/return/route.ts` already redirects to these.
- [ ] `clientIp` threaded through so `vnp_IpAddr` is the real IP: `initiate/route.ts` (`clientIp(req.headers)`) → `lib/booking/initiateOnlineBooking.ts:187-194` → `gateway.createPayment` (`CreatePaymentInput.clientIp` exists, `lib/payment/gateway.ts:30-31`).
- [ ] `pnpm tsc --noEmit` + `pnpm lint` clean; `pnpm test` green.

## Blocked by

- Soft-dep on `issues/120-vnpay-adapter-test-harden.md` (adapter tested before it's reachable). Can start in parallel if desired.

## User stories addressed

Checkout multi-payment (Phase 2 restore — the file header comment in ReviewClient.tsx documents this extension point).
