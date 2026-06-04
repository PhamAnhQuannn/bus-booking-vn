/**
 * deactivateRoute — soft-delete a route scoped to an operator (Issue 012).
 *
 * Throws RouteServiceError:
 *   - 'not_found'          — route doesn't exist or belongs to another operator
 *   - 'already_deactivated' — route is already deactivated
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { RouteServiceError } from './updateRoute';

export async function deactivateRoute({
  operatorId,
  routeId,
}: {
  operatorId: string;
  routeId: string;
}) {
  const existing = await prisma.route.findFirst({
    ...withOperatorScope(operatorId, { where: { id: routeId } }),
    select: { id: true, deactivatedAt: true },
  });

  if (!existing) {
    throw new RouteServiceError('not_found');
  }
  if (existing.deactivatedAt !== null) {
    throw new RouteServiceError('already_deactivated');
  }

  return prisma.route.update({
    where: { id: routeId },
    data: { deactivatedAt: new Date() },
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
