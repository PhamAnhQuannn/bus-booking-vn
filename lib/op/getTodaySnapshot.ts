/**
 * getTodaySnapshot — three counts for the operator dashboard headline band.
 *
 * Output:
 *   tripsToday           — trips with departureAt within next 24h (status='scheduled')
 *   newPaidBookings24h   — bookings paid in the last 24h (status IN paid statuses)
 *   revenueTodayVnd      — sum of totalVnd for those last-24h paid bookings
 *
 * Tenant-isolated: every query filters by Trip.operatorId.
 *
 * No `paidAt` column on Booking — fallback to `createdAt + status IN paid statuses`,
 * matching the existing pattern in lib/op/getActivityFeed.ts (plan risk #3).
 */

import { BookingStatus } from "@prisma/client"
import { prisma } from "@/lib/db/client"

export interface TodaySnapshot {
  tripsToday: number
  newPaidBookings24h: number
  revenueTodayVnd: number
}

const PAID_STATUSES: BookingStatus[] = [
  BookingStatus.pending_cash_payment,
  BookingStatus.paid,
  BookingStatus.completed,
]

export async function getTodaySnapshot(operatorId: string): Promise<TodaySnapshot> {
  const now = new Date()
  const horizon24h = new Date(now.getTime() + 24 * 3600 * 1000)
  const since24h = new Date(now.getTime() - 24 * 3600 * 1000)

  const [tripsToday, paidAgg] = await Promise.all([
    prisma.trip.count({
      where: {
        operatorId,
        status: "scheduled",
        departureAt: { gte: now, lte: horizon24h },
      },
    }),
    prisma.booking.aggregate({
      _count: { _all: true },
      _sum: { totalVnd: true },
      where: {
        createdAt: { gte: since24h },
        status: { in: PAID_STATUSES },
        trip: { operatorId },
      },
    }),
  ])

  return {
    tripsToday,
    newPaidBookings24h: paidAgg._count._all,
    revenueTodayVnd: paidAgg._sum.totalVnd ?? 0,
  }
}
