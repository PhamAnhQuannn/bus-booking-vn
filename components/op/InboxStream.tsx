import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import type { ActivityEvent, Severity } from "@/lib/op/activityTypes"
import { formatRelativeVi } from "@/lib/op/formatRelativeVi"
import { EmptyState } from "@/components/op/EmptyState"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface InboxStreamProps {
  events: ActivityEvent[]
  /** Server-injected reference now (ms) — keeps relative-time labels consistent across items. */
  now: number
  /** Max rendered items; defaults to 20. */
  limit?: number
}

/**
 * Unified attention queue. Replaces both the recent-bookings QueueStrip and the
 * right-rail ActivityFeed on /op/dashboard. Items come from getActivityFeed
 * already merge-sorted by ts DESC — we re-sort here by (severity rank, ts DESC)
 * so the operator's eye lands on critical → warning → success → info.
 */

const SEVERITY_RANK: Record<Severity, number> = {
  danger: 0,
  warning: 1,
  success: 2,
  info: 3,
}

const SEVERITY_TINT: Record<Severity, string> = {
  danger: "border-l-destructive bg-destructive/[0.04]",
  warning: "border-l-warning-foreground bg-warning/30",
  success: "border-l-success-foreground bg-success/30",
  info: "border-l-info-foreground bg-card",
}

const SEVERITY_DOT: Record<Severity, string> = {
  danger: "bg-destructive",
  warning: "bg-warning-foreground",
  success: "bg-success-foreground",
  info: "bg-info-foreground",
}

export function InboxStream({ events, now, limit = 20 }: InboxStreamProps) {
  const sorted = [...events].sort((a, b) => {
    const sevDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (sevDelta !== 0) return sevDelta
    return Date.parse(b.ts) - Date.parse(a.ts)
  })
  const visible = sorted.slice(0, limit)

  return (
    <section
      aria-labelledby="inbox-h"
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="inbox-h" className="text-base font-semibold tracking-tight">
          Việc cần làm
        </h2>
        <Link
          href="/op/activity"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Xem tất cả hoạt động
          <ArrowRightIcon aria-hidden="true" className="size-3" />
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          variant="card"
          title="Chưa có hoạt động cần xử lý"
          description="Đơn mới, escalation, và sự kiện chuyến sẽ xuất hiện ở đây khi có."
        />
      ) : (
        <ul
          role="list"
          className="overflow-hidden rounded-xl border border-border bg-card shadow-e1"
        >
          {visible.map((ev) => (
            <li
              key={ev.id}
              className={cn(
                "flex items-start gap-3 border-b border-border border-l-2 px-3 py-2.5 last:border-b-0",
                SEVERITY_TINT[ev.severity]
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-2 inline-block size-2 shrink-0 rounded-full",
                  SEVERITY_DOT[ev.severity]
                )}
              />
              <div className="min-w-0 flex-1">
                {ev.href ? (
                  <Link
                    href={ev.href}
                    className="text-sm font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {ev.title}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-foreground">
                    {ev.title}
                  </span>
                )}
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{ev.body}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatRelativeVi(ev.ts, now)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
