/**
 * /op/dashboard — Operator Dashboard Landing (PR 2 redesign).
 *
 * Analytics-first landing — KPI hero + quick-actions + today's-trips strip +
 * condensed recent-bookings queue + reserved right-rail (Activity feed lands
 * here in PR 8).
 *
 * Sacred order (per Issue 014 mistake-log + plan risk #5): read
 * getUnviewedPaidCount BEFORE touchLastViewed, then fan out parallel reads.
 *
 * No self-fetch (AGENTS.md rule). All data via in-process lib calls.
 */

import { redirect } from "next/navigation"
import {
  CalendarPlus,
  ClipboardList,
  Search,
  Wallet,
} from "lucide-react"

import { getOperatorSession } from "@/lib/op/getOperatorSession"
import { getUnviewedPaidCount } from "@/lib/booking/getUnviewedPaidCount"
import { touchLastViewed } from "@/lib/booking/touchLastViewed"
import { getOperatorKpis } from "@/lib/reports/getOperatorKpis"
import { listUpcomingForOperator } from "@/lib/trips/listUpcomingForOperator"
import { listOperatorBookings } from "@/lib/booking/listOperatorBookings"
import { getActivityFeed } from "@/lib/op/getActivityFeed"
import { listRoutesForTripIds } from "@/lib/op/listRoutesForTripIds"
import { getDefaultDateRange, serverNow } from "@/lib/op/dateRanges"

import { PageHeader } from "@/components/op/PageHeader"
import { KpiTile } from "@/components/op/KpiTile"
import { QuickActionGrid } from "@/components/op/QuickActionGrid"
import { TodayTripsStrip } from "@/components/op/TodayTripsStrip"
import { QueueStrip } from "@/components/op/QueueStrip"
import { ActivityFeed } from "@/components/op/ActivityFeed"
import type { TripMiniCardRow } from "@/components/op/TripMiniCard"

function formatVnd(v: number): string {
  return v.toLocaleString("vi-VN") + "đ"
}

export default async function OperatorDashboardPage() {
  const session = await getOperatorSession()
  if (!session) redirect("/op/login")
  if (session.requiresPasswordChange) redirect("/op/first-login")

  // Read unviewed count BEFORE touching — badge reflects pre-load state.
  const unviewedCount = await getUnviewedPaidCount(
    session.operatorUserId,
    session.operatorId
  )
  await touchLastViewed(session.operatorUserId)

  const { from, to } = getDefaultDateRange(30)
  const now = serverNow()
  const horizonMs = 24 * 3600 * 1000

  const [kpis, upcoming, queue, activity] = await Promise.all([
    getOperatorKpis({ operatorId: session.operatorId, dateFrom: from, dateTo: to }),
    listUpcomingForOperator(session.operatorId, { limit: 24 }),
    listOperatorBookings(session.operatorId, { limit: 8 }),
    getActivityFeed({ operatorId: session.operatorId, limit: 12 }),
  ])

  // Filter to trips departing within the next 24h.
  const todayCandidates = upcoming.trips.filter((t) => {
    const ms = Date.parse(t.departureAt) - now
    return ms <= horizonMs
  })

  // Enrich with route origin/destination for the mini-cards.
  const routeIds = Array.from(new Set(todayCandidates.map((t) => t.routeId)))
  const routes = await listRoutesForTripIds(session.operatorId, routeIds)
  const routeMap = new Map(routes.map((r) => [r.id, r]))

  const todayTrips: TripMiniCardRow[] = todayCandidates.map((t) => {
    const route = routeMap.get(t.routeId)
    return {
      id: t.id,
      routeId: t.routeId,
      origin: route?.origin ?? "—",
      destination: route?.destination ?? "—",
      departureAt: t.departureAt,
      status: t.status,
      salesClosed: t.salesClosed,
      capacity: t.capacity,
      bookingsCount: t.bookingsCount,
      availableSeats: t.availableSeats,
    }
  })

  const quickActions = [
    {
      id: "create-trip",
      label: "Tạo chuyến mới",
      description: "Mở trang quản lý chuyến để tạo",
      href: "/op/trips",
      icon: <CalendarPlus />,
    },
    {
      id: "find-booking",
      label: "Tìm đặt vé",
      description: "Tra cứu theo mã, SĐT, ngày",
      href: "/op/bookings",
      icon: <Search />,
    },
    {
      id: "fleet",
      label: "Quản lý đội xe",
      description: "Sức chứa, lịch bảo trì",
      href: "/op/buses",
      icon: <ClipboardList />,
    },
    {
      id: "reports",
      label: "Báo cáo doanh thu",
      description: "Doanh thu & thanh toán",
      href: "/op/reports/revenue",
      icon: <Wallet />,
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:py-8">
      <PageHeader
        title={`Xin chào, ${session.operatorName}`}
        subtitle="Tóm tắt hoạt động 30 ngày qua + chuyến đang đến."
      />

      {/* KPI hero — 4 tiles */}
      <section
        aria-labelledby="kpi-hero-h"
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="kpi-hero-h" className="sr-only">
          Chỉ số chính
        </h2>
        <KpiTile
          label="Doanh thu"
          value={formatVnd(kpis.grossRevenueVnd)}
          hint={`Thực nhận ${formatVnd(kpis.netPayoutVnd)}`}
          delta={kpis.revenueDeltaPct}
          spark={kpis.dailyRevenue}
        />
        <KpiTile
          label="Ghế đã bán"
          value={String(kpis.seatsSold)}
          hint={`${kpis.periodTrips} chuyến`}
        />
        <KpiTile
          label="Tỷ lệ lấp đầy"
          value={`${kpis.occupancyPct}%`}
          hint={`${kpis.seatsSold}/${kpis.capacityTotal} ghế`}
        />
        <KpiTile
          label="Tỷ lệ thanh toán"
          value={`${kpis.paidRatePct}%`}
          hint={`${kpis.paidBookings}/${kpis.totalBookings} đơn`}
        />
      </section>

      {/* Main + reserved right rail (lg+) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Quick actions */}
          <section aria-labelledby="quick-h" className="flex flex-col gap-3">
            <h2 id="quick-h" className="text-base font-semibold tracking-tight">
              Lối tắt
            </h2>
            <QuickActionGrid actions={quickActions} />
          </section>

          {/* Today's trips */}
          <TodayTripsStrip trips={todayTrips} now={now} />

          {/* Recent bookings (condensed queue) */}
          <QueueStrip
            rows={queue.rows.slice(0, 8).map((r) => ({
              id: r.id,
              bookingRef: r.bookingRef,
              buyerName: r.buyerName,
              buyerPhone: r.buyerPhone,
              ticketCount: r.ticketCount,
              contactStatus: r.contactStatus,
              paymentStatus: r.paymentStatus,
              departureAt: r.departureAt,
              escalatedAt: r.escalatedAt,
            }))}
            unviewedCount={unviewedCount}
          />
        </div>

        {/* Right rail — Activity feed (PR 8). */}
        <aside aria-label="Hoạt động" className="hidden lg:block">
          <ActivityFeed initialEvents={activity} variant="rail" />
        </aside>
      </div>
    </div>
  )
}
