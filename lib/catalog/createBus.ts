/**
 * createBus — insert a bus scoped to operator.
 *
 * AC2: licensePlate is unique per (operatorId, licensePlate). Prisma's P2002
 *   uniqueness error is mapped to a typed throwable for the route handler to
 *   translate into HTTP 422 plate_in_use.
 */

import { prisma } from '@/lib/core/db/client';
import { Prisma } from '@prisma/client';

export interface CreateBusInput {
  operatorId: string;
  licensePlate: string;
  capacity: number;
  busType: 'coach' | 'sleeper' | 'limousine';
}

export interface CreatedBus {
  id: string;
  operatorId: string;
  licensePlate: string;
  capacity: number;
  busType: 'coach' | 'sleeper' | 'limousine';
}

export class BusServiceError extends Error {
  constructor(public code: 'plate_in_use') {
    super(code);
    this.name = 'BusServiceError';
  }
}

export async function createBus(input: CreateBusInput): Promise<CreatedBus> {
  try {
    const row = await prisma.bus.create({
      data: {
        operatorId: input.operatorId,
        licensePlate: input.licensePlate,
        capacity: input.capacity,
        busType: input.busType,
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
