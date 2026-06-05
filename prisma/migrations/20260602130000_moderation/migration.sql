-- Issue 069: admin content moderation — disable (never edit).
-- moderatedAt non-null = admin-disabled; hides the item from search + direct links.
-- DISTINCT from operator-owned Trip.salesClosed / Route.deactivatedAt.
ALTER TABLE "Trip" ADD COLUMN "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Route" ADD COLUMN "moderatedAt" TIMESTAMP(3);

-- ContentReport: user/system-filed reports the admin Moderation tab triages.
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reportedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");
