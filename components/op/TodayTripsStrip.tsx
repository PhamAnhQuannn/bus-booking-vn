import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { TripMiniCard, type TripMiniCardRow } from "@/components/op/TripMiniCard"
import { EmptyState } from "@/components/op/EmptyState"
import { Bus } from "lucide-react"

interface TodayTripsStripProps {
  trips: TripMiniCardRow[]
  /** Server-injected reference now (ms). Keeps all cards consistent. */
  now: number
}

export function TodayTripsStrip({ trips, now }: TodayTripsStripProps) {
  if (trips.length === 0) {
    return (
      <section
        aria-labelledby="today-trips-h"
        className="rounded-xl border border-border bg-card p-4 shadow-e1"
      >
        <h2
          id="today-trips-h"
          className="mb-2 text-base font-semibold tracking-tight"
        >
          Chuyến trong 24 giờ tới
        </h2>
        <EmptyState
          icon={<Bus />}
          title="Không có chuyến nào trong 24 giờ tới"
          description="Tạo chuyến mới từ trang Chuyến đi."
          action={{ label: "Đi tới Chuyến đi", href: "/op/trips" }}
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="today-trips-h" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2
          id="today-trips-h"
          className="text-base font-semibold tracking-tight"
        >
          Chuyến trong 24 giờ tới
        </h2>
        <Link
          href="/op/upcoming"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Tất cả sắp tới
          <ArrowRightIcon aria-hidden="true" className="size-3" />
        </Link>
      </div>
      <ul
        role="list"
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
      >
        {trips.map((trip) => (
          <li key={trip.id} className="contents">
            <TripMiniCard trip={trip} now={now} />
          </li>
        ))}
      </ul>
    </section>
  )
}
