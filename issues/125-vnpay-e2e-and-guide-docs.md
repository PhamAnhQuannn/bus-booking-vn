---
depends-on: [121-vnpay-checkout-option, 123-psp-fee-ledger]
type: TEST
wave: 1
---

## Parent PRD

Plan: `C:\Users\mrimp\.claude\plans\what-is-jwt-why-sparkling-crescent.md` — §G (e2e) + §H (guide docs).

## What to build

End-to-end proof + the user-facing operator/ops documentation. Adds the VNPay e2e spec, fixes the stale momo spec, and refreshes the setup guides so the user knows exactly what THEY must do by hand (VNPay onboarding, MDR rate, Vercel env, SePay coupling, chargeback runbook, smoke test).

## Acceptance criteria

- [ ] `e2e/vnpay-booking.spec.ts` — initiate → VNPay redirect → return page; IPN success/pending/failure code paths; return-URL dual-confirmation. Uses a VNPay HMAC-SHA512 signature helper (shared with issue 120). Asserts the `psp_fee` row is written on paid (dep on 123). Runs against the stub gateway in CI.
- [ ] `e2e/momo-booking.spec.ts` — fix/gate the silent self-skip (`test.skip(!initiateRes.ok(), ...)` masks the Phase-1 enum 400); no longer dead coverage masquerading as passing.
- [ ] `documentation/guides/13-setup-vnpay.md` refreshed: top **"Your manual checklist (HITL)"** box (7 items, checkboxes); **coupling warning** (`PAYMENTS_STUB=false` forces real `SEPAY_API_KEY` + `VIETQR_ACCOUNT_NUMBER` + `DIRECT_URL` — do `06-setup-sepay.md` first); **MDR fee-rate** step (provide contract rate → swap the `VNPAY_MDR_RATE` const from issue 123); **chargeback operational runbook** (out-of-band dispute → admin records in Finance tab → platform-absorb; evidence retained = ticket, boarding scan, manifest, consent); correct the stale claim that the 3 return pages already exist. Keep the accurate signature/response-code/troubleshooting sections.
- [ ] `documentation/guides/README.md` — move VNPay from "Phase 2 deferred" to active/enabled (alongside bank transfer) + SePay-coupling cross-note.
- [ ] `pnpm test:e2e` passes locally against the running dev server (stub gateway).

## Blocked by

- Blocked by `issues/121-vnpay-checkout-option.md` (needs the checkout flow live).
- Blocked by `issues/123-psp-fee-ledger.md` (e2e asserts the psp_fee row).

## User stories addressed

E2E verification + operator/admin operational documentation.
