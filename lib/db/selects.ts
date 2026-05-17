/**
 * Prisma select whitelist for trip search results.
 *
 * AC-13: Only the 7 fields defined in the API contract are selected.
 * Never use `select: undefined` — always use this const.
 */

import type { Prisma } from '@prisma/client';

/**
 * Typed const enforcing a 7-field select whitelist for the TripResult API shape:
 * - tripId (mapped from id)
 * - departureAt
 * - price
 * - availableSeats (derived from bus.capacity, not stored — computed after query)
 * - operatorLegalName (via bus.operator.legalName)
 * - routeOrigin (via route.origin)
 * - routeDestination (via route.destination)
 *
 * Note: availableSeats is computed post-query as bus.capacity minus booked seats.
 * For Issue 001, we expose bus.capacity directly as availableSeats since
 * the Booking model is not yet implemented. Issue 002 will correct this.
 */
export const searchResultSelect = {
  id: true,
  departureAt: true,
  price: true,
  bus: {
    select: {
      capacity: true,
      operator: {
        select: {
          legalName: true,
        },
      },
    },
  },
  route: {
    select: {
      origin: true,
      destination: true,
    },
  },
} satisfies Prisma.TripSelect;

/**
 * TypeScript type inferred from the select whitelist.
 * Used to type-check the result of Prisma findMany calls.
 */
export type TripSearchResult = Prisma.TripGetPayload<{ select: typeof searchResultSelect }>;

/**
 * Map a TripSearchResult to the API TripResult shape.
 * availableSeats is bus.capacity (booking not yet implemented — Issue 002).
 */
export function toTripResult(trip: TripSearchResult) {
  return {
    tripId: trip.id,
    departureAt: trip.departureAt.toISOString(),
    price: trip.price,
    availableSeats: trip.bus.capacity,
    operatorLegalName: trip.bus.operator.legalName,
    routeOrigin: trip.route.origin,
    routeDestination: trip.route.destination,
  };
}
