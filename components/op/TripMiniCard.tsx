import Link from "next/link"
import { ArrowRightIcon, ClockIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { tripStatusDisplay } from "@/lib/op"
import { formatRelativeVi } from "@/lib/op"
import { cn } from "@/lib/utils"
import type { TripStatus } from "@prisma/client"

export interface TripMiniCardRow {
  id: string
  routeId: string
  origin: string
  destination: string
  departureAt: string // ISO 8601
  status: TripStatus
  salesClosed: boolean
  capacity: number
  bookingsCount: number
  availableSeats: number
}

interface TripMiniCardProps {
  trip: TripMiniCardRow
  /** Now in ms — passed in by parent so all cards in the strip use a consistent reference. */
  now: number
  className?: string
}

function formatHm(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d)
}

export function TripMiniCard({ trip, now, className }: TripMiniCardProps) {
  const status = tripStatusDisplay(trip.status, trip.salesClosed)
  const occupancyPct =
    trip.capacity > 0
      ? Math.min(100, Math.round((trip.bookingsCount / trip.capacity) * 100))
      : 0

  // Heads-up chip — full or near-full.
  const headsUp =
    trip.availableSeats === 0
      ? { variant: "danger" as const, label: "Đã đầy" }
      : trip.availableSeats <= 3 && trip.status === "scheduled"
        ? { variant: "pending" as const, label: "Còn ít vé" }
        : null

  return (
    <Link
      href={`/op/trips/${trip.id}`}
      className={cn(
        "group flex w-72 shrink-0 snap-start flex-col gap-2 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-e1 outline-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-e2 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-lg font-semibold tracking-tight tabular-nums">
          {formatHm(trip.departureAt)}
        </span>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-sm text-foreground">
        <span className="min-w-0 truncate">{trip.origin}</span>
        <ArrowRightIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 truncate">{trip.destination}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClockIcon aria-hidden="true" className="size-3" />
        <span>{formatRelativeVi(trip.departureAt, now)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`Lấp đầy ${occupancyPct}%`}
        >
          <div
            className={cn(
              "h-full rounded-full",
              occupancyPct >= 90
                ? "bg-warning-foreground"
                : occupancyPct >= 50
                  ? "bg-primary"
                  : "bg-primary/70"
            )}
            // Sanctioned data-driven width — see design-language §8.
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <span className="tabular-nums text-muted-foreground">
          {trip.bookingsCount}/{trip.capacity}
        </span>
      </div>
      {headsUp ? (
        <Badge variant={headsUp.variant} className="self-start">
          {headsUp.label}
        </Badge>
      ) : null}
    </Link>
  )
}
