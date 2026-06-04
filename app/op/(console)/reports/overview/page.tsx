/**
 * /op/reports/overview — Per-bus performance overview.
 *
 * Operator picks a date range. Page renders one row per active bus with that
 * bus's metrics over the window: trips run, seats sold, revenue, occupancy %.
 * Click a row → /op/buses/[id] for trip-level + manifest drilldown.
 *
 * Replaces the prior operator-wide KPI aggregate — that view was duplicating
 * what /op/reports/revenue already showed AND was not actionable per fleet
 * unit. Per-bus answers "which xe is making me money / sitting idle".
 *
 * In-process lib calls only (no self-fetch — AGENTS.md rule).
 */

import { redirect } from "next/navigation"
import Link from "next/link"

import { getOperatorSession } from "@/lib/op"
import { getBusPerformance } from "@/lib/reports"
import { getDefaultDateRange } from "@/lib/op"
import { busTypeLabel } from "@/lib/op"
import { Bus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/op/PageHeader"
import { EmptyState } from "@/components/op/EmptyState"

interface SearchParams {
  dateFrom?: string
  dateTo?: string
}

function formatVnd(v: number): string {
  return v.toLocaleString("vi-VN") + "đ"
}

function occupancyVariant(pct: number): "neutral" | "success" | "pending" | "danger" {
  if (pct >= 90) return "danger" // overcrowded watch
  if (pct >= 70) return "success"
  if (pct >= 40) return "pending"
  return "neutral"
}

export default async function ReportsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await getOperatorSession()
  if (!session) redirect("/op/login")
  if (session.requiresPasswordChange) redirect("/op/first-login")

  const params = await searchParams
  const { from, to } = getDefaultDateRange(30)
  const dateFrom = params.dateFrom ?? from
  const dateTo = params.dateTo ?? to

  const rows = await getBusPerformance({
    operatorId: session.operatorId,
    dateFrom,
    dateTo,
  })

  // Totals row.
  const totals = rows.reduce(
    (acc, r) => ({
      tripsCount: acc.tripsCount + r.tripsCount,
      seatsSold: acc.seatsSold + r.seatsSold,
      capacityTotal: acc.capacityTotal + r.capacityTotal,
      grossRevenueVnd: acc.grossRevenueVnd + r.grossRevenueVnd,
    }),
    { tripsCount: 0, seatsSold: 0, capacityTotal: 0, grossRevenueVnd: 0 }
  )
  const totalOccupancy =
    totals.capacityTotal > 0
      ? Math.round((totals.seatsSold / totals.capacityTotal) * 100)
      : 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <PageHeader
        title="Tổng quan theo xe"
        subtitle="Mỗi xe một dòng — bấm vào biển số để xem chi tiết chuyến + danh sách hành khách."
      />

      {/* Date range — plain GET form */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Từ ngày</span>
          <DatePicker
            name="dateFrom"
            defaultValue={dateFrom}
            aria-label="Từ ngày"
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Đến ngày</span>
          <DatePicker
            name="dateTo"
            defaultValue={dateTo}
            aria-label="Đến ngày"
            className="w-44"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-e1 transition-colors hover:bg-primary/90"
        >
          Áp dụng
        </button>
      </form>

      {/* Per-bus table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Bus />}
          variant="card"
          title="Chưa có xe nào đang hoạt động"
          description="Thêm xe để bắt đầu theo dõi doanh thu và tỷ lệ lấp đầy."
          action={{ label: "Đi tới Đội xe", href: "/op/buses" }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden py-0 md:block">
            <Table data-testid="bus-performance-table">
              <caption className="sr-only">
                Hiệu quả từng xe trong khoảng từ {dateFrom} đến {dateTo}
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Biển số</TableHead>
                  <TableHead>Loại xe</TableHead>
                  <TableHead className="text-right">Sức chứa</TableHead>
                  <TableHead className="text-right">Chuyến đã chạy</TableHead>
                  <TableHead className="text-right">Ghế đã bán</TableHead>
                  <TableHead className="text-right">Doanh thu</TableHead>
                  <TableHead>Tỷ lệ lấp đầy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.busId}
                    data-testid={`bus-perf-row-${r.busId}`}
                  >
                    <TableCell>
                      <Link
                        href={`/op/buses/${r.busId}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {r.licensePlate}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{busTypeLabel(r.busType)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.capacity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.tripsCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.seatsSold}
                      {r.capacityTotal > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {" "}/ {r.capacityTotal}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatVnd(r.grossRevenueVnd)}
                    </TableCell>
                    <TableCell>
                      {r.tripsCount === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={occupancyVariant(r.occupancyPct)}>
                          {r.occupancyPct}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">
                    Tổng cộng ({rows.length} xe)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">—</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {totals.tripsCount}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {totals.seatsSold}
                    {totals.capacityTotal > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {" "}/ {totals.capacityTotal}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatVnd(totals.grossRevenueVnd)}
                  </TableCell>
                  <TableCell>
                    {totals.capacityTotal === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={occupancyVariant(totalOccupancy)}>
                        {totalOccupancy}%
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>

          {/* Mobile stacked cards */}
          <ul role="list" className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.busId}>
                <Link
                  href={`/op/buses/${r.busId}`}
                  className="block rounded-xl border border-border bg-card p-4 text-card-foreground shadow-e1 outline-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-e2 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-lg font-semibold tracking-tight">
                      {r.licensePlate}
                    </span>
                    {r.tripsCount === 0 ? (
                      <Badge variant="neutral">Chưa chạy</Badge>
                    ) : (
                      <Badge variant={occupancyVariant(r.occupancyPct)}>
                        {r.occupancyPct}%
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {busTypeLabel(r.busType)} {r.capacity} chỗ
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Chuyến</dt>
                      <dd className="font-medium tabular-nums">{r.tripsCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Ghế bán</dt>
                      <dd className="font-medium tabular-nums">{r.seatsSold}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Doanh thu</dt>
                      <dd className="font-medium tabular-nums">
                        {formatVnd(r.grossRevenueVnd)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
            <li>
              <Card>
                <CardContent className="py-3 text-sm">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Tổng cộng ({rows.length} xe)</span>
                    {totals.capacityTotal > 0 ? (
                      <Badge variant={occupancyVariant(totalOccupancy)}>
                        {totalOccupancy}%
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {totals.tripsCount} chuyến · {totals.seatsSold} ghế ·{" "}
                    {formatVnd(totals.grossRevenueVnd)}
                  </div>
                </CardContent>
              </Card>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
