-- Issue 087 Part A: BookingStatus enum value rename to the spec-target vocabulary.
--
--   paid_operator_notified -> paid   (money truth; notification delivery now lives
--                                     in NotificationLog, never folded into booking state)
--
-- Postgres 12+ supports ALTER TYPE ... RENAME VALUE as an in-place catalog
-- update: it rewrites NO table rows (the on-disk enum ordinal is unchanged, only
-- the label is renamed), so this is O(1) and safe on a large Booking table.
-- All existing 'paid_operator_notified' rows auto-convert to 'paid'.
--
-- The Booking.status column default is 'awaiting_payment' (unchanged) — no
-- ALTER COLUMN ... SET DEFAULT needed.
ALTER TYPE "BookingStatus" RENAME VALUE 'paid_operator_notified' TO 'paid';

-- Issue 087 Part B: HoldStatus 'converted' -> 'consumed' (SYS05 named state).
-- Same in-place catalog rename; all existing 'converted' Hold rows auto-convert
-- to 'consumed'. Hold.status default is 'active' (unchanged).
ALTER TYPE "HoldStatus" RENAME VALUE 'converted' TO 'consumed';
