/**
 * /op/buses/[id] — Operator Bus Detail.
 *
 * Bus header (plate, type, capacity, status, maintenance windows) + table of
 * currently-selling trips (scheduled + salesOpen + future). Each trip row links
 * to /op/manifest/:tripId for the passenger / buyer list.
 *
 * Server component: reads in-process via lib/buses/getOperatorBusWithTrips.
 * No self-fetch (AGENTS.md rule).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRightIcon, ClipboardListIcon, WrenchIcon } from "lucide-react"

import { getOperatorSession } from "@/lib/op/getOperatorSession"
import {
  getOperatorBusWithTrips,
  type BusActiveTrip,
} from "@/lib/catalog/getOperatorBusWithTrips"
import { busTypeLabel, busTypeWithCapacity } from "@/lib/op/statusLabels"
import { serverNow } from "@/lib/op/dateRanges"
import { PageHeader } from "@/components/op/PageHeader"
import { EmptyState } from "@/components/op/EmptyState"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type PageProps = { params: Promise<{ id: string }> }

function formatVnDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso))
}

function formatVnd(v: number): string {
  return v.toLocaleString("vi-VN") + "đ"
}

function occupancyTone(t: BusActiveTrip): { variant: "neutral" | "success" | "pending" | "danger"; label: string } {
  const pct = t.capacity > 0 ? Math.round((t.soldSeats / t.capacity) * 100) : 0
  if (t.availableSeats === 0) return { variant: "danger", label: "Đã đầy" }
  if (pct >= 90) return { variant: "pending", label: `${pct}% — gần đầy` }
  if (pct >= 50) return { variant: "success", label: `${pct}%` }
  return { variant: "neutral", label: `${pct}%` }
}

export default async function OpBusDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getOperatorSession()
  if (!session) redirect("/op/login")
  if (session.requiresPasswordChange) redirect("/op/first-login")

  const bus = await getOperatorBusWithTrips(session.operatorId, id)
  if (!bus) notFound()

  const now = serverNow()
  const inMaintenance = bus.maintenanceWindows.some(
    (m) => Date.parse(m.startAt) <= now && Date.parse(m.endAt) >= now
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <PageHeader
        breadcrumb={[
          { label: "Đội xe", href: "/op/buses" },
          { label: bus.licensePlate },
        ]}
        title={`Xe ${bus.licensePlate}`}
        subtitle={busTypeWithCapacity(bus.busType, bus.capacity)}
        backHref="/op/buses"
        badge={
          bus.deactivatedAt ? (
            <Badge variant="danger">Đã vô hiệu hoá</Badge>
          ) : inMaintenance ? (
            <Badge variant="pending">Đang bảo trì</Badge>
          ) : (
            <Badge variant="success">Đang hoạt động</Badge>
          )
        }
      />

      {/* Bus summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Biển số</span>
            <span className="font-mono text-xl font-bold tracking-tight">
              {bus.licensePlate}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Loại xe</span>
            <span className="text-xl font-semibold">{busTypeLabel(bus.busType)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Sức chứa</span>
            <span className="font-mono text-xl font-bold tracking-tight tabular-nums">
              {bus.capacity}
            </span>
            <span className="text-xs text-muted-foreground">chỗ</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-5">
            <span className="text-sm text-muted-foreground">Chuyến đang bán</span>
            <span className="font-mono text-xl font-bold tracking-tight tabular-nums">
              {bus.activeTrips.length}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Active selling trips */}
      <section aria-labelledby="active-trips-h" className="mb-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2
            id="active-trips-h"
            className="text-lg font-semibold tracking-tight"
          >
            Chuyến đang bán vé
          </h2>
          <span className="text-xs text-muted-foreground">
            Bấm vào chuyến để xem danh sách hành khách
          </span>
        </div>

        {bus.activeTrips.length === 0 ? (
          <EmptyState
            icon={<ClipboardListIcon />}
            variant="card"
            title="Xe này chưa có chuyến nào đang bán vé."
            description="Tạo chuyến mới hoặc mở lại bán vé từ trang chuyến đi."
            action={{ label: "Đi tới Chuyến đi", href: "/op/trips" }}
          />
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-hidden py-0 md:block">
              <Table data-testid="bus-active-trips-table">
                <caption className="sr-only">
                  Danh sách chuyến đang bán vé của xe {bus.licensePlate}
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Khởi hành</TableHead>
                    <TableHead>Tuyến</TableHead>
                    <TableHead className="text-right">Giá vé</TableHead>
                    <TableHead className="text-right">Đã bán</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead>Lấp đầy</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bus.activeTrips.map((t) => {
                    const tone = occupancyTone(t)
                    return (
                      <TableRow
                        key={t.id}
                        data-testid={`bus-trip-row-${t.id}`}
                        className="cursor-pointer"
                      >
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {formatVnDateTime(t.departureAt)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium">{t.origin}</span>
                            <ArrowRightIcon
                              aria-hidden="true"
                              className="size-3 text-muted-foreground"
                            />
                            <span className="font-medium">{t.destination}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatVnd(t.price)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {t.soldSeats}/{t.capacity}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {t.availableSeats}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tone.variant}>{tone.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/op/manifest/${t.id}`}
                            className="text-primary underline-offset-4 hover:underline"
                            data-testid={`bus-trip-manifest-link-${t.id}`}
                          >
                            Xem hành khách →
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile stacked cards */}
            <ul role="list" className="flex flex-col gap-3 md:hidden">
              {bus.activeTrips.map((t) => {
                const tone = occupancyTone(t)
                return (
                  <li key={t.id}>
                    <Link
                      href={`/op/manifest/${t.id}`}
                      className={cn(
                        "block rounded-xl border border-border bg-card p-4 text-card-foreground shadow-e1 outline-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-e2 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-sm tabular-nums">
                          {formatVnDateTime(t.departureAt)}
                        </span>
                        <Badge variant={tone.variant}>{tone.label}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-base font-medium">
                        <span>{t.origin}</span>
                        <ArrowRightIcon
                          aria-hidden="true"
                          className="size-3 text-muted-foreground"
                        />
                        <span>{t.destination}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          Đã bán {t.soldSeats}/{t.capacity} · Còn {t.availableSeats}
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatVnd(t.price)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-primary">
                        Xem hành khách →
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      {/* Maintenance windows */}
      {bus.maintenanceWindows.length > 0 ? (
        <section aria-labelledby="maintenance-h">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2 text-base">
                <WrenchIcon aria-hidden="true" className="size-4" />
                Lịch bảo trì
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul role="list" className="flex flex-col gap-2">
                {bus.maintenanceWindows.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="font-mono tabular-nums">
                      {formatVnDateTime(m.startAt)} → {formatVnDateTime(m.endAt)}
                    </span>
                    {m.reason ? (
                      <span className="text-muted-foreground">{m.reason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
