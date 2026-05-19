/**
 * updateBus — patch a bus scoped to operator. Returns null when not found / cross-op.
 *
 * AC2: licensePlate uniqueness within operator scope — P2002 → 'plate_in_use'.
 * AC3: capacity reductions are guarded by the caller (route handler) BEFORE invoking
 *      this lib — it does not re-check occupancy here.
 * AC11: a deactivated bus cannot be edited — caller checks deactivatedAt first.
 */

import { prisma } from '@/lib/db/client';
import { Prisma } from '@prisma/client';
import { BusServiceError } from './createBus';

export interface UpdateBusInput {
  licensePlate?: string;
  capacity?: number;
  busType?: 'coach' | 'sleeper' | 'limousine';
}

export interface UpdatedBus {
  id: string;
  operatorId: string;
  licensePlate: string;
  capacity: number;
  busType: 'coach' | 'sleeper' | 'limousine';
}

export async function updateBus(
  operatorId: string,
  busId: string,
  patch: UpdateBusInput
): Promise<UpdatedBus | null> {
  // First confirm the bus belongs to this operator — avoids cross-op writes.
  const existing = await prisma.bus.findFirst({
    where: { id: busId, operatorId },
    select: { id: true },
  });
  if (!existing) return null;

  try {
    const row = await prisma.bus.update({
      where: { id: busId },
      data: {
        ...(patch.licensePlate !== undefined ? { licensePlate: patch.licensePlate } : {}),
        ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
        ...(patch.busType !== undefined ? { busType: patch.busType } : {}),
      },
      select: {
        id: true,
        operatorId: true,
        licensePlate: true,
        capacity: true,
        busType: true,
      },
    });
    return row;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new BusServiceError('plate_in_use');
    }
    throw e;
  }
}
