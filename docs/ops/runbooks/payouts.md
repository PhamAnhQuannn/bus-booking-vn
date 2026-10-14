# Payouts Runbook — "paid" is ledger-only (manual transfer)

**Status:** ACTIVE (Phase 1, single family operator) · **Refs:** #842, Issue 019 / 050 / 078
**Code:** `lib/ledger/settlePayout.ts` (stub) · `lib/jobs/processPayouts.ts` · cron `process-payouts` (hourly)

## What the system does
- `process-payouts` picks `requested` payouts whose `scheduledAt` has passed, checks the operator's
  `PayoutAccount` is verified (Issue 078 — unverified rows are skipped, not failed), then calls
  `settlePayout()`.
- `settlePayout()` is a **no-network stub that always returns ok** (unless `PAYOUT_SETTLEMENT_FORCE_FAIL`).
- The job therefore flips the row `requested → processing → paid`, stamps `settledAt`, and appends the
  `payout_debit:<payoutId>` ledger entry. The operator console (`/op/money`) shows the payout as **paid**.

## What it does NOT do
**No money leaves the platform account.** `paid` / `settledAt` mean "recorded in the ledger as owed and
drained from the operator balance" — NOT "bank transfer completed". The real transfer is manual.

## Manual transfer procedure (ops, after each process-payouts run that settled rows)
1. List payouts the job marked paid since the last transfer batch (run with the read-only/runtime role):
   ```sql
   SELECT p.id, p."operatorId", p.net, p."settledAt", p."tripId"
   FROM "Payout" p
   WHERE p.status = 'paid' AND p."settledAt" >= '<last batch cutoff>'
   ORDER BY p."settledAt";
   ```
2. For each row, transfer `net` (VND, integer) to the operator's **verified** payout account (the one the
   operator registered in `/op/settings` and admin verified via the approvals queue). Never copy the
   account number into chat/issues. Put the payout id in the transfer memo.
3. Record payout id + bank reference + transfer date in the ops finance log (not in the repo).
4. If a transfer cannot be made, do NOT edit the Payout row or ledger by hand (LedgerEntry is
   append-only). Escalate to the platform owner; any correction is a compensating (forward) entry,
   never an UPDATE/DELETE.

## Revisit trigger
Before onboarding a **second operator** (or any operator who cannot see the platform bank account), this
convention is no longer acceptable (#842: P2 → P1). Required then: an `awaiting_manual_transfer` state +
admin "mark paid" action (or a real bank rail behind `settlePayout`, moved to claim-then-dispatch outside
the job transaction), so "paid" in the operator console means the money actually left.
