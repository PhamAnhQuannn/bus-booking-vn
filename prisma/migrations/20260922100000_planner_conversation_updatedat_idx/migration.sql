-- PDPL retention (W2): standalone updatedAt index so the retention sweeper's GLOBAL
-- `updatedAt < cutoff` prune is an index scan. The existing composite
-- [customerId, updatedAt(desc)] leads with customerId and can't range-seek a predicate
-- that has no customerId. Prisma DSL-expressible => also declared as @@index([updatedAt]).
CREATE INDEX "PlannerConversation_updatedAt_idx" ON "PlannerConversation"("updatedAt");
