/**
 * getStaffDashboard — in-process loader for the /op/staff/dashboard server component (Issue 018).
 *
 * Reads bb_op_access cookie, verifies the operator-scope JWT, then reads role +
 * assignedTripId FRESH from the DB (NOT from the token claim) so re-assignment by
 * an admin (Issue 017) takes effect on the staff member's NEXT request — no stale
 * session. When assignedTripId is null the staff member sees the empty-state page.
 *
 * Rule (AGENTS.md): server components MUST NOT self-fetch their own API.
 *
 * Returns null when not authenticated / operator disabled.
 */

import { cookies } from 'next/headers';
import { verifyOperatorAccess } from '@/lib/auth';
import { prisma } from '@/lib/core/db/client';
import { listOperatorBookings } from '@/lib/booking/listOperatorBookings';
import { getManifest } from '@/lib/booking/getManifest';
import { getTrip } from '@/lib/trips';
import type { BookingQueueRow } from '@/lib/booking/toBookingQueueRow';
import type { ManifestRow } from '@/lib/booking/getManifest';
import type { TripDto } from '@/lib/trips';

export interface StaffDashboardView {
  operatorId: string;
  requiresPasswordChange: boolean;
  isStaff: boolean;
  assignedTripId: string | null;
  /** present only when assignedTripId is set and the trip resolves */
  trip: TripDto | null;
  queueRows: BookingQueueRow[];
  manifestRows: ManifestRow[];
  manifestGeneratedAt: string | null;
}

export async function getStaffDashboard(): Promise<StaffDashboardView | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('bb_op_access')?.value;
  if (!token) return null;

  const payload = await verifyOperatorAccess(token);
  if (!payload) return null;

  // Read role + assignedTripId FRESH per request (Issue 018: re-assignment switches
  // scope on next request, no stale token claim).
  const operator = await prisma.operatorUser.findUnique({
    where: { id: payload.sub },
    select: {
      operatorId: true,
      role: true,
      disabledAt: true,
      requiresPasswordChange: true,
      assignedTripId: true,
    },
  });
  if (!operator || operator.disabledAt !== null) return null;

  const base = {
    operatorId: operator.operatorId,
    requiresPasswordChange: operator.requiresPasswordChange,
    isStaff: operator.role === 'staff',
    assignedTripId: operator.assignedTripId,
  };

  if (!operator.assignedTripId) {
    return {
      ...base,
      trip: null,
      queueRows: [],
      manifestRows: [],
      manifestGeneratedAt: null,
    };
  }

  const [trip, queue, manifest] = await Promise.all([
    getTrip(operator.operatorId, operator.assignedTripId),
    listOperatorBookings(operator.operatorId, { tripId: operator.assignedTripId }),
    getManifest(operator.operatorId, operator.assignedTripId),
  ]);

  return {
    ...base,
    trip,
    queueRows: queue.rows,
    manifestRows: manifest?.rows ?? [],
    manifestGeneratedAt: manifest?.generatedAt ?? null,
  };
}
