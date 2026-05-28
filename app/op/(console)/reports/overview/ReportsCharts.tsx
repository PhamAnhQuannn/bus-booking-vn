"use client"

import dynamic from "next/dynamic"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Client wrapper that dynamic-imports the Recharts-based chart components.
 * Recharts ~70KB gzipped — loaded only on overview where it's actually shown.
 * `ssr: false` mandatory: Recharts measures DOM during initial render and
 * hydration mismatches if SSR'd.
 */
const RevenueLineChart = dynamic(
  () =>
    import("@/components/charts/RevenueLineChart").then((m) => ({
      default: m.RevenueLineChart,
    })),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent>
          <Skeleton className="h-[240px] w-full" />
        </CardContent>
      </Card>
    ),
  }
)

const BookingStatusDonut = dynamic(
  () =>
    import("@/components/charts/BookingStatusDonut").then((m) => ({
      default: m.BookingStatusDonut,
    })),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    ),
  }
)

export interface ReportsChartsProps {
  /** YYYY-MM-DD date strings paired with revenue in VND. */
  revenueSeries: { date: string; revenueVnd: number }[]
  statusBreakdown: { status: string; label: string; count: number }[]
}

export function ReportsCharts({
  revenueSeries,
  statusBreakdown,
}: ReportsChartsProps) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="py-4">
          <RevenueLineChart
            title="Doanh thu theo ngày"
            description="Doanh thu từ vé đã thanh toán trong khoảng đã chọn."
            data={revenueSeries}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4">
          <BookingStatusDonut data={statusBreakdown} />
        </CardContent>
      </Card>
    </div>
  )
}
