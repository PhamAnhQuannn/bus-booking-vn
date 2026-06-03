/**
 * getOperatorBus — fetch a single bus scoped to operator, with maintenance windows.
 *
 * AC6: returns null if bus.operatorId !== caller's operatorId (route handler maps to 404).
 * Maintenance windows ordered by startAt ASC.
 */

import { prisma } from '@/lib/core/db/client';

export interface MaintenanceWindow {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
}

export interface OperatorBusDetail {
  id: string;
  operatorId: string;
  licensePlate: string;
  capacity: number;
  busType: 'coach' | 'sleeper' | 'limousine';
  deactivatedAt: Date | null;
  maintenances: MaintenanceWindow[];
}

export async function getOperatorBus(
  operatorId: string,
  busId: string
): Promise<OperatorBusDetail | null> {
  const row = await prisma.bus.findFirst({
    where: { id: busId, operatorId },
    select: {
      id: true,
      operatorId: true,
      licensePlate: true,
      capacity: true,
      busType: true,
      deactivatedAt: true,
      maintenances: {
        select: { id: true, startAt: true, endAt: true, reason: true },
        orderBy: { startAt: 'asc' },
      },
    },
  });
  return row;
}
