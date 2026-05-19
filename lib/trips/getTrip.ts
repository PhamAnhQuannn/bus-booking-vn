/**
 * getTrip — fetch a single trip belonging to operator (I2: cross-op → null).
 */

import { prisma } from '@/lib/db/client';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';

export async function getTrip(
  operatorId: string,
  tripId: string
): Promise<TripDto | null> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, operatorId },
    include: {
      bus: { select: { capacity: true } },
      _count: {
        select: {
          holds: { where: { status: 'active' } },
          bookings: {
            where: {
              status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
            },
          },
        },
      },
    },
  });

  if (!trip) return null;
  return toTripDto(trip);
}

export async function listTrips(
  operatorId: string,
  opts?: { routeId?: string; fromDate?: Date; toDate?: Date; status?: string }
): Promise<TripDto[]> {
  const trips = await prisma.trip.findMany({
    where: {
      operatorId,
      ...(opts?.routeId ? { routeId: opts.routeId } : {}),
      ...(opts?.fromDate || opts?.toDate
        ? {
            departureAt: {
              ...(opts?.fromDate ? { gte: opts.fromDate } : {}),
              ...(opts?.toDate ? { lte: opts.toDate } : {}),
            },
          }
        : {}),
      ...(opts?.status ? { status: opts.status as 'scheduled' | 'cancelled' | 'completed' } : {}),
    },
    include: {
      bus: { select: { capacity: true } },
      _count: {
        select: {
          holds: { where: { status: 'active' } },
          bookings: {
            where: {
              status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
            },
          },
        },
      },
    },
    orderBy: { departureAt: 'asc' },
  });

  return trips.map(toTripDto);
}
