---
depends-on: []
type: TEST
wave: 1
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\what-is-jwt-why-sparkling-crescent.md` — "Enable VNPay alongside bank_transfer at checkout" (§G, foundation-first).

## What to build

Lock down the **already-shipped but untested** money-critical VNPay code BEFORE checkout exposes it. The VNPay adapter's HMAC-SHA512 verify (`lib/payment/adapters/vnpay.ts`) has ZERO tests today; the webhook + return routes have none either. Add full coverage mirroring the existing `bank_transfer` / `momo` test patterns, and re-audit the HD-006 hardening doc for the VNPay-ships trigger.

No behavior change — this slice is tests + docs only.

## Acceptance criteria

- [ ] `lib/payment/__tests__/vnpay.test.ts` covers: valid signature, `sig_mismatch`, `missing_signature`, RAW-vs-URL-encoded sign-data correctness, `classifyVnpayStatus` for every success (`00`) / failure (`24,51,65,75,11,12,13`) / pending (`01,02`) code + an unmapped code → `unknown`, and the `invalid_amount` guard.
- [ ] Route tests for `app/api/payments/vnpay/webhook` — GET vs POST body reconstruction; `00/97/01/99` (`SUCCESS`/`INVALID_CHECKSUM`/`ORDER_NOT_FOUND`/`UNKNOWN_ERROR`) response mapping; mirrors `app/api/payments/bank_transfer/webhook/__tests__`.
- [ ] Route tests for `app/api/payments/vnpay/return` — sig-invalid, zero-amount attack, success/pending/error redirects.
- [ ] `documentation/hardening/HD-006-payment-webhook-security/README.md` re-audited: chargeback/holdback section, VNPay SHA-512 HMAC writeup, `tmnCode` credential handling (the doc self-flags this at line 9/82/101-105).
- [ ] `pnpm test` green; no source behavior change.

## Blocked by

None — can start immediately.

## Notes

Money-critical foundation. Use a VNPay HMAC-SHA512 signature helper in tests (RAW-value canonical string, alphabetical sort) — reused later by `e2e/vnpay-booking.spec.ts` (issue 125).
