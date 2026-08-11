-- CreateTable
CREATE TABLE "PlannerConversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dtoJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannerConversation_customerId_updatedAt_idx" ON "PlannerConversation"("customerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "PlannerMessage_conversationId_createdAt_idx" ON "PlannerMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlannerConversation" ADD CONSTRAINT "PlannerConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerMessage" ADD CONSTRAINT "PlannerMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "PlannerConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
