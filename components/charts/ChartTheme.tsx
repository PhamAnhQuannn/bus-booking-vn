"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Chart theming primitives.
 *
 *   - `chartPalette` — ordered series colors mapped to design tokens.
 *   - `statusColor`  — semantic mapping for booking-status slices.
 *   - `ChartContainer` — `<figure>` + `<figcaption>` + sr-only data fallback.
 *   - `ChartTooltipShell` — Card-styled tooltip body for Recharts custom tooltip.
 *
 * Recharts is client-only — every consumer must `dynamic({ ssr: false })`.
 */

export const chartPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

export function statusColor(
  kind: "paid" | "pending" | "cancelled" | "neutral"
): string {
  switch (kind) {
    case "paid":
      return "var(--success-foreground)"
    case "pending":
      return "var(--warning-foreground)"
    case "cancelled":
      return "var(--destructive)"
    default:
      return "var(--chart-4)"
  }
}

export const chartTheme = {
  axisStroke: "var(--muted-foreground)",
  gridStroke: "var(--border)",
  axisFontFamily: "var(--font-sans)",
  axisFontSize: 12,
  tooltipBg: "var(--popover)",
  tooltipBorderRadius: "var(--radius-lg)",
} as const

interface ChartContainerProps {
  id: string
  title: string
  description?: string
  /** Visually-hidden screen-reader fallback rendered as a <table>. */
  srRows: { label: string; value: string }[]
  /** Minimum height of the chart area in px. */
  minHeight?: number
  className?: string
  children: ReactNode
}

/**
 * Renders the chart inside a `<figure>` with `<figcaption>` + an aria-described
 * region + a visually-hidden `<table>` mirror of the data. The Recharts SVG is
 * aria-hidden; SR users get the table.
 */
export function ChartContainer({
  id,
  title,
  description,
  srRows,
  minHeight = 240,
  className,
  children,
}: ChartContainerProps) {
  const titleId = `${id}-title`
  const descId = `${id}-desc`
  return (
    <figure
      role="group"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn("flex flex-col gap-2", className)}
    >
      <figcaption id={titleId} className="text-sm font-medium text-foreground">
        {title}
      </figcaption>
      {description ? (
        <p id={descId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div
        aria-hidden="true"
        style={{ minHeight }}
        className="w-full"
      >
        {children}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Mục</th>
            <th scope="col">Giá trị</th>
          </tr>
        </thead>
        <tbody>
          {srRows.map((row, idx) => (
            <tr key={`${row.label}-${idx}`}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

interface TooltipShellProps {
  children: ReactNode
  className?: string
}

/** Card-styled tooltip body. Use inside Recharts' `<Tooltip content={...}>`. */
export function ChartTooltipShell({ children, className }: TooltipShellProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-e2",
        className
      )}
    >
      {children}
    </div>
  )
}
