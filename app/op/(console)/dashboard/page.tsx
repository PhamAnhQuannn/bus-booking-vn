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
import { ArrowRightIcon } from "lucide-react"

import { getOperatorSession } from "@/lib/op/getOperatorSession"
import { getUnviewedPaidCount } from "@/lib/booking/getUnviewedPaidCount"
import { touchLastViewed } from "@/lib/booking/touchLastViewed"
import { listUpcomingForOperator } from "@/lib/trips/listUpcomingForOperator"
import { getActivityFeed } from "@/lib/op/getActivityFeed"
import { getTodaySnapshot } from "@/lib/op/getTodaySnapshot"
import { listRoutesForTripIds } from "@/lib/op/listRoutesForTripIds"
import { serverNow } from "@/lib/op/dateRanges"

import { PageHeader } from "@/components/op/PageHeader"
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

  const [snapshot, upcoming, activity] = await Promise.all([
    getTodaySnapshot(session.operatorId),
    listUpcomingForOperator(session.operatorId, { limit: 24 }),
    getActivityFeed({ operatorId: session.operatorId, limit: 30 }),
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

      <div className="flex flex-col gap-8">
        <TodayTripsStrip trips={todayTrips} now={now} />
        <InboxStream events={activity} now={now} />
      </div>
    </div>
  )
}
