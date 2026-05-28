import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Sparkline } from "@/components/ui/sparkline"
import { cn } from "@/lib/utils"

interface KpiTileProps {
  label: string
  value: string
  hint?: string
  /** Period-compare delta percentage. null hides the badge. */
  delta?: number | null
  /** Optional sparkline data — rendered when length ≥ 2. */
  spark?: number[]
  /** Optional icon node (e.g. lucide) — rendered above label. */
  icon?: ReactNode
  /** Larger chart slot — replaces sparkline when provided (PR 6 chart integration). */
  chart?: ReactNode
  className?: string
}

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return null
  const up = pct >= 0
  return (
    <span
      className={cn(
        "text-xs font-medium",
        up ? "text-success-foreground" : "text-destructive"
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}% so với kỳ trước
    </span>
  )
}

export function KpiTile({
  label,
  value,
  hint,
  delta,
  spark,
  icon,
  chart,
  className,
}: KpiTileProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-1 py-5">
        {icon ? (
          <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-2xl font-bold tracking-tight">{value}</span>
        {delta !== undefined ? <DeltaBadge pct={delta} /> : null}
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        {chart ? (
          <div className="mt-2">{chart}</div>
        ) : spark && spark.length > 1 ? (
          <Sparkline data={spark} className="mt-2" />
        ) : null}
      </CardContent>
    </Card>
  )
}
