# Rollback Plan — PR #7 (rebuild backlog merge)

**PR**: feat/rebuild-complete → master @ 3fc5afba · 162 commits · 849 files
**Author of plan**: review-team fix pass, 2026-06-05
**Decision**: **forward-fix only** for the destructive migrations (no reverse migrations authored).

## Why forward-fix only

The destructive schema changes in this PR are applied against a **fresh-deploy target with no
production data** (the site has not gone live — real PSP/SMS/email are stubbed, no `.env.production`,
go-live gate #101 not run). With no prod rows to preserve, authoring down-migrations to "restore"
dropped columns/enum values would restore empty structure only — no data is recoverable because none
exists. The cost of maintaining reverse migrations exceeds their value at this stage.

This decision MUST be revisited before go-live (#094): once real data exists, every destructive
migration needs a tested reverse path or a documented data-preserving forward-fix.

## Destructive migrations in this PR (no reverse path)

| Migration change | Risk | Forward-fix if regression found |
|------------------|------|---------------------------------|
| `ALTER TABLE "PaymentEvent" DROP COLUMN "resultCode"` (Issue 033) | Drops a column; canonical IPN now uses `providerTxnId` + `currency` | Re-add column via new forward migration; backfill from provider records if ever needed |
| `ALTER TABLE "Booking" DROP COLUMN "cashCollectedAt"` (Issue 088) | Cash rail removed (online-only) | Re-add column via forward migration if cash rail returns (Issue 088 deferred cash deliberately) |
| In-place enum renames: `BookingStatus paid_operator_notified→paid`, `HoldStatus converted→consumed` (Issue 087); `PayoutStatus settled→paid/pending→requested` (Issue 050) | Enum value renamed in place; old values gone | Forward migration to add a new value + data migrate; never an in-place rename back (would re-break) |
| `ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT` | Removes a column default | Re-add default via forward migration |

## Rollback procedure (if the deployed merge regresses)

Because there is no prod data and no reverse migrations:

1. **Code revert (primary path)** — revert the merge commit on `master`:
   ```
   git revert -m 1 <merge-commit-sha>
   git push origin master
   ```
   Redeploy. This reverts ALL application code to the pre-merge state in one commit (the merge was
   made as a merge-commit precisely so the 131-commit history stays bisectable and revertable as a
   unit — see PR #7 review pr-review finding SIZE).

2. **Schema mismatch after code revert** — the reverted code expects the OLD schema (pre-drop
   columns, old enum values), but the DB is on the NEW schema. Since there is no prod data:
   - **Preferred**: re-deploy from the **pre-merge master tag** (tag the pre-merge SHA before
     merging — see below) against a **freshly migrated dev/staging DB** (drop schema + re-run
     migrations to the pre-merge migration, then re-seed). Memory note: reseed needs
     `DROP SCHEMA` because `LedgerEntry` is append-only and `seed.ts` can't clear it.
   - This is acceptable ONLY because no live data is lost.

3. **Feature kill-switches (no full rollback needed)** — most risky surfaces are flag-gated via the
   `FeatureFlag` store (Issue 060, `getFlag` env-override → DB → default). Prefer flipping the
   relevant rail/kill-switch flag OFF over a full code revert when the regression is isolated to one
   subsystem (charter, admin finance, ledger payout). This avoids touching the schema at all.

## Pre-merge requirement (one-time)

Before merging PR #7, tag the current `master` HEAD as the revert anchor:
```
git tag pre-pr7-rollback-anchor <current-master-sha>
git push origin pre-pr7-rollback-anchor
```
This is the re-deploy source for step 2.

## Sign-off
Forward-fix-only is appropriate **only while there is no production data**. Re-author this plan with
real reverse migrations as part of go-live #094.
