---
depends-on: [021-fix-auth-open-redirect, 026-fix-staff-rsc-role-gate, 031-attach-hardening-authed-booking, 033-canonical-event-providertxnid-currency, 034-monotonic-transition-guard, 035-lock-price-after-paid-seat, 036-oversell-for-update-at-sell, 046-approval-gate-search-booking, 047-ledger-entry-model-immutability, 051-refund-out-rail, 052-chargeback-payout-reversal, 054-admin-auth-core, 055-admin-totp-step-up, 056-admin-middleware-segment, 057-admin-bootstrap-totp-recovery, 062-admin-audit-immutability, 068-admin-finance-stepup, 071-qr-signed-token, 073-atomic-checkin-scan-noshow, 078-payout-account-ownership-verify, 087-split-paid-operator-notified, 089-checkout-consent-capture, 090-retention-policy-job, 095-payment-recon-sweeper, 096-edge-rate-limit-middleware, 098-concurrent-hold-cap, 100-hold-lapse-refund]
type: FEATURE
wave: 8.5
spec: [S10, S13, S14, SYS13, SYS14]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S10] / [S13] / [S14] / [SYS13] / [SYS14] — PRE-GO-LIVE GATE

## What to build

A **security & fraud sign-off gate** run on the fully-stubbed product **before any real external
key is wired** (issue 094). This is the hard boundary the project requires: every function works
locally on `PAYMENTS_STUB` + `NOTIFY_STUB`, all tests pass, and all fraud / security / vulnerability
work is closed and adversarially verified — THEN, and only then, real keys go in (094) and real
money is tested.

- Confirm every 🔒 prerequisite issue in `depends-on` is DONE (money-integrity, approval gate,
  ledger immutability, refund/chargeback, admin auth + TOTP + step-up, audit immutability, QR
  signed token + single-use check-in, payout-account ownership, consent, retention, recon sweeper,
  edge rate-limit, hold cap, hold-lapse refund, auth fixes).
- Run the adversarial passes on the stubbed system: `/threat-model`, `/security-review-deep`,
  `/attack-surface-pre`, `/pen-test-procurement-plan`, `/bug-bounty-pre`.
- Enumerate + actively verify the fraud / abuse scenarios end-to-end:
  - payment **tampering / underpayment** rejected; webhook **replay / out-of-order** can't double-
    confirm or regress paid (monotonic);
  - **oversell race** (two buyers, last seat) clean-rejects; **concurrent-hold** cap holds;
  - ticket **QR reuse** / forged token rejected; single-use **check-in** atomic;
  - **refund / chargeback** abuse + double-refund idempotency;
  - **admin privilege-escalation** (role tiers, step-up, invite-only, separate cookie scope);
  - **cross-tenant leakage** (operator/staff scope);
  - **OTP / rate-limit bypass**; open-redirect; CSRF.
- Produce `docs/qa/pre-go-live-security-signoff.md`: scenario matrix, residual-risk register,
  explicit GO / NO-GO.

## Acceptance criteria

- [ ] Every issue in this `depends-on` list is marked DONE.
- [ ] `docs/qa/pre-go-live-security-signoff.md` committed with a scenario matrix + GO/NO-GO.
- [ ] **Zero open P1 security/fraud findings** (any P1 spawns a fix-issue and re-gates).
- [ ] Full local E2E + unit/integration suite GREEN on `PAYMENTS_STUB` + `NOTIFY_STUB`.
- [ ] Sign-off explicitly authorizes proceeding to issue 094 (real keys).

## Blocked by

- The entire `depends-on` list above — this gate cannot start until all 🔒 security/fraud/
  correctness work is complete.

## User stories addressed

- [S14] / [S13] / [S10] As platform, no real-money path ships until the stubbed product passes an
  adversarial security + fraud review — real keys are the last step, never before hardening.
