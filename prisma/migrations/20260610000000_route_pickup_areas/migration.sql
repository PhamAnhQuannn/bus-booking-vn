-- Issue 113: route-scoped pickup areas. Adds RoutePickupArea join table linking a
-- Route to the subset of its operator's OperatorPickupArea menu that applies to that
-- route. OperatorPickupArea stays the operator's reusable master menu; this layer
-- scopes which areas the new-trip picker / templates / per-route memory offer.
--
-- Backfill preserves current behaviour: every existing Route is assigned the full set
-- of its operator's ACTIVE pickup areas, so no route's picker goes empty post-migration.

-- CreateTable
CREATE TABLE "RoutePickupArea" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "operatorPickupAreaId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "RoutePickupArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutePickupArea_routeId_displayOrder_idx" ON "RoutePickupArea"("routeId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoutePickupArea_routeId_operatorPickupAreaId_key" ON "RoutePickupArea"("routeId", "operatorPickupAreaId");

-- AddForeignKey
ALTER TABLE "RoutePickupArea" ADD CONSTRAINT "RoutePickupArea_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePickupArea" ADD CONSTRAINT "RoutePickupArea_operatorPickupAreaId_fkey" FOREIGN KEY ("operatorPickupAreaId") REFERENCES "OperatorPickupArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: assign every operator's active pickup areas to each of that operator's routes,
-- carrying the area's displayOrder so existing routes keep their full menu in order.
INSERT INTO "RoutePickupArea" ("id", "routeId", "operatorPickupAreaId", "displayOrder")
SELECT gen_random_uuid()::text, r."id", a."id", a."displayOrder"
FROM "Route" r
JOIN "OperatorPickupArea" a ON a."operatorId" = r."operatorId" AND a."isActive" = true;
