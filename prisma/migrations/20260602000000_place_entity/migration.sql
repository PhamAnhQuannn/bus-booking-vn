-- 1. Place table
CREATE TABLE "Place" (
  "id" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "slug" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Place_slug_key" ON "Place"("slug");
CREATE INDEX "Place_canonicalName_idx" ON "Place"("canonicalName");

-- 2. Route FK columns
ALTER TABLE "Route" ADD COLUMN "originPlaceId" TEXT;
ALTER TABLE "Route" ADD COLUMN "destPlaceId" TEXT;

-- 3. Backfill: one Place per distinct trimmed origin/destination string
INSERT INTO "Place" ("id", "canonicalName", "aliases", "createdAt")
SELECT gen_random_uuid()::text, n, ARRAY[]::text[], CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT btrim(origin) AS n FROM "Route" WHERE btrim(origin) <> ''
  UNION
  SELECT DISTINCT btrim(destination) AS n FROM "Route" WHERE btrim(destination) <> ''
) AS names;

-- 4. Link routes to their places
UPDATE "Route" r SET "originPlaceId" = p."id" FROM "Place" p WHERE p."canonicalName" = btrim(r.origin);
UPDATE "Route" r SET "destPlaceId"   = p."id" FROM "Place" p WHERE p."canonicalName" = btrim(r.destination);

-- 5. FK constraints + index
ALTER TABLE "Route" ADD CONSTRAINT "Route_originPlaceId_fkey" FOREIGN KEY ("originPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Route" ADD CONSTRAINT "Route_destPlaceId_fkey" FOREIGN KEY ("destPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Route_originPlaceId_destPlaceId_idx" ON "Route"("originPlaceId", "destPlaceId");
