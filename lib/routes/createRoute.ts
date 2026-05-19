/**
 * createRoute — create a new route scoped to an operator (Issue 012).
 */

import { prisma } from '@/lib/db/client';
import type { RouteCreateInput } from '@/lib/validation/route';

export interface CreatedRoute {
  id: string;
  operatorId: string;
  origin: string;
  destination: string;
  durationMinutes: number;
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
  return prisma.route.create({
    data: {
      operatorId,
      origin: data.origin,
      destination: data.destination,
      durationMinutes: data.durationMinutes,
    },
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
