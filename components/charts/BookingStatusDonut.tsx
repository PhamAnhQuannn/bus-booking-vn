"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { useReducedMotion } from "@/lib/utils/useReducedMotion"
import {
  ChartContainer,
  ChartTooltipShell,
  chartPalette,
  statusColor,
} from "@/components/charts/ChartTheme"

interface StatusSlice {
  status: string
  label: string
  count: number
}

interface BookingStatusDonutProps {
  id?: string
  title?: string
  data: StatusSlice[]
}

const PAID = new Set(["pending_cash_payment", "paid_operator_notified", "completed"])
const CANCELLED = new Set(["cancelled", "trip_cancelled", "no_show", "payment_failed_expired"])
const PENDING = new Set(["awaiting_payment"])

function colorForStatus(status: string, idx: number): string {
  if (PAID.has(status)) return statusColor("paid")
  if (PENDING.has(status)) return statusColor("pending")
  if (CANCELLED.has(status)) return statusColor("cancelled")
  return chartPalette[(idx + 2) % chartPalette.length]
}

export function BookingStatusDonut({
  id = "booking-status-donut",
  title = "Đơn theo trạng thái",
  data,
}: BookingStatusDonutProps) {
  const reduced = useReducedMotion()
  const total = data.reduce((s, d) => s + d.count, 0)

  const srRows = data.map((d) => ({ label: d.label, value: String(d.count) }))

  return (
    <ChartContainer id={id} title={title} srRows={srRows} minHeight={260}>
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-center">
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={1}
              stroke="var(--card)"
              isAnimationActive={!reduced}
            >
              {data.map((entry, idx) => (
                <Cell key={entry.status} fill={colorForStatus(entry.status, idx)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                const p = payload[0]
                const item = p.payload as StatusSlice
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                return (
                  <ChartTooltipShell>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-muted-foreground">
                      {item.count} đơn · {pct}%
                    </div>
                  </ChartTooltipShell>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend doubles as the SR-visible content path. */}
        <ul role="list" className="flex flex-col gap-1.5 text-sm">
          {data.map((d, idx) => (
            <li key={d.status} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-sm"
                style={{ background: colorForStatus(d.status, idx) }}
              />
              <span className="flex-1">{d.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {d.count}
              </span>
            </li>
          ))}
          {data.length === 0 ? (
            <li className="text-muted-foreground">Chưa có dữ liệu trong kỳ.</li>
          ) : null}
        </ul>
      </div>
    </ChartContainer>
  )
}
