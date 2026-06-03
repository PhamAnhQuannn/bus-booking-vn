/**
 * Full trip detail for the public /trips/[id] page.
 *
 * Returns null when the trip does not exist or is not bookable (not scheduled,
 * sales closed, or already departed) so the page can render notFound(). Available
 * seats use the same capacity − activeHolds − paidBookings calculation
 * as searchTrips (Issue 002; Issue 040 removed the blocked-seats term).
 */

import { prisma } from '@/lib/db/client';
import { isSearchVisible } from '@/lib/onboarding';

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
      // Issue 069: admin moderation flag — a disabled trip resolves to not-found.
      moderatedAt: true,
      bus: {
        select: {
          capacity: true,
          busType: true,
          // Issue 046: pull operator status so a direct link to a non-approved
          // operator's trip resolves to not-found (gate below).
          operator: { select: { legalName: true, contactPhone: true, status: true } },
        },
      },
      route: {
        select: {
          origin: true,
          destination: true,
          durationMinutes: true,
          // Issue 069: admin moderation flag on the parent route.
          moderatedAt: true,
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
  // Issue 046: approval gate — a direct link to a non-search-visible operator's
  // trip (pending / under-review / rejected / suspended) returns not-found.
  // Derived from the Issue 045 capability helper — no status literal here.
  if (!isSearchVisible(trip.bus.operator.status)) return null;
  // Issue 069: admin moderation gate — a disabled trip (or a trip on a disabled
  // route) is not bookable; a direct link resolves to not-found.
  if (trip.moderatedAt !== null || trip.route.moderatedAt !== null) return null;
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
        status: { in: ['paid', 'completed'] },
      },
    }),
  ]);

  const held = holdAgg._sum.ticketCount ?? 0;
  const booked = bookingAgg._sum.ticketCount ?? 0;
  const availableSeats = Math.max(0, trip.bus.capacity - held - booked);

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
