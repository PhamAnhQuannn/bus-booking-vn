-- Conversion-funnel instrumentation: anonymous, append-only event log.

CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "tripId" TEXT,
    "bookingId" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FunnelEvent_step_createdAt_idx" ON "FunnelEvent"("step", "createdAt");
CREATE INDEX "FunnelEvent_sessionId_idx" ON "FunnelEvent"("sessionId");
