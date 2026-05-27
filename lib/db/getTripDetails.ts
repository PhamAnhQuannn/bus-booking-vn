/**
 * Full trip detail for the public /trips/[id] page.
 *
 * Returns null when the trip does not exist or is not bookable (not scheduled,
 * sales closed, or already departed) so the page can render notFound(). Available
 * seats use the same capacity − blocked − activeHolds − paidBookings calculation
 * as searchTrips (Issue 002).
 */

import { prisma } from '@/lib/db/client';

export interface TripDetails {
  tripId: string;
  departureAt: string; // ISO
  price: number;
  availableSeats: number;
  capacity: number;
  busType: 'coach' | 'sleeper' | 'limousine';
  durationMinutes: number;
  routeOrigin: string;
  routeDestination: string;
  operatorLegalName: string;
  operatorContactPhone: string;
  pickupPoints: { name: string; address: string }[];
}

export async function getTripDetails(id: string): Promise<TripDetails | null> {
  const trip = await prisma.trip.findUnique({
    where: { id },
    select: {
      id: true,
      departureAt: true,
      price: true,
      status: true,
      salesClosed: true,
      blockedSeats: true,
      bus: {
        select: {
          capacity: true,
          busType: true,
          operator: { select: { legalName: true, contactPhone: true } },
        },
      },
      route: {
        select: {
          origin: true,
          destination: true,
          durationMinutes: true,
          pickupPoints: {
            where: { deactivatedAt: null },
            orderBy: { displayOrder: 'asc' },
            select: { name: true, address: true },
          },
        },
      },
    },
  });

  if (!trip) return null;
  // Not bookable → treat as missing.
  if (trip.status !== 'scheduled' || trip.salesClosed) return null;
  if (trip.departureAt <= new Date()) return null;

  const now = new Date();
  const [holdAgg, bookingAgg] = await Promise.all([
    prisma.hold.aggregate({
      _sum: { ticketCount: true },
      where: { tripId: id, status: 'active', expiresAt: { gt: now } },
    }),
    prisma.booking.aggregate({
      _sum: { ticketCount: true },
      where: {
        tripId: id,
        status: { in: ['pending_cash_payment', 'paid_operator_notified', 'completed'] },
      },
    }),
  ]);

  const held = holdAgg._sum.ticketCount ?? 0;
  const booked = bookingAgg._sum.ticketCount ?? 0;
  const availableSeats = Math.max(0, trip.bus.capacity - trip.blockedSeats - held - booked);

  return {
    tripId: trip.id,
    departureAt: trip.departureAt.toISOString(),
    price: trip.price,
    availableSeats,
    capacity: trip.bus.capacity,
    busType: trip.bus.busType,
    durationMinutes: trip.route.durationMinutes,
    routeOrigin: trip.route.origin,
    routeDestination: trip.route.destination,
    operatorLegalName: trip.bus.operator.legalName,
    operatorContactPhone: trip.bus.operator.contactPhone,
    pickupPoints: trip.route.pickupPoints,
  };
}
