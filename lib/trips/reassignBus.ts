/**
 * reassignBus — assign a different bus to a scheduled trip (Issue 013 AC3).
 *
 * AC3 validation cascade:
 *   1. bus_deactivated: new bus is deactivated
 *   2. bus_in_maintenance: new bus has maintenance overlapping departureAt
 *   3. capacity_too_small: new capacity < (activeHolds + confirmedBookings + blockedSeats)
 *      → 422 with { required, provided }
 *   4. bus_overlap_with_outbound: new bus already assigned to another trip at same departureAt
 *      → 409
 *
 * Uses $transaction + SELECT FOR UPDATE on Trip (I1 TOCTOU rule, Issue 011).
 * Cross-op = 404 not_found (I2).
 *
 * Issue 075 — reassign invalidates + regenerates the ticket PDF and notifies the
 * new plate. After the busId UPDATE (same tx, same FOR-UPDATE lock so the writes
 * commit atomically with the reassign):
 *   1. NULL out `ticketPdfKey`/`ticketPdfGeneratedAt` for affected PAID bookings.
 *      The 074 generate-ticket-pdfs cron claims rows WHERE ticketPdfKey IS NULL
 *      and re-renders with the NEW plate (generate-once-again). We match that
 *      cron's PAID_STATUSES claim set exactly so we only invalidate ticketable rows.
 *   2. Upsert a `busReassigned` NotificationLog per affected paid booking, keyed on
 *      the `@@unique([bookingId, template])` compound (Prisma name
 *      `bookingId_template`, Issue 058). Upsert (not create) because a trip can be
 *      reassigned repeatedly — a plain create would collide on the 2nd reassign.
 *      On every reassign we reset the row to status='pending', attemptCount=0,
 *      nextAttemptAt=null and refresh the payload (NEW plate), so the 058 dispatcher
 *      re-delivers the latest plate.
 *
 * Both writes are LIGHT (row writes only — no render, no network) so reassign
 * returns as fast as before. The actual PDF regenerate (074 cron) and SMS delivery
 * (058 dispatcher) happen asynchronously off the request path.
 *
 * Idempotency: re-running reassign (or reassigning back to a prior bus) re-NULLs
 * the keys (no-op for already-NULL rows) and re-upserts the busReassigned row in
 * place — no duplicate NotificationLog rows, no unique-constraint crash.
 */

import { prisma } from '@/lib/core/db/client';
import { TripServiceError } from './errors';
import type { TripDto } from './tripDto';
import { toTripDto } from './toTripDto';
import { busHasOverlappingTrip, tripWindowEnd } from './busOverlap';

/**
 * Paid booking states that carry a ticket worth invalidating + re-notifying on a
 * reassign. Mirrors generateTicketPdfs' PAID_STATUSES (074) so the invalidation set
 * and the re-render claim set stay in lockstep.
 */
const PAID_TICKET_STATUSES = [
  'paid',
  'completed',
  'no_show',
] as const;

export async function reassignBus(
  operatorId: string,
  tripId: string,
  newBusId: string
): Promise<TripDto> {
  let result: Awaited<ReturnType<typeof _updatedTrip>>;

  try {
    result = await prisma.$transaction(async (tx) => {
      // I1: Lock the Trip row (join Route for the duration that defines its overlap
      // window + origin/destination for the reassign notification payload).
      const locked = await tx.$queryRaw<
        {
          id: string;
          busId: string;
          departureAt: Date;
          blockedSeats: number;
          durationMinutes: number;
          origin: string;
          destination: string;
        }[]
      >`
        SELECT t.id, t."busId", t."departureAt", t."blockedSeats",
               r."durationMinutes", r.origin, r.destination
        FROM "Trip" t
        JOIN "Route" r ON r.id = t."routeId"
        WHERE t.id = ${tripId} AND t."operatorId" = ${operatorId}
        FOR UPDATE OF t
      `;
      if (locked.length === 0) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }
      const { departureAt, blockedSeats, durationMinutes, origin, destination } = locked[0];

      // Validate new bus ownership + state. licensePlate + busType are also read
      // here for the Issue 075 reassign-notification payload (the NEW plate).
      const bus = await tx.bus.findFirst({
        where: { id: newBusId, operatorId },
        select: {
          id: true,
          capacity: true,
          deactivatedAt: true,
          maintenanceStart: true,
          maintenanceEnd: true,
          licensePlate: true,
          busType: true,
        },
      });
      if (!bus) {
        throw Object.assign(new Error('not_found'), { _trip: 'not_found' });
      }
      if (bus.deactivatedAt !== null) {
        throw Object.assign(new Error('bus_deactivated'), { _trip: 'bus_deactivated' });
      }
      if (bus.maintenanceStart !== null && bus.maintenanceEnd !== null) {
        if (bus.maintenanceStart <= departureAt && departureAt < bus.maintenanceEnd) {
          throw Object.assign(new Error('bus_in_maintenance'), { _trip: 'bus_in_maintenance' });
        }
      }

      // Check for capacity: required = activeHolds + confirmedBookings + blockedSeats
      const [holdsAgg, bookingsAgg] = await Promise.all([
        tx.hold.aggregate({
          where: { tripId, status: 'active', expiresAt: { gt: new Date() } },
          _sum: { ticketCount: true },
        }),
        tx.booking.aggregate({
          where: {
            tripId,
            status: { in: ['paid', 'completed'] },
          },
          _sum: { ticketCount: true },
        }),
      ]);

      const activeHolds = holdsAgg._sum.ticketCount ?? 0;
      const confirmedBookings = bookingsAgg._sum.ticketCount ?? 0;
      const required = activeHolds + confirmedBookings + blockedSeats;

      if (bus.capacity < required) {
        throw Object.assign(new Error('capacity_too_small'), {
          _trip: 'capacity_too_small',
          required,
          provided: bus.capacity,
        });
      }

      // Check bus overlap: the new bus cannot run a trip whose occupancy window
      // overlaps this trip's window [departureAt, departureAt + routeDuration + buffer].
      // (Prior bug: this used exact departureAt equality, so overlapping-but-not-equal
      // trips slipped through.) Same operator — other operators' buses aren't visible.
      const overlap = await busHasOverlappingTrip(tx, {
        busId: newBusId,
        candidateStart: departureAt,
        candidateEnd: tripWindowEnd(departureAt, durationMinutes),
        excludeTripId: tripId,
      });
      if (overlap) {
        throw Object.assign(new Error('bus_overlap_with_outbound'), { _trip: 'bus_overlap_with_outbound' });
      }

      const updated = await tx.trip.update({
        where: { id: tripId },
        data: { busId: newBusId },
        include: {
          bus: { select: { capacity: true } },
          _count: {
            select: {
              holds: { where: { status: 'active' } },
              bookings: {
                where: {
                  status: { in: ['paid', 'completed'] },
                },
              },
            },
          },
        },
      });

      // ── Issue 075: invalidate stored ticket PDFs + enqueue new-plate notice ──
      // Both happen in-tx (atomic with the reassign) but are row-writes only — no
      // render, no network — so reassign stays fast. The actual regenerate (074
      // cron) + SMS (058 dispatcher) run asynchronously off the request path.

      // Fetch the affected PAID bookings once (id + buyerPhone for the SMS recipient).
      const affected = await tx.booking.findMany({
        where: {
          tripId,
          status: { in: [...PAID_TICKET_STATUSES] },
        },
        select: { id: true, bookingRef: true, buyerPhone: true },
      });

      // 1. Invalidate the stored PDF for affected paid bookings that HAVE a key.
      //    Setting it NULL re-arms the 074 generate-once cron to re-render with the
      //    NEW plate. Idempotent: already-NULL rows are not matched (no-op re-run).
      await tx.booking.updateMany({
        where: {
          tripId,
          status: { in: [...PAID_TICKET_STATUSES] },
          ticketPdfKey: { not: null },
        },
        data: { ticketPdfKey: null, ticketPdfGeneratedAt: null },
      });

      // 2. Upsert a busReassigned notification per affected paid booking, keyed on
      //    the (bookingId, template) compound unique (Issue 058). Upsert — not
      //    create — so a repeat reassign updates the existing row in place rather
      //    than colliding on the unique constraint. Every reassign resets the row
      //    to a fresh pending attempt so the dispatcher re-delivers the LATEST plate.
      const newPlatePayload = (bookingRef: string) =>
        JSON.stringify({
          bookingRef,
          plate: bus.licensePlate,
          busType: bus.busType,
          route: `${origin} → ${destination}`,
          departureAt: departureAt.toISOString(),
        });

      for (const b of affected) {
        await tx.notificationLog.upsert({
          where: { bookingId_template: { bookingId: b.id, template: 'busReassigned' } },
          create: {
            bookingId: b.id,
            channel: 'sms',
            template: 'busReassigned',
            // I9: recipient column holds the phone — payload must NOT duplicate it.
            recipient: b.buyerPhone,
            payload: newPlatePayload(b.bookingRef),
            status: 'pending',
          },
          update: {
            // Re-arm the row for re-delivery of the NEW plate on every reassign.
            recipient: b.buyerPhone,
            payload: newPlatePayload(b.bookingRef),
            status: 'pending',
            attemptCount: 0,
            nextAttemptAt: null,
            lastError: null,
            sentAt: null,
            externalRef: null,
          },
        });
      }

      return updated;
    });
  } catch (e) {
    const tagged = e as { _trip?: string; required?: number; provided?: number };
    if (tagged._trip === 'not_found') throw new TripServiceError('not_found');
    if (tagged._trip === 'bus_deactivated') throw new TripServiceError('bus_deactivated');
    if (tagged._trip === 'bus_in_maintenance') throw new TripServiceError('bus_in_maintenance');
    if (tagged._trip === 'capacity_too_small') {
      throw new TripServiceError('capacity_too_small', {
        required: tagged.required,
        provided: tagged.provided,
      });
    }
    if (tagged._trip === 'bus_overlap_with_outbound') {
      throw new TripServiceError('bus_overlap_with_outbound');
    }
    throw e;
  }

  return toTripDto(result);
}

// Placeholder to satisfy TypeScript (actual return type from prisma.trip.update with include)
async function _updatedTrip(_id: string) {
  return prisma.trip.findFirst({
    where: { id: _id },
    include: {
      bus: { select: { capacity: true } },
      _count: {
        select: {
          holds: { where: { status: 'active' } },
          bookings: {
            where: { status: { in: ['paid', 'completed'] } },
          },
        },
      },
    },
  });
}
