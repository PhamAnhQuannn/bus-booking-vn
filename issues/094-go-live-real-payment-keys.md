---
depends-on: [032-fix-payment-amount-verify, 033-canonical-event-providertxnid-currency, 034-monotonic-transition-guard, 051-refund-out-rail, 052-chargeback-payout-reversal, 058-notification-dispatcher-stub, 074-async-pdf-s3, 068-admin-finance-stepup, 080-operator-console-restructure, 095-payment-recon-sweeper, 100-hold-lapse-refund, 101-pre-go-live-security-fraud-gate]
type: FEATURE
wave: 9
spec: [S12, SYS06, SYS09, SYS17]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S12] / [SYS06] / [SYS09] — GO-LIVE gate

## What to build

**The last step before product ship.** Un-defer the stubs (project memory: real PSP/eSMS
deferred, site runs on `PAYMENTS_STUB`) and verify payment end-to-end from every side, on the
final consolidated codebase (after Wave 8).

- **Real credentials for every payment service**: MoMo + ZaloPay + card/VN-PSP — load real keys
  (env / DB flag store, issue 060) and flip `PAYMENTS_STUB` OFF per rail (can stage rail-by-rail
  via the rail toggles). Real eSMS + email creds; flip `NOTIFY_STUB` OFF.
- **Test the payment form from all sides** (each enabled rail):
  - Customer happy path: initiate → PSP redirect/QR → webhook → `paid` → ticket QR/PDF + SMS/email.
  - Webhook matrix: success / failure / pending / **underpaid → reject** (issue 032) / **overpaid →
    refund-difference** (issue 051) / **replay → idempotent no-op** (033) / **out-of-order →
    monotonic reject** (034).
  - Refund-out (issue 051) + chargeback/payout_reversal (issue 052) round-trip against the PSP
    sandbox, then prod.
  - Double-submit / retries → exactly one pending per `orderRef`.
  - Recon sweeper picks up + expires stuck `awaiting_payment` (SYS06).
  - eSMS + email actually deliver via the dispatcher (issue 058).
- Verify amounts/currency are VND integer end-to-end; no FX. Secrets never logged (redaction).
- Operator Money (issue 080) + admin Finance (issue 068) reflect real settled money.

## Acceptance criteria

- [ ] Real keys loaded for MoMo + ZaloPay + card/VN-PSP + eSMS/email; `PAYMENTS_STUB` /
      `NOTIFY_STUB` OFF (or per-rail toggled) in the target env.
- [ ] Each enabled rail completes a real end-to-end paid booking → ticket delivered (SMS+email).
- [ ] Webhook matrix verified: success/fail/pending/underpaid/overpaid/replay/out-of-order all
      behave per spec (no money-loss, no double-confirm, no backward transition).
- [ ] Refund-out + chargeback round-trip verified against the PSP.
- [ ] Double-submit yields one pending; recon sweeper clears stuck pendings.
- [ ] No secret/PII in logs or Sentry; amounts VND-only.
- [ ] `/smoke-test` (all rails) + `/payment-reconciliation` + `/prod-smoke` green.

## Blocked by

- Blocked by the full payment+notification+ledger stack:
  `issues/032`, `033`, `034`, `051`, `052`, `058`, `074`, `068`, `080`.

## User stories addressed

- [S12]/[SYS06] real central collection across rails, verified server-side; go-live readiness.
