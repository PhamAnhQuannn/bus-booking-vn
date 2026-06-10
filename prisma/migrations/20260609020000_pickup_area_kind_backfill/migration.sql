-- Issue 110: legacy re-tag backfill (operator P1.1/P1.4).
-- The Issue 109 migration defaulted every existing OperatorPickupArea to `pickup`,
-- mislabeling real stations. Heuristically promote rows whose name looks like a
-- bus terminal (Bến xe / BX prefix) back to `station`. Operators can still correct
-- any miss via the kind-edit control shipped in this issue.
--
-- Pure data backfill — no schema change (so no schema.prisma edit). Idempotent:
-- only flips rows currently `pickup` whose name matches the station heuristic.

UPDATE "OperatorPickupArea"
SET "kind" = 'station'
WHERE "kind" = 'pickup'
  AND (
    "name" ILIKE '%bến xe%'
    OR "name" ILIKE 'bx %'
    OR "name" ILIKE 'bx-%'
    OR "name" ILIKE 'bến xe%'
  );
