# 16 -- Manual Refund Process Documentation

## Status: DONE

## What changed

Created ops runbook for Phase 1 manual refund process at
`documentation/go-live/GL-006-phase1-launch-scope/manual-refund-runbook.md`.

### Phase 1 refund scope

- **Payment method**: VietQR bank transfer (SePay) + cash at boarding
- **Refund method**: Manual bank transfer from family operator Agribank account
- **No automated PSP refund API** — deferred to Phase 2+ (Issue 094)
- **Low volume**: family operator, single route — manual process is sufficient

### Refund triggers covered

| Trigger | Source | Automation |
|---------|--------|-----------|
| Operator trip cancel | `/api/op/trips/[id]/cancel` | Ledger entries auto-created; bank transfer manual |
| Oversold race | Payment webhook capacity recheck | Ledger entries auto-created; bank transfer manual |
| Admin goodwill/dispute | `/api/admin/finance/refund-out` | Ledger entries via admin endpoint; bank transfer manual |
| Cash booking cancel | Operator verbal | No refund needed (no funds collected) |

### Runbook contents

1. Trigger identification (how to know a refund is needed)
2. Step-by-step manual bank transfer procedure
3. Admin endpoint usage for dispute refunds
4. Reconciliation checklist (ledger vs bank statement)
5. Edge cases (partial refund, duplicate transfer, customer unreachable)
6. Escalation path

## Files

- `documentation/go-live/GL-006-phase1-launch-scope/manual-refund-runbook.md` — new runbook
