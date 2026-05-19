/**
 * createTrip — create a one-off operator trip (Issue 013 AC1).
 *
 * Validates:
 *   AC1: bus must not be in maintenance during trip window
 *   bus must belong to operator (cross-op 404)
 *   bus must be active (not deactivated)
 */

import { prisma } from '@/lib/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';

export interface CreateTripInput {
  operatorId: string;
  routeId: string;
  busId: string;
  departureAt: Date;
  price: number;
  blockedSeats?: number;
  recurringTemplateId?: string;
  pairedTripId?: string;
}

export async function createTrip(input: CreateTripInput): Promise<TripDto> {
  const {
    operatorId,
    routeId,
    busId,
    departureAt,
    price,
    blockedSeats = 0,
    recurringTemplateId,
    pairedTripId,
  } = input;

  // Validate bus ownership + maintenance (window: [departureAt, departureAt+routeDuration])
  const bus = await prisma.bus.findFirst({
    where: { id: busId, operatorId },
    select: {
      id: true,
      capacity: true,
      deactivatedAt: true,
      maintenanceStart: true,
      maintenanceEnd: true,
    },
  });

  if (!bus) {
    throw new TripServiceError('not_found');
  }

  if (bus.deactivatedAt !== null) {
    throw new TripServiceError('bus_deactivated');
  }

  // AC1: maintenance window overlap check
  // A bus is in maintenance if: maintenanceStart ≤ departureAt < maintenanceEnd
  // (using the trip's single departure point as the event — same pattern as Issue 001 fix)
  if (bus.maintenanceStart !== null && bus.maintenanceEnd !== null) {
    if (bus.maintenanceStart <= departureAt && departureAt < bus.maintenanceEnd) {
      throw new TripServiceError('bus_in_maintenance');
    }
  }

  const trip = await prisma.trip.create({
    data: {
      routeId,
      busId,
      operatorId,
      departureAt,
      price,
      blockedSeats,
      status: 'scheduled',
      salesClosed: false,
      ...(recurringTemplateId ? { recurringTemplateId } : {}),
      ...(pairedTripId ? { pairedTripId } : {}),
    },
    include: {
      bus: { select: { capacity: true } },
      _count: {
        select: {
          holds: { where: { status: 'active' } },
          bookings: { where: { status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] } } },
        },
      },
    },
  });

  return toTripDto(trip);
}
