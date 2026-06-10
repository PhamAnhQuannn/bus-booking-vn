-- Align the OperatorPickupArea.kind column DEFAULT with the documented intent and the
-- Issue-110 backfill (20260609020000 set existing operator areas pickup→station): most
-- VN operator menu entries are bến xe (station). The Zod layer already defaults an omitted
-- kind to 'station' (lib/core/validation/pickupArea.ts), so this removes the latent
-- Zod-vs-DB default contradiction. Behaviour-preserving: createOperatorPickupArea always
-- passes an explicit kind, so the column DEFAULT is otherwise unreached.
ALTER TABLE "OperatorPickupArea" ALTER COLUMN "kind" SET DEFAULT 'station';
