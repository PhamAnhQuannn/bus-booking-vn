/**
 * getOperatorBusWithTrips — bus detail + currently-selling trips, tenant-scoped.
 *
 * Operator drills from /op/buses (list) → /op/buses/:id (this page) → /op/manifest/:tripId
 * (passenger list). This middle hop surfaces which trips assigned to the bus are
 * actively selling tickets, with seat-sold counts so the operator can spot
 * near-full trips without opening the manifest.
 *
 * "Currently selling" = status='scheduled' AND salesClosed=false AND departureAt >= now.
 * (departed/completed/cancelled excluded — those have their own surfaces.)
 *
 * Seat counts: PAID statuses only (paid / completed). Active holds NOT counted —
 * same definition as getTripOccupancy.ts.
 *
 * Returns null if bus does not exist or belongs to a different operator (route
 * handler maps null → 404).
 */

import { BookingStatus } from "@prisma/client"
import { prisma } from "@/lib/core/db/client"
import { withOperatorScope } from "@/lib/core/db"

export interface BusActiveTrip {
  id: string
  routeId: string
  origin: string
  destination: string
  departureAt: string // ISO 8601
  price: number
  capacity: number
  soldSeats: number
  availableSeats: number
  salesClosed: boolean
}

export interface BusWithActiveTrips {
  id: string
  licensePlate: string
  capacity: number
  busType: "coach" | "sleeper" | "limousine"
  deactivatedAt: string | null
  maintenanceWindows: {
    id: string
    startAt: string
    endAt: string
    reason: string | null
  }[]
  activeTrips: BusActiveTrip[]
}

const PAID_STATUSES: BookingStatus[] = [
  BookingStatus.paid,
  BookingStatus.completed,
]

export async function getOperatorBusWithTrips(
  operatorId: string,
  busId: string
): Promise<BusWithActiveTrips | null> {
  const now = new Date()

  const bus = await prisma.bus.findFirst({
    ...withOperatorScope(operatorId, { where: { id: busId } }),
    select: {
      id: true,
      licensePlate: true,
      capacity: true,
      busType: true,
      deactivatedAt: true,
      maintenances: {
        select: { id: true, startAt: true, endAt: true, reason: true },
        orderBy: { startAt: "asc" },
      },
      trips: {
        where: {
          status: "scheduled",
          salesClosed: false,
          departureAt: { gte: now },
        },
        orderBy: { departureAt: "asc" },
        select: {
          id: true,
          routeId: true,
          departureAt: true,
          price: true,
          route: { select: { origin: true, destination: true } },
          bookings: {
            where: { status: { in: PAID_STATUSES } },
            select: { ticketCount: true },
          },
        },
      },
    },
  })

  if (!bus) return null

  const activeTrips: BusActiveTrip[] = bus.trips.map((t) => {
    const soldSeats = t.bookings.reduce((sum, b) => sum + b.ticketCount, 0)
    return {
      id: t.id,
      routeId: t.routeId,
      origin: t.route.origin,
      destination: t.route.destination,
      departureAt: t.departureAt.toISOString(),
      price: t.price,
      capacity: bus.capacity,
      soldSeats,
      availableSeats: Math.max(0, bus.capacity - soldSeats),
      salesClosed: false,
    }
  })

  return {
    id: bus.id,
    licensePlate: bus.licensePlate,
    capacity: bus.capacity,
    busType: bus.busType,
    deactivatedAt: bus.deactivatedAt?.toISOString() ?? null,
    maintenanceWindows: bus.maintenances.map((m) => ({
      id: m.id,
      startAt: m.startAt.toISOString(),
      endAt: m.endAt.toISOString(),
      reason: m.reason,
    })),
    activeTrips,
  }
}
