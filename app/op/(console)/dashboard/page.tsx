/**
 * /op/dashboard — Operator Operations Dashboard.
 *
 * Single-purpose surface: "what needs my attention now?". Three sections only:
 *   1. PageHeader greeting + one-line headline (today's counts + link to reports).
 *   2. Today's-trips strip (next 24h).
 *   3. Unified inbox (severity-sorted, fuses recent paid bookings + activity events).
 *
 * Analytics live at /op/reports/overview (KPI grid + charts). Navigation lives in
 * the sidebar + Cmd+K palette. This page is operations-only.
 *
 * Sacred order (Issue 014 mistake-log): read getUnviewedPaidCount BEFORE
 * touchLastViewed, then fan out parallel reads. No self-fetch (AGENTS.md rule).
 */

import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRightIcon, BusIcon, CalendarIcon, BellIcon, WalletIcon } from "lucide-react"

import { getOperatorSession } from "@/lib/op/getOperatorSession"
import { getUnviewedPaidCount } from "@/lib/booking/getUnviewedPaidCount"
import { touchLastViewed } from "@/lib/booking/touchLastViewed"
import { listUpcomingForOperator } from "@/lib/trips/listUpcomingForOperator"
import { getActivityFeed } from "@/lib/op/getActivityFeed"
import { getTodaySnapshot } from "@/lib/op/getTodaySnapshot"
import { listRoutesForTripIds } from "@/lib/op/listRoutesForTripIds"
import { getOperatorBalance } from "@/lib/ledger/balance"
import { prisma } from "@/lib/db/client"
import { serverNow } from "@/lib/op/dateRanges"

import { PageHeader } from "@/components/op/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { TodayTripsStrip } from "@/components/op/TodayTripsStrip"
import { InboxStream } from "@/components/op/InboxStream"
import type { TripMiniCardRow } from "@/components/op/TripMiniCard"

function formatVnd(v: number): string {
  return v.toLocaleString("vi-VN") + "đ"
}

export default async function OperatorDashboardPage() {
  const session = await getOperatorSession()
  if (!session) redirect("/op/login")
  if (session.requiresPasswordChange) redirect("/op/first-login")

  // Read unviewed count BEFORE touching — guards the badge invariant even though
  // the dashboard no longer displays the count directly (the bookings nav badge
  // still surfaces it).
  await getUnviewedPaidCount(session.operatorUserId, session.operatorId)
  await touchLastViewed(session.operatorUserId)

  const now = serverNow()
  const horizonMs = 24 * 3600 * 1000

  const [snapshot, upcoming, activity, balance, busTotal, busActive] = await Promise.all([
    getTodaySnapshot(session.operatorId),
    listUpcomingForOperator(session.operatorId, { limit: 24 }),
    getActivityFeed({ operatorId: session.operatorId, limit: 30 }),
    // Money box (S09 Overview): available balance + Withdraw shortcut.
    getOperatorBalance(session.operatorId),
    prisma.bus.count({ where: { operatorId: session.operatorId } }),
    prisma.bus.count({
      where: { operatorId: session.operatorId, deactivatedAt: null },
    }),
  ])

  // Today's trips: filter to next 24h, enrich with route labels.
  const todayCandidates = upcoming.trips.filter(
    (t) => Date.parse(t.departureAt) - now <= horizonMs
  )
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

  // Headline band only shows when something happened today.
  const hasTodayActivity =
    snapshot.tripsToday > 0 ||
    snapshot.newPaidBookings24h > 0 ||
    snapshot.revenueTodayVnd > 0

  // Alerts box (S09 Overview): count attention-worthy activity events.
  const alertsCount = activity.filter(
    (e) => e.severity === "warning" || e.severity === "danger"
  ).length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 lg:py-8">
      <PageHeader
        title={`Xin chào, ${session.operatorName}`}
        subtitle={
          hasTodayActivity ? (
            <span className="text-sm text-muted-foreground">
              Hôm nay:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {snapshot.tripsToday} chuyến
              </span>{" "}
              ·{" "}
              <span className="font-medium text-foreground tabular-nums">
                {snapshot.newPaidBookings24h} đặt vé mới
              </span>{" "}
              ·{" "}
              <span className="font-medium text-foreground tabular-nums">
                doanh thu {formatVnd(snapshot.revenueTodayVnd)}
              </span>{" "}
              <Link
                href="/op/reports/overview"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                xem báo cáo
                <ArrowRightIcon aria-hidden="true" className="size-3" />
              </Link>
            </span>
          ) : undefined
        }
      />

      {/* S09 Overview 4-box summary: Today · Fleet · Money · Alerts */}
      <section
        aria-label="Tổng quan nhanh"
        className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Card data-testid="overview-box-today">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarIcon aria-hidden="true" className="size-3.5" /> Hôm nay
            </span>
            <span className="text-xl font-bold tabular-nums">
              {snapshot.tripsToday} chuyến
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {snapshot.newPaidBookings24h} đặt vé mới
            </span>
          </CardContent>
        </Card>

        <Card data-testid="overview-box-fleet">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BusIcon aria-hidden="true" className="size-3.5" /> Đội xe
            </span>
            <span className="text-xl font-bold tabular-nums">{busTotal} xe</span>
            <Link
              href="/op/buses"
              className="text-xs text-primary hover:underline tabular-nums"
            >
              {busActive} đang hoạt động
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="overview-box-money">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <WalletIcon aria-hidden="true" className="size-3.5" /> Khả dụng
            </span>
            <span className="text-xl font-bold tabular-nums text-primary">
              {formatVnd(Number(balance.available))}
            </span>
            <Link href="/op/money" className="text-xs text-primary hover:underline">
              Rút tiền
            </Link>
          </CardContent>
        </Card>

        <Card data-testid="overview-box-alerts">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BellIcon aria-hidden="true" className="size-3.5" /> Cảnh báo
            </span>
            <span className="text-xl font-bold tabular-nums">{alertsCount}</span>
            <span className="text-xs text-muted-foreground">cần chú ý</span>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col gap-8">
        <TodayTripsStrip trips={todayTrips} now={now} />
        <InboxStream events={activity} now={now} />
      </div>
    </div>
  )
}
