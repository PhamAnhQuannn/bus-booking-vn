---
depends-on: []
type: FEATURE
wave: 1
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\what-is-jwt-why-sparkling-crescent.md` — §D.

## What to build

Make `VNPAY_ENABLED` a real runtime kill-switch and close the secret-redaction gap. Today `lib/payment/select.ts` keys only on `PAYMENTS_STUB` and ignores `VNPAY_ENABLED` (dead flag, flagged in PR259 reviews) — so `PAYMENTS_STUB=false` silently constructs a "real" VNPay adapter even if VNPay was never configured, potentially pointed at sandbox defaults.

**Code is AFK.** Real credential provisioning in Vercel is the user's HITL step (documented in issue 125 guide docs) — NOT part of this issue.

## Acceptance criteria

- [ ] `lib/payment/select.ts` — `getGatewayFor('vnpay')` returns the real adapter ONLY when `VNPAY_ENABLED && !PAYMENTS_STUB`; otherwise the stub. `VNPAY_ENABLED` is now a true kill-switch.
- [ ] `lib/logger.ts:103-108` redact list gains `VNPAY_HASH_SECRET` and `VNPAY_TMN_CODE` (defense-in-depth; matches the existing `SEPAY_API_KEY`/`ESMS_*`/`MISA_*` convention).
- [ ] `lib/payment/__tests__/select.test.ts` widened for the `vnpay && VNPAY_ENABLED && !PAYMENTS_STUB` → real-adapter branch AND the `vnpay && !VNPAY_ENABLED` → stub branch.
- [ ] `.github/workflows/ci.yml` unchanged (sets `PAYMENTS_STUB=true`, never flips `VNPAY_ENABLED` — confirmed no placeholder needed).
- [ ] `pnpm tsc --noEmit` + `pnpm lint` + `pnpm test` clean.

## Blocked by

None — can start immediately.

## Notes

Pairs with the user's HITL Vercel-env step. Coupling reminder for the guide (issue 125): `PAYMENTS_STUB=false` forces real `SEPAY_API_KEY` + `VIETQR_ACCOUNT_NUMBER` + `DIRECT_URL` per `lib/config/env.ts` superRefine.
