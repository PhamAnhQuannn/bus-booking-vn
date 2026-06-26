# Backwards Compatibility Review: PR #148 (Round 2)

| Field | Value |
|-------|-------|
| PR | [#148](https://github.com/PhamAnhQuannn/bus-booking-vn/pull/148) |
| Title | feat(payment): add bank transfer via SePay/VietQR |
| Branch | working branch -> `master` |
| Stats | ~600 lines added, ~10 lines modified across 14 files |
| Reviewed | 2026-06-24 |

## Verdict: PASS (no blocking findings)

Round 1 false positive resolved: HOLD_SWEEPER_MODE default was NOT changed in this PR (still `'count'`). All changes are additive. Existing payment methods, CI pipelines, and deployments are unaffected. No schema migrations, no DB changes, no existing API contract modifications.

---

## 1. API Shape Breaks

### 1.1 Existing Endpoints (PASS -- no changes)

No existing route handler files are modified in ways that alter their request/response contracts. The only existing route touched is `app/api/bookings/initiate/route.ts`:

- **Zod enum widened**: `paymentMethod: z.enum(['momo', 'zalopay', 'card', 'vnpay'])` -> `z.enum(['momo', 'zalopay', 'card', 'vnpay', 'bank_transfer'])`. This is a **backward-compatible union extension** -- all previously valid values remain valid. No existing consumer sends `bank_transfer` yet.

### 1.2 New Endpoints (INFO -- additive only)

| Endpoint | File | Purpose |
|----------|------|---------|
| GET `/api/bookings/status` | `app/api/bookings/status/route.ts` | Polling endpoint for payment status by bookingRef |
| POST `/api/payments/bank_transfer/webhook` | `app/api/payments/bank_transfer/webhook/route.ts` | SePay IPN receiver |

Both are new routes. No collision with existing paths. Neither modifies any existing handler.

### 1.3 New Page Route (INFO -- additive only)

- `/booking/bank-transfer` -- new server component page + client component. No conflict with existing routes.

---

## 2. Type Union Extensions

### 2.1 OnlinePaymentMethod (PASS)

`lib/payment/select.ts`: `'momo' | 'zalopay' | 'card' | 'vnpay'` -> `'momo' | 'zalopay' | 'card' | 'vnpay' | 'bank_transfer'`

Backward-compatible union widening. All existing switch/if branches for `momo`, `vnpay`, etc. are unchanged. The new `bank_transfer` branch is inserted **before** the `PAYMENTS_STUB` check in `getGatewayFor()`, so it always returns the real adapter regardless of stub mode -- this is intentional since bank transfer has no external PSP call for `createPayment` (it returns an internal redirect URL).

### 2.2 OnlineBookingMethod (PASS)

`lib/booking/bookingRepo.ts`: `'momo' | 'zalopay' | 'card' | 'vnpay'` -> `'momo' | 'zalopay' | 'card' | 'vnpay' | 'bank_transfer'`

Same backward-compatible union extension pattern.

### 2.3 ProcessPaymentWebhookInput.adapter comment (PASS)

`lib/payment/processWebhook.ts`: JSDoc comment updated to include `'bank_transfer'` in the adapter label list. The field type is `string` -- no runtime change. `processPaymentWebhook` itself is unchanged; it remains gateway-agnostic.

---

## 3. Environment Variables

### 3.1 New Variables (PASS -- all have defaults or are optional)

| Variable | Default | Required when |
|----------|---------|---------------|
| `SEPAY_API_KEY` | `undefined` (optional) | `PAYMENTS_STUB=false` (superRefine conditional) |
| `VIETQR_BANK_BIN` | `'970405'` | Always has default |
| `VIETQR_ACCOUNT_NUMBER` | `'3516205005863'` | Always has default |
| `VIETQR_ACCOUNT_NAME` | `'BUS BOOK VN'` | Always has default |
| `VIETQR_TEMPLATE` | `'compact2'` | Always has default |

**Existing deployments**: All 4 `VIETQR_*` vars have Zod `.default()` values. `SEPAY_API_KEY` is `.optional()` at the schema level. The superRefine conditional only fires when `PAYMENTS_STUB=false` -- existing deployments with `PAYMENTS_STUB=true` (or default `'false'` in non-production) are unaffected.

### 3.2 .env.example (PASS)

- `SEPAY_API_KEY` is commented out (not set by default), matching its optional schema
- All 4 `VIETQR_*` vars have values matching the Zod defaults

### 3.3 CI env vars (PASS -- no changes needed)

Checked `.github/workflows/ci.yml`:
- **Integration tests** (line 102): `PAYMENTS_STUB: 'true'` -- SEPAY_API_KEY not needed
- **E2E tests** (line 161): `PAYMENTS_STUB: 'true'` -- SEPAY_API_KEY not needed
- **E2E build** (`pnpm build` with `NODE_ENV=production`): The superRefine production block (line 456-465) does NOT include SEPAY_API_KEY -- it only checks `JWT_SECRET`, `JWT_OPERATOR_SECRET`, etc. The SEPAY_API_KEY superRefine (line 370-378) is gated on `!env.PAYMENTS_STUB`, and CI sets `PAYMENTS_STUB='true'`, so this check is skipped. **No CI breakage.**

### 3.4 Data Leak Audit Script (PASS)

Checked `scripts/audit/data-leak-grep.sh` -- no scope guard on `SEPAY_API_KEY` (only `OTP_PEEK_ENABLED` has one at A7). Adding SEPAY_API_KEY to the Zod schema is safe per WT-20 rule.

### 3.5 Greppable Invariants Script (PASS)

Checked `scripts/audit/greppable-invariants.sh` -- no references to SEPAY/VIETQR/bank_transfer. No invariant to violate.

---

## 4. PAYMENTS_STUB=true Path

### 4.1 Existing methods unaffected (PASS)

`getGatewayFor()` in `lib/payment/select.ts`:
- `bank_transfer` check is inserted at line 31, **before** any `PAYMENTS_STUB` check
- The existing `momo`, `vnpay`, `zalopay`, `card` branches at lines 35-44 are unchanged
- When `PAYMENTS_STUB=true`, `momo`/`zalopay`/`card` still route to `getStubAdapter()` as before
- When `PAYMENTS_STUB=false`, `momo` still routes to `getMomoAdapter()`, `vnpay` to `getVnpayAdapter()`

### 4.2 Bank transfer intentionally bypasses stub (PASS)

The `bank_transfer` adapter returns an internal redirect URL (`/booking/bank-transfer?...`) -- no PSP HTTP call. `createPayment()` builds the URL from env defaults and returns `{ ok: true, payUrl, externalRef }`. No network I/O. Bypassing the stub check is correct behavior.

---

## 5. Schema Changes

**None.** No new migrations, no Prisma schema changes, no table/column additions. The `PaymentEvent` table already stores `adapter` as a `string` field -- the new `'bank_transfer'` value is just a new string literal, no enum to extend.

---

## 6. Proxy / Middleware Changes

### 6.1 CSRF_EXEMPT Set (PASS)

`proxy.ts` line 76: `'/api/payments/bank_transfer/webhook'` added to `CSRF_EXEMPT` Set. This is the correct pattern -- all webhook endpoints are CSRF-exempt because they authenticate via bearer token, not session cookies. Exact-match Set (not prefix-match) per the Issue 010 rule.

### 6.2 Booking Layout TOKEN_LANDING_PREFIXES (PASS)

`app/(customer)/booking/layout.tsx` line 16: `'/booking/bank-transfer'` added to `TOKEN_LANDING_PREFIXES`. This prevents the booking layout from redirecting away when the user lands on the bank transfer page. Same pattern as `/booking/confirmation` and `/booking/result`.

---

## 7. Client Component Safety

### 7.1 BankTransferClient.tsx (PASS)

First line: `'use client'`. Imports only:
- `react` (useEffect, useState)
- `next/navigation` (useRouter, useSearchParams)
- `lucide-react` (icons)

**No domain barrel imports.** No `@/lib/auth`, `@/lib/booking`, `@/lib/payment` -- fully compliant with the barrel-leak rule from the operator-smoke mistake log entry.

### 7.2 BankTransferPage (server component) (PASS)

Imports `getBookingByRef` from `@/lib/booking` (barrel). This is a server component (no `'use client'` directive), so barrel imports are correct. Does NOT self-fetch an API route -- calls `getBookingByRef()` in-process per the Issue 003 mistake log rule.

---

## 8. Webhook Security

### 8.1 Bearer token verification (PASS)

`app/api/payments/bank_transfer/webhook/route.ts`:
- Uses `crypto.timingSafeEqual` for constant-time comparison (line 38-39)
- Handles length-mismatch case (Buffer length check before timingSafeEqual)
- Returns 401 for missing auth, invalid token, or unconfigured SEPAY_API_KEY
- Uses `req.text()` (not `req.json()`) to get raw body before passing to adapter

### 8.2 Logger redaction (PASS)

`lib/logger.ts`: `'SEPAY_API_KEY'` added to redact list. Compliant with the "add proof field to logger redact list in the same commit" rule.

---

## 9. New Barrel Exports

### 9.1 lib/booking/index.ts (PASS)

Two new exports:
- `getBookingByRef` -- new function in `bookingRepo.ts`
- `BOOKING_REF_REGEX` -- re-exported from `bookingRef.ts`

Both are additive. No existing exports removed or renamed.

### 9.2 lib/payment/index.ts (PASS)

One new export: `getBankTransferAdapter` from `adapters/bankTransfer.ts`. Additive only.

---

## 10. New Dependencies

### 10.1 @playwright/mcp (INFO -- devDependency only)

`package.json`: `"@playwright/mcp": "^0.0.76"` added to `devDependencies`. This is a development-only tool (MCP server for Playwright browser automation). Not shipped in production bundle.

**Lock resolution**: Pulls `playwright@1.61.0-alpha-1781023400000` and `playwright-core@1.61.0-alpha-1781023400000` as transitive deps. These coexist alongside the existing `playwright@1.60.0` used by `@playwright/test`. No version conflict -- pnpm handles multiple versions correctly.

**License**: Playwright is Apache-2.0/MIT. No licensing concern.

**Typosquat risk**: `@playwright/mcp` is under the `@playwright` npm org (owned by Microsoft). Low risk.

---

## 11. Test Coverage

### 11.1 New Unit Tests (PASS)

- `app/api/bookings/status/__tests__/route.test.ts` -- 6 test cases covering validation, 404, 200, query shape, case sensitivity
- `app/api/payments/bank_transfer/webhook/__tests__/route.test.ts` -- 6 test cases covering auth, no-op on unmatched memo, delegation to processPaymentWebhook
- `lib/payment/__tests__/bankTransfer.test.ts` -- 11 test cases covering createPayment URL generation and verifyWebhook parsing (valid, invalid JSON, zero amount, negative amount, outbound transfer, missing booking ref, empty content, non-numeric amount)

### 11.2 Booking ref regex usage (PASS)

Status route (`app/api/bookings/status/route.ts` line 16) imports `BOOKING_REF_REGEX` from the barrel, not re-typing the pattern. Compliant with Issue 003 mistake log rule. The webhook test uses test booking refs matching the lowercase base36 pattern (`BB-2026-abcd-ef01`).

---

## 12. Round 1 False Positive Resolution

Round 1 flagged a P1 "HOLD_SWEEPER_MODE default 'count' -> 'update'" change. **This was a false positive.** The PR diff shows no modification to `HOLD_SWEEPER_MODE` -- it remains `z.enum(['count', 'update']).default('count')` at line 25 of `lib/config/env.ts`. The P1 and P2 findings from round 1 are withdrawn.

---

## Summary Table

| Category | Findings | Blocking | Verdict |
|----------|----------|----------|---------|
| API shape breaks | 0 (1 Zod enum widened -- backward-compatible) | 0 | PASS |
| New endpoints | 2 additive, no collisions | 0 | PASS |
| Type unions | 2 widened (backward-compatible) | 0 | PASS |
| Env vars | 5 new (4 with defaults, 1 conditional-required) | 0 | PASS |
| CI env | No changes needed (PAYMENTS_STUB=true skips SEPAY check) | 0 | PASS |
| PAYMENTS_STUB path | Existing methods unchanged; bank_transfer bypass intentional | 0 | PASS |
| Schema changes | None | 0 | PASS |
| Proxy/middleware | 1 CSRF exemption added (correct pattern) | 0 | PASS |
| Client component safety | No barrel imports in 'use client' | 0 | PASS |
| Webhook security | Bearer token with timingSafeEqual, logger redaction | 0 | PASS |
| New dependencies | 1 devDep (@playwright/mcp) -- MIT, no prod impact | 0 | PASS |
| Test coverage | 23 new test cases across 3 files | 0 | PASS |
