/**
 * updateRoute — partial update a route scoped to an operator (Issue 012).
 *
 * Throws RouteServiceError:
 *   - 'not_found'                  — route doesn't exist or belongs to another operator
 *   - 'reactivation_not_supported' — route is deactivated; updates not allowed
 */

import { prisma } from '@/lib/db/client';
import { resolveOrCreatePlace } from '@/lib/places';
import type { RoutePatchInput } from '@/lib/validation/route';

export class RouteServiceError extends Error {
  constructor(public code: 'not_found' | 'reactivation_not_supported' | 'already_deactivated') {
    super(code);
    this.name = 'RouteServiceError';
  }
}

export async function updateRoute({
  operatorId,
  routeId,
  data,
}: {
  operatorId: string;
  routeId: string;
  data: RoutePatchInput;
}) {
  const existing = await prisma.route.findFirst({
    where: { id: routeId, operatorId },
    select: { id: true, deactivatedAt: true },
  });

  if (!existing) {
    throw new RouteServiceError('not_found');
  }
  if (existing.deactivatedAt !== null) {
    throw new RouteServiceError('reactivation_not_supported');
  }

  // Issue 044: when origin/destination text changes, re-resolve the canonical
  // Place and update the FK alongside the text column.
  const [originPlace, destPlace] = await Promise.all([
    data.origin !== undefined ? resolveOrCreatePlace(data.origin) : null,
    data.destination !== undefined ? resolveOrCreatePlace(data.destination) : null,
  ]);

  return prisma.route.update({
    where: { id: routeId },
    data: {
      ...(data.origin !== undefined ? { origin: data.origin } : {}),
      ...(data.destination !== undefined ? { destination: data.destination } : {}),
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
      ...(originPlace ? { originPlaceId: originPlace.id } : {}),
      ...(destPlace ? { destPlaceId: destPlace.id } : {}),
    },
    select: {
      id: true,
      operatorId: true,
      origin: true,
      destination: true,
      durationMinutes: true,
      originPlaceId: true,
      destPlaceId: true,
      deactivatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
