/**
 * listRoutesForTripIds — minimal route lookup for trip-card enrichment.
 *
 * Used by /op/dashboard to attach origin/destination labels to the today-strip
 * mini-cards. Tenant-scoped via operatorId.
 *
 * Rule (AGENTS.md): server components MUST NOT import `prisma` directly.
 * Use this helper from `app/op/(console)/dashboard/page.tsx` instead.
 *
 * Issue 025 — extracted from the dashboard RSC.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';

export interface RouteEndpoints {
  id: string;
  origin: string;
  destination: string;
}

export async function listRoutesForTripIds(
  operatorId: string,
  routeIds: string[]
): Promise<RouteEndpoints[]> {
  if (routeIds.length === 0) return [];
  return prisma.route.findMany({
    ...withOperatorScope(operatorId, { where: { id: { in: routeIds } } }),
    select: { id: true, origin: true, destination: true },
  });
}
