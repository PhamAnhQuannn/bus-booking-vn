-- rebuild-blocked-seats.sql
-- Recomputes Trip.blockedSeats from scratch based on active Hold records.
-- Run this after a data migration or if blockedSeats drifts out of sync.
--
-- Usage: psql $DATABASE_URL -f scripts/rebuild-blocked-seats.sql
--
-- Safe to run in production: UPDATE is idempotent; no data is deleted.

BEGIN;

UPDATE "Trip" t
SET "blockedSeats" = COALESCE((
  SELECT SUM(h."ticketCount")
  FROM "Hold" h
  WHERE h."tripId" = t.id
    AND h.status = 'active'
    AND h."expiresAt" > NOW()
), 0);

COMMIT;
