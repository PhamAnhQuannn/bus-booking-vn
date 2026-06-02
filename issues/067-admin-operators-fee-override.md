---
depends-on: [056-admin-middleware-segment, 048-feeconfig-model, 045-operator-approval-state-machine]
type: FEATURE
wave: 3
spec: [S11, S08]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S11] (Operators tab)

## What to build

Admin **Operators** tab — all operators + status, operator detail, suspend/reinstate,
per-operator fee override.

- List all operators with status (045 enum), suspend/reinstate (045 transition service,
  step-up for suspend).
- Operator detail: fleet / trips / volume / balance (ledger SUM, issue 050) / payout history.
- **Per-operator fee override**: create a new effective-dated `FeeConfig` row (issue 048)
  scoped to the operator — never edit in place; change-audited. Step-up TOTP required.
- Audit-logged.

## Acceptance criteria

- [ ] Operators list with status; suspend/reinstate via 045 service (step-up for suspend).
- [ ] Operator detail shows fleet/trips/volume/balance/payout history.
- [ ] Fee override writes a new operator-scoped FeeConfig effective row (no in-place edit);
      step-up required; audit-logged.
- [ ] Behind admin auth; finance/super-admin for fee override.

## Blocked by

- Blocked by `issues/056-admin-middleware-segment.md`, `issues/048-feeconfig-model.md`,
  `issues/045-operator-approval-state-machine.md`

## User stories addressed

- [S11] admin Operators: list/detail, suspend/reinstate, per-operator fee override.
