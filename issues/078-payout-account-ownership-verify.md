---
depends-on: [077-kyb-doc-submit]
type: FEATURE
wave: 5
spec: [S05, SYS12, S08]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S05] / [SYS12]

## What to build

**Payout-account ownership verification** — confirm the operator owns the registered payout
bank account, via **micro-deposit OR name-match** (admin confirms at approval, [S05]/SYS12).
The platform only ever SENDS to this account (no read access to the operator's bank).

- `model PayoutAccount(operatorId, bankName, accountNumber, accountHolderName, verifiedAt?,
  verifyMethod?)` + migration (the bank account the operator registers to receive payouts).
- Verify method: micro-deposit (record a small deposit + operator confirms the amount) OR
  name-match (registered holder name vs business name) — implement at least one + leave a
  documented hook for the other.
- Admin confirms ownership at approval (surfaced in Approvals, issue 065); confirmation sets
  `verifiedAt` + audit-logged.
- This account is the destination for payouts (issue 050/053) — wire the link.

## Acceptance criteria

- [ ] `PayoutAccount` model + migration; operator registers the account (no platform read of
      their bank).
- [ ] At least one ownership-verify method implemented (micro-deposit or name-match); the
      other hooked + documented.
- [ ] Admin confirmation at approval sets `verifiedAt` + audit-logs it.
- [ ] Payout destination links to the verified account.

## Blocked by

- Blocked by `issues/077-kyb-doc-submit.md`

## User stories addressed

- [S05] payout-account ownership verify (micro-deposit/name-match); platform only sends.
