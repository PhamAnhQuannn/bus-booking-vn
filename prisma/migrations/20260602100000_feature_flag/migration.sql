-- Issue 060: DB-backed feature-flag store.
--
-- Runtime feature gates / payment-rail toggles / kill-switches, read through
-- lib/flags (env-override → cached DB row → caller default). `key` is the
-- natural PK (TEXT) — naturally unique, no separate unique index needed.
--
-- Env `*_STUB` infra toggles and FeeConfig (Issue 048) are deliberately NOT
-- modeled here (see model doc in schema.prisma).
CREATE TABLE "FeatureFlag" (
  "key"       TEXT         NOT NULL,
  "enabled"   BOOLEAN      NOT NULL DEFAULT false,
  "value"     TEXT,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);
