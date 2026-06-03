/**
 * getActivityFeed — synthesizes a recent-activity stream for the operator
 * dashboard from existing tables (Booking, Trip). No new schema; merge-sort
 * three sources by timestamp DESC.
 *
 * Tenant-isolated: every query joins via Trip.operatorId.
 *
 * Pragmatic delivery — Issue 008 model `OperatorActivityRead` deferred. The
 * landing reads `getUnviewedPaidCount` (already exists) for the "unread" badge
 * on the bell; this function only produces the feed list.
 */

import type { ActivityEvent } from "@/lib/op/activityTypes"
import { prisma } from "@/lib/db/client"

interface GetActivityFeedInput {
  operatorId: string
  /** Max events returned. Default 30. */
  limit?: number
  /** Cap how far back to look (ms ago). Default 7 days. */
  windowMs?: number
}

const LOW_CAPACITY_THRESHOLD = 0.9

export async function getActivityFeed(
  input: GetActivityFeedInput
): Promise<ActivityEvent[]> {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 100)
  const windowMs = input.windowMs ?? 7 * 24 * 3600 * 1000
  const since = new Date(Date.now() - windowMs)
  const horizon24h = new Date(Date.now() + 24 * 3600 * 1000)

  const [paid, escalated, lifecycle, lowCapTrips] = await Promise.all([
    // No `paidAt` column on Booking — use `createdAt` filtered by paid statuses.
    // Per plan risk #3 — pragmatic fallback.
    prisma.booking.findMany({
      where: {
        createdAt: { gte: since },
        status: {
          in: ["paid", "completed"],
        },
        trip: { operatorId: input.operatorId },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        bookingRef: true,
        buyerName: true,
        totalVnd: true,
        createdAt: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        escalatedAt: { gte: since, not: null },
        trip: { operatorId: input.operatorId },
      },
      orderBy: { escalatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        bookingRef: true,
        buyerName: true,
        escalatedAt: true,
        escalationNote: true,
      },
    }),
    prisma.trip.findMany({
      where: {
        operatorId: input.operatorId,
        OR: [
          { departedAt: { gte: since, not: null } },
          { completedAt: { gte: since, not: null } },
          { cancelledAt: { gte: since, not: null } },
        ],
      },
      orderBy: { departureAt: "desc" },
      take: limit,
      select: {
        id: true,
        departedAt: true,
        completedAt: true,
        cancelledAt: true,
        status: true,
        route: { select: { origin: true, destination: true } },
      },
    }),
    prisma.trip.findMany({
      where: {
        operatorId: input.operatorId,
        status: "scheduled",
        departureAt: { gte: new Date(), lte: horizon24h },
      },
      take: 50,
      select: {
        id: true,
        departureAt: true,
        bus: { select: { capacity: true } },
        route: { select: { origin: true, destination: true } },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  in: [
                    "paid",
                    "completed",
                  ],
                },
              },
            },
          },
        },
      },
    }),
  ])

  const events: ActivityEvent[] = []

  for (const b of paid) {
    events.push({
      id: `booking.paid:${b.id}:${b.createdAt.getTime()}`,
      type: "booking.paid",
      ts: b.createdAt.toISOString(),
      severity: "success",
      title: `Đơn mới — ${b.bookingRef}`,
      body: `${b.buyerName} đã thanh toán ${b.totalVnd.toLocaleString("vi-VN")}đ`,
      href: `/op/bookings/${b.id}`,
    })
  }

  for (const b of escalated) {
    if (!b.escalatedAt) continue
    events.push({
      id: `booking.escalated:${b.id}:${b.escalatedAt.getTime()}`,
      type: "booking.escalated",
      ts: b.escalatedAt.toISOString(),
      severity: "danger",
      title: `Đơn cần xử lý — ${b.bookingRef}`,
      body: b.escalationNote ?? `${b.buyerName} đã được gắn cờ.`,
      href: `/op/bookings/${b.id}`,
    })
  }

  for (const t of lifecycle) {
    if (t.cancelledAt) {
      events.push({
        id: `trip.cancelled:${t.id}:${t.cancelledAt.getTime()}`,
        type: "trip.cancelled",
        ts: t.cancelledAt.toISOString(),
        severity: "danger",
        title: "Chuyến đã huỷ",
        body: `${t.route.origin} → ${t.route.destination}`,
        href: `/op/trips/${t.id}`,
      })
    } else if (t.completedAt) {
      events.push({
        id: `trip.completed:${t.id}:${t.completedAt.getTime()}`,
        type: "trip.completed",
        ts: t.completedAt.toISOString(),
        severity: "info",
        title: "Chuyến hoàn tất",
        body: `${t.route.origin} → ${t.route.destination}`,
        href: `/op/trips/${t.id}`,
      })
    } else if (t.departedAt) {
      events.push({
        id: `trip.departed:${t.id}:${t.departedAt.getTime()}`,
        type: "trip.departed",
        ts: t.departedAt.toISOString(),
        severity: "info",
        title: "Chuyến đã khởi hành",
        body: `${t.route.origin} → ${t.route.destination}`,
        href: `/op/trips/${t.id}`,
      })
    }
  }

  for (const t of lowCapTrips) {
    const capacity = t.bus.capacity
    const sold = t._count.bookings
    if (capacity === 0) continue
    if (sold / capacity < LOW_CAPACITY_THRESHOLD) continue
    // Day-bucket the synthetic id so the same trip doesn't re-fire every poll.
    const dayBucket = new Date(t.departureAt).toISOString().slice(0, 10)
    events.push({
      id: `trip.low_capacity:${t.id}:${dayBucket}`,
      type: "trip.low_capacity",
      ts: new Date().toISOString(),
      severity: "warning",
      title: "Chuyến gần kín ghế",
      body: `${t.route.origin} → ${t.route.destination} · ${sold}/${capacity} ghế`,
      href: `/op/trips/${t.id}`,
    })
  }

  events.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
  return events.slice(0, limit)
}
