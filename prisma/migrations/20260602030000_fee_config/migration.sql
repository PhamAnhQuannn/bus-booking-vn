-- Issue 048: FeeConfig — effective-dated, change-audited platform-fee source.
--
-- This slice ships the MODEL + read helper + cutover seed only. Cutting the
-- hard-coded DEFAULT_PLATFORM_FEE_PCT (lib/payouts/calcPayout.ts) over to read
-- from this table lands in slice 049 — existing callers are untouched here.
--
-- ratePpm is a parts-per-million INTEGER (60000 = 6%) so payout math runs in the
-- BigInt domain with zero float drift (Issue 016): fee = amount * ratePpm / 1e6.
--
-- EFFECTIVE-DATED + APPEND-AUDITED: a rate change is a NEW row (optionally closing
-- the prior row's effectiveTo), NEVER an in-place edit of ratePpm.

-- 1. Table.
--    operatorId NULL = global default rate; non-null = per-operator override.
--    The FK is nullable so override rows reference an operator while global rows
--    carry NULL. createdBy is nullable for the seeded cutover row below.
CREATE TABLE "FeeConfig" (
  "id"            TEXT         NOT NULL,
  "operatorId"    TEXT,
  "ratePpm"       INTEGER      NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo"   TIMESTAMP(3),
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeeConfig_pkey" PRIMARY KEY ("id")
);

-- 2. Indexes (declared in schema.prisma too — Issue 007 raw-SQL/DSL parity).
CREATE INDEX "FeeConfig_operatorId_effectiveFrom_idx" ON "FeeConfig"("operatorId", "effectiveFrom");
CREATE INDEX "FeeConfig_effectiveFrom_idx" ON "FeeConfig"("effectiveFrom");

-- 3. FK operatorId -> Operator(id). ON DELETE RESTRICT (project convention): an
--    operator with override rows cannot be hard-deleted out from under them.
ALTER TABLE "FeeConfig"
  ADD CONSTRAINT "FeeConfig_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "Operator"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Cutover seed: the global 6% rate, effective from far in the past so it
--    covers every existing/cutover date. Seeding here (not only in seed.ts)
--    guarantees a fresh deploy has the global rate without depending on db:seed.
INSERT INTO "FeeConfig" ("id","operatorId","ratePpm","effectiveFrom","createdBy","createdAt")
VALUES (gen_random_uuid()::text, NULL, 60000, '2020-01-01 00:00:00', 'system:cutover', CURRENT_TIMESTAMP);
