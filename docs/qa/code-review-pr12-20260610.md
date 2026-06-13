CODE REVIEW — PR #12 "feat(pickup): route-scoped pickup areas + trip display polish (issue 113)" @ 8c15605a
────────────────────────────────
Diff scope: 263 files, ~28K lines (full branch). Review focused on latest commit (22 files, +695 -23).

PRIORITY 1 — Block push, fix first:
  (none)

PRIORITY 2 — Fix before merge:
  (none)

PRIORITY 3 — Address when convenient:
  [READABILITY] app/op/(console)/routes/RoutePickupAreaDialog.tsx:115
    handleSave success path doesn't call setBusy(false). Parent unmounts dialog
    on save so this is cosmetic — but breaks component contract if reuse changes.
    Fix: add finally { setBusy(false) } or reset after onSaved().

NOTES:
  - Route handler auth: requireOperatorAuth + withOperatorScope ownership check. Correct.
  - Input validation: Zod schema with z.array(z.string()).max(100). Correct.
  - Service layer: full-replace semantics in $transaction (delete + createMany). Dedup via Set. Correct.
  - Schema/migration parity: @@unique and @@index declared in both DSL and SQL. Backfill seeds
    existing routes with full operator menu. Correct per Issue 007 rule.
  - createTrip validation: added routeAreas: { some: { routeId } } filter. Correct scope narrowing.
  - Trip DTO display fields: optional, populated only when query loads relations. Clean extension.
  - tripRef inlined in TripDetailClient to avoid barrel import in 'use client' component (boundaries rule).
  - No Mistake Log patterns triggered in this diff.

SUMMARY: 0 P1, 0 P2, 1 P3

RECOMMENDED NEXT STEPS:
  No blockers. PR is ready for merge from a code-review perspective.
