/**
 * assignService — assign a staff member to a single trip (Issue 017, V1 one-trip rule).
 *
 * TOCTOU-safe: the staff row is locked with SELECT ... FOR UPDATE inside the
 * transaction before we validate the trip and write assignedTripId, so two
 * concurrent assigns on the same staff member serialize rather than racing.
 * (OperatorUser.id is a cuid TEXT column — no ::uuid cast.)
 *
 * Validation:
 *   - staff missing / cross-operator / not role=staff → not_found (404)
 *   - trip missing / owned by another operator        → trip_not_found (404)
 *   - trip status cancelled/departed/completed         → trip_not_assignable (422)
 *
 * Idempotent: re-assigning the same (or a different valid) trip replaces the
 * prior assignedTripId.
 */

import { prisma } from '@/lib/core/db/client';
import { withOperatorScope } from '@/lib/core/db';
import { StaffServiceError } from './errors';
import { toStaffDto, type StaffDto } from './toStaffDto';

export interface AssignServiceInput {
  operatorId: string;
  staffId: string;
  tripId: string;
}

export async function assignService(input: AssignServiceInput): Promise<StaffDto> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "OperatorUser"
      WHERE id = ${input.staffId}
        AND "operatorId" = ${input.operatorId}
        AND role = 'staff'
      FOR UPDATE
    `;
    if (locked.length === 0) throw new StaffServiceError('not_found');

    const trip = await tx.trip.findFirst({
      ...withOperatorScope(input.operatorId, { where: { id: input.tripId } }),
      select: { id: true, status: true },
    });
    if (!trip) throw new StaffServiceError('trip_not_found');
    if (trip.status !== 'scheduled') throw new StaffServiceError('trip_not_assignable');

    const row = await tx.operatorUser.update({
      where: { id: input.staffId },
      data: { assignedTripId: input.tripId },
      select: {
        id: true,
        displayName: true,
        phone: true,
        role: true,
        requiresPasswordChange: true,
        disabledAt: true,
        assignedTripId: true,
        createdAt: true,
      },
    });

    return toStaffDto({ ...row, role: row.role as 'admin' | 'staff' });
  });
}
