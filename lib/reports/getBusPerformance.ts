/**
 * getBusPerformance — per-bus revenue + utilization across the date range.
 *
 * Returns one row per bus the operator owns (active buses only — caller can
 * widen with `includeDeactivated` later). Each row carries the metrics needed
 * by /op/reports/overview's per-bus table:
 *
 *   tripsCount    — scheduled/completed/departed trips within window
 *   seatsSold     — sum of ticketCount across PAID bookings on those trips
 *   capacityTotal — sum of bus.capacity × tripsCount (denominator for occupancy)
 *   grossRevenueVnd — sum of totalVnd across PAID bookings on those trips
 *   occupancyPct  — round(seatsSold / capacityTotal * 100); 0 when no trips
 *
 * Tenant-isolated: every join filters by Bus.operatorId.
 *
 * Date window — dateFrom/dateTo as YYYY-MM-DD interpreted as Asia/Ho_Chi_Minh
 * (same convention as getOperatorKpis.ts).
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/client"

export interface BusPerformanceRow {
  busId: string
  licensePlate: string
  busType: "coach" | "sleeper" | "limousine"
  capacity: number
  tripsCount: number
  seatsSold: number
  capacityTotal: number
  grossRevenueVnd: number
  occupancyPct: number
}

export interface GetBusPerformanceInput {
  operatorId: string
  dateFrom: string
  dateTo: string
}

const PAID_SQL = Prisma.sql`b.status IN ('pending_cash_payment'::"BookingStatus",'paid_operator_notified'::"BookingStatus",'completed'::"BookingStatus")`

export async function getBusPerformance(
  input: GetBusPerformanceInput
): Promise<BusPerformanceRow[]> {
  const { operatorId, dateFrom, dateTo } = input
  const windowStart = new Date(`${dateFrom}T00:00:00+07:00`)
  const windowEnd = new Date(`${dateTo}T23:59:59+07:00`)

  // Single raw-SQL aggregation — joins Bus → Trip → Booking, groups by bus, sums
  // ticket counts + totals where booking is PAID. LEFT JOIN keeps buses with no
  // bookings in the result (so the operator sees idle buses too).
  const rows = await prisma.$queryRaw<
    {
      busid: string
      licenseplate: string
      bustype: "coach" | "sleeper" | "limousine"
      capacity: number
      tripscount: number
      seatssold: number
      grossrevenuevnd: bigint
    }[]
  >(
    Prisma.sql`
      SELECT
        bus.id              AS busid,
        bus."licensePlate"  AS licenseplate,
        bus."busType"::text AS bustype,
        bus.capacity        AS capacity,
        COUNT(DISTINCT t.id)::int AS tripscount,
        COALESCE(SUM(CASE WHEN ${PAID_SQL} THEN b."ticketCount" ELSE 0 END), 0)::int AS seatssold,
        COALESCE(SUM(CASE WHEN ${PAID_SQL} THEN b."totalVnd" ELSE 0 END), 0)::bigint AS grossrevenuevnd
      FROM "Bus" bus
      LEFT JOIN "Trip" t
        ON t."busId" = bus.id
       AND t."operatorId" = ${operatorId}
       AND t."departureAt" >= ${windowStart}
       AND t."departureAt" <= ${windowEnd}
       AND t.status <> 'cancelled'::"TripStatus"
      LEFT JOIN "Booking" b
        ON b."tripId" = t.id
      WHERE bus."operatorId" = ${operatorId}
        AND bus."deactivatedAt" IS NULL
      GROUP BY bus.id, bus."licensePlate", bus."busType", bus.capacity
      ORDER BY grossrevenuevnd DESC, bus."licensePlate" ASC
    `
  )

  return rows.map((r) => {
    const capacityTotal = r.capacity * r.tripscount
    const seatsSold = r.seatssold
    const revenue = Number(r.grossrevenuevnd)
    const occupancyPct =
      capacityTotal > 0 ? Math.round((seatsSold / capacityTotal) * 100) : 0
    return {
      busId: r.busid,
      licensePlate: r.licenseplate,
      busType: r.bustype,
      capacity: r.capacity,
      tripsCount: r.tripscount,
      seatsSold,
      capacityTotal,
      grossRevenueVnd: revenue,
      occupancyPct,
    }
  })
}
