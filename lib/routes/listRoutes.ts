/**
 * listRoutes — list all routes for an operator (Issue 012).
 *
 * Returns all routes (active + deactivated), ordered by createdAt desc.
 */

import { prisma } from '@/lib/db/client';

export async function listRoutes({ operatorId }: { operatorId: string }) {
  return prisma.route.findMany({
    where: { operatorId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      operatorId: true,
      origin: true,
      destination: true,
      durationMinutes: true,
      deactivatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
