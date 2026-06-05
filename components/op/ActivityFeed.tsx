"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  type LucideIcon,
} from "lucide-react"

import type { ActivityEvent, Severity } from "@/lib/op"
import { formatRelativeVi } from "@/lib/op/formatRelativeVi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/op/EmptyState"
import { cn } from "@/lib/utils"

interface ActivityFeedProps {
  initialEvents: ActivityEvent[]
  variant?: "rail" | "page"
  pollIntervalMs?: number
}

const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: Clock,
  danger: AlertCircle,
}

const SEVERITY_TINT: Record<Severity, string> = {
  info: "border-l-info-foreground bg-info/40",
  success: "border-l-success-foreground bg-success/40",
  warning: "border-l-warning-foreground bg-warning/40",
  danger: "border-l-destructive bg-destructive/10",
}

/**
 * Activity feed — visibility-paused 30s polling, exponential back-off, debounced
 * SR announcement. Variants: `rail` (compact, fixed-height) and `page` (full).
 */
export function ActivityFeed({
  initialEvents,
  variant = "rail",
  pollIntervalMs = 30_000,
}: ActivityFeedProps) {
  const [events, setEvents] = React.useState<ActivityEvent[]>(initialEvents)
  const [now, setNow] = React.useState(() => Date.now())
  const announceRef = React.useRef<string>("")
  const consecutiveErrorsRef = React.useRef(0)

  // Poll every N seconds when visible. Cleared while document hidden.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function tick() {
      if (cancelled) return
      try {
        const res = await fetch("/api/op/activity?limit=30", {
          credentials: "same-origin",
        })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const json = await res.json()
        if (cancelled) return
        const next: ActivityEvent[] = Array.isArray(json.events) ? json.events : []
        setEvents(next)
        setNow(Date.now())
        consecutiveErrorsRef.current = 0
        if (next[0] && next[0].id !== announceRef.current) {
          announceRef.current = next[0].id
        }
      } catch {
        consecutiveErrorsRef.current = Math.min(consecutiveErrorsRef.current + 1, 5)
      }
      schedule()
    }

    function schedule() {
      if (cancelled) return
      if (document.visibilityState === "hidden") return
      const factor = Math.pow(2, consecutiveErrorsRef.current)
      const delay = Math.min(pollIntervalMs * factor, 5 * 60_000)
      timer = setTimeout(tick, delay)
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && timer === null) {
        schedule()
      } else if (document.visibilityState === "hidden" && timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    schedule()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [pollIntervalMs])

  if (events.length === 0) {
    if (variant === "rail") {
      return (
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-base">
              Hoạt động gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Chưa có hoạt động."
              description="Đặt vé, escalation, và lịch sử chuyến sẽ xuất hiện ở đây."
              variant="inline"
            />
          </CardContent>
        </Card>
      )
    }
    return (
      <EmptyState
        title="Không có hoạt động nào trong 7 ngày qua."
        description="Khi có đơn mới hoặc chuyến chuyển trạng thái, danh sách sẽ cập nhật ở đây."
        variant="card"
      />
    )
  }

  const list = (
    <ul
      role="list"
      aria-live="polite"
      aria-relevant="additions"
      className="flex flex-col gap-2"
    >
      {events.map((ev) => {
        const Icon = SEVERITY_ICON[ev.severity]
        const tint = SEVERITY_TINT[ev.severity]
        const body = (
          <div
            className={cn(
              "flex w-full items-start gap-2 rounded-md border-l-2 px-3 py-2 text-sm transition-colors",
              tint
            )}
          >
            <Icon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-foreground/80"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-medium text-foreground">{ev.title}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatRelativeVi(ev.ts, now)}
                </span>
              </div>
              <p className="text-muted-foreground">{ev.body}</p>
            </div>
          </div>
        )
        return (
          <li key={ev.id}>
            {ev.href ? (
              <Link
                href={ev.href}
                className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )

  if (variant === "rail") {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Hoạt động gần đây
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[480px] overflow-y-auto">
          {list}
        </CardContent>
      </Card>
    )
  }

  return list
}
