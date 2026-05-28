"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useReducedMotion } from "@/lib/utils/useReducedMotion"
import {
  ChartContainer,
  ChartTooltipShell,
  chartPalette,
  chartTheme,
} from "@/components/charts/ChartTheme"

interface RevenuePoint {
  date: string // YYYY-MM-DD
  revenueVnd: number
}

interface RevenueLineChartProps {
  id?: string
  title?: string
  description?: string
  data: RevenuePoint[]
  /** Optional previous-period overlay (same length expected). */
  compare?: RevenuePoint[]
}

function formatCompactVnd(v: number): string {
  return new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v)
}

function formatFullVnd(v: number): string {
  return v.toLocaleString("vi-VN") + "đ"
}

function formatDateTick(d: string): string {
  // d is YYYY-MM-DD — render M/D
  const [, m, day] = d.split("-")
  return `${parseInt(day, 10)}/${parseInt(m, 10)}`
}

export function RevenueLineChart({
  id = "revenue-line",
  title = "Doanh thu theo ngày",
  description,
  data,
  compare,
}: RevenueLineChartProps) {
  const reduced = useReducedMotion()

  // Merge current + compare into a single series-keyed dataset by index (zip).
  const merged = data.map((p, i) => ({
    date: p.date,
    current: p.revenueVnd,
    previous: compare?.[i]?.revenueVnd ?? null,
  }))

  const srRows = data.map((p) => ({
    label: p.date,
    value: formatFullVnd(p.revenueVnd),
  }))

  return (
    <ChartContainer id={id} title={title} description={description} srRows={srRows}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={chartTheme.gridStroke} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            stroke={chartTheme.axisStroke}
            fontSize={chartTheme.axisFontSize}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatCompactVnd}
            stroke={chartTheme.axisStroke}
            fontSize={chartTheme.axisFontSize}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null
              return (
                <ChartTooltipShell>
                  <div className="font-medium">{label}</div>
                  {payload.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block size-2 rounded-full"
                        style={{ background: p.color }}
                      />
                      <span className="text-muted-foreground">
                        {p.dataKey === "current" ? "Kỳ này" : "Kỳ trước"}:
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatFullVnd(Number(p.value ?? 0))}
                      </span>
                    </div>
                  ))}
                </ChartTooltipShell>
              )
            }}
          />
          {compare ? (
            <Line
              type="monotone"
              dataKey="previous"
              stroke={chartPalette[1]}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={!reduced}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="current"
            stroke={chartPalette[0]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reduced}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
