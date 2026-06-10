-- Issue 111: add the `custom` value to the PickupKind enum.
-- ADD VALUE must be its own migration (Postgres: a new enum value cannot be
-- used in the same transaction that adds it). The CHECK constraints that USE
-- this value live in the next migration (20260609040000).
ALTER TYPE "PickupKind" ADD VALUE 'custom';
