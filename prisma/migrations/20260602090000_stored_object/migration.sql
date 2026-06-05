-- Issue 059: object-storage pointer table. The DB stores the S3 object KEY +
-- metadata, NEVER the bytes — the server mints signed PUT/GET URLs and the
-- client transfers bytes directly. `purpose` is a documented string union
-- ('kyb_doc' | 'ticket_pdf') kept as a plain String column for extensibility.

-- 1. Pointer table.
CREATE TABLE "StoredObject" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes"   INTEGER NOT NULL,
    "purpose"     TEXT NOT NULL,
    "uploadedBy"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- 2. Unique object key (one pointer row per S3 key).
CREATE UNIQUE INDEX "StoredObject_key_key" ON "StoredObject"("key");

-- 3. Purpose index for per-purpose listing/auditing.
CREATE INDEX "StoredObject_purpose_idx" ON "StoredObject"("purpose");
