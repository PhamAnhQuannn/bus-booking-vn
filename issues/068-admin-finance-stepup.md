---
depends-on: [056-admin-middleware-segment, 055-admin-totp-step-up, 051-refund-out-rail, 052-chargeback-payout-reversal, 048-feeconfig-model]
type: FEATURE
wave: 3
spec: [S11, S13, S08]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S11] (Finance tab — step-up auth)

## What to build

Admin **Finance** tab (all actions step-up-gated, issue 055) — payout oversight, ledger view,
manual adjustments, refund-out execution, chargeback/dispute flow, FeeConfig editor.

- Payout oversight: queue / approve / retry payouts (issue 050 state machine).
- Ledger view for any operator (read the immutable `LedgerEntry`, issue 047) + manual
  **adjustment** entry (type `adjustment`, reason required, immutable — append-only).
- **Refund-out execution** UI (operator-cancel / oversold / overpay) → calls issue 051 rail.
- **Chargeback / dispute** flow → calls issue 052 (`chargeback` + `payout_reversal`,
  liability per S15#7).
- **FeeConfig editor** (global rate + per-operator override, effective-dated, change-audited
  — issue 048).
- Every action requires step-up TOTP + is audit-logged.

## Acceptance criteria

- [ ] Payout queue: approve/retry via issue-050 state machine.
- [ ] Ledger view (any operator) + manual adjustment entry (reason required, immutable).
- [ ] Refund-out execution wired to issue 051; chargeback flow wired to issue 052.
- [ ] FeeConfig editor writes effective-dated rows (issue 048).
- [ ] All Finance actions require step-up TOTP + are audit-logged.

## Blocked by

- Blocked by `issues/056-admin-middleware-segment.md`, `issues/055-admin-totp-step-up.md`,
  `issues/051-refund-out-rail.md`, `issues/052-chargeback-payout-reversal.md`,
  `issues/048-feeconfig-model.md`

## User stories addressed

- [S11] admin Finance: payout oversight, ledger view+adjustment, refund-out, chargeback,
  FeeConfig.
