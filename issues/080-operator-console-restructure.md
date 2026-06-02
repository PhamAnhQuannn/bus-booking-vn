---
depends-on: [045-operator-approval-state-machine, 050-balance-payout-state-machine, 053-on-demand-withdraw, 078-payout-account-ownership-verify]
type: FEATURE
wave: 5
spec: [S09, S08]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [S09] (operator dashboard layout)

## What to build

Restructure the operator console to the spec **6 + banner** nav and add the missing **Money**
page + **bank-account settings** + **approval banner**. Today nav is a flat 12-item list
(`components/op/navConfig.ts`), there's no Money page, no approval banner, no bank-account
surface.

- Nav → `Overview · Fleet · Trips · Bookings · Money · Settings` + **approval banner** (while
  pending). Fold the extras: `activity`→Overview Alerts; `upcoming`→Fleet→bus-detail;
  `routes`→sub-tab under Trips; remove `trip-templates`/`reports-overview`/`reports-revenue`
  top tabs (BI is OUT, [S09]).
- **Money page** (`/op/money`): balance 3 numbers (pending/available/paid-out, issue 050) +
  ledger view + payout (Withdraw button → issue 053; next auto-payout) + statements.
- **Settings**: add payout **bank-account** registration (issue 078) alongside profile +
  staff + first-login.
- **Approval banner** (pending only): "Under review — SLA. Set up buses + draft trips now;
  publishing unlocks on approval." Reads operator status (issue 045); blocks publish/sell.
- **Overview** 4-box (Today / Fleet / Money-with-Withdraw / Alerts). **Bookings** default to
  today's VN-tz date (currently `''` = all). Manifest defaults to next departure.

## Acceptance criteria

- [ ] Nav is 6 groups + approval banner; extra top tabs removed/folded; Routes under Trips.
- [ ] `/op/money` shows balance (3 numbers) + ledger + withdraw + next-auto-payout +
      statements.
- [ ] Settings has payout bank-account registration (issue 078).
- [ ] Approval banner shows for pending operators + blocks publish/sell.
- [ ] Overview 4-box; Bookings defaults to today (VN tz); manifest defaults to next departure.

## Blocked by

- Blocked by `issues/045-operator-approval-state-machine.md`,
  `issues/050-balance-payout-state-machine.md`, `issues/053-on-demand-withdraw.md`,
  `issues/078-payout-account-ownership-verify.md`

## User stories addressed

- [S09] operator console: 6+banner nav, Money page, bank account, approval banner.
