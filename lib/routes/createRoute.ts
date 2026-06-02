/**
 * createRoute — create a new route scoped to an operator (Issue 012).
 *
 * Issue 044: also resolves-or-creates the canonical Place for origin +
 * destination and links the FKs. The free-text origin/destination columns are
 * still written (back-compat shim); the API contract (origin/destination
 * strings) is unchanged.
 */

import { prisma } from '@/lib/db/client';
import { resolveOrCreatePlace } from '@/lib/places';
import type { RouteCreateInput } from '@/lib/validation/route';

export interface CreatedRoute {
  id: string;
  operatorId: string;
  origin: string;
  destination: string;
  durationMinutes: number;
  originPlaceId: string | null;
  destPlaceId: string | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createRoute({
  operatorId,
  data,
}: {
  operatorId: string;
  data: RouteCreateInput;
}): Promise<CreatedRoute> {
  const [originPlace, destPlace] = await Promise.all([
    resolveOrCreatePlace(data.origin),
    resolveOrCreatePlace(data.destination),
  ]);

  return prisma.route.create({
    data: {
      operatorId,
      origin: data.origin,
      destination: data.destination,
      durationMinutes: data.durationMinutes,
      originPlaceId: originPlace.id,
      destPlaceId: destPlace.id,
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
