import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import type { BookingStatus } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/op/EmptyState"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { bookingStatusDisplay, contactStatusDisplay } from "@/lib/op/statusLabels"
import { cn } from "@/lib/utils"
import { Inbox } from "lucide-react"

export interface QueueStripRow {
  id: string
  bookingRef: string
  buyerName: string
  buyerPhone: string
  ticketCount: number
  contactStatus: string
  paymentStatus: string
  departureAt: string
  escalatedAt?: string | null
}

interface QueueStripProps {
  rows: QueueStripRow[]
  unviewedCount: number
}

function formatVnDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso))
}

/**
 * Condensed queue surfacing the top N bookings on the dashboard landing. Read-only;
 * the full filterable queue lives at /op/bookings.
 */
export function QueueStrip({ rows, unviewedCount }: QueueStripProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          Đặt vé gần đây
          {unviewedCount > 0 ? (
            <Badge variant="count" aria-label={`${unviewedCount} đơn mới chưa xem`}>
              {unviewedCount} mới
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 md:px-0">
        {rows.length === 0 ? (
          <div className="px-4">
            <EmptyState
              icon={<Inbox />}
              title="Chưa có đặt vé nào"
              description="Khi khách đặt vé, đơn sẽ xuất hiện ở đây."
              variant="inline"
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <caption className="sr-only">Đặt vé gần đây</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã đặt</TableHead>
                    <TableHead>Khách</TableHead>
                    <TableHead>SĐT</TableHead>
                    <TableHead className="text-right">Vé</TableHead>
                    <TableHead>Liên lạc</TableHead>
                    <TableHead>Thanh toán</TableHead>
                    <TableHead>Khởi hành</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const pay = bookingStatusDisplay(r.paymentStatus as BookingStatus)
                    const contact = contactStatusDisplay(r.contactStatus)
                    return (
                      <TableRow
                        key={r.id}
                        className={r.escalatedAt ? "bg-warning/10" : undefined}
                      >
                        <TableCell>
                          <Link
                            href={`/op/bookings/${r.id}`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {r.bookingRef}
                          </Link>
                        </TableCell>
                        <TableCell>{r.buyerName}</TableCell>
                        <TableCell className="tabular-nums">{r.buyerPhone}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.ticketCount}
                        </TableCell>
                        <TableCell>
                          <Badge variant={contact.variant}>{contact.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={pay.variant}>{pay.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {formatVnDateTime(r.departureAt)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile stacked cards */}
            <ul role="list" className="flex flex-col gap-2 px-4 md:hidden">
              {rows.map((r) => {
                const pay = bookingStatusDisplay(r.paymentStatus as BookingStatus)
                const contact = contactStatusDisplay(r.contactStatus)
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-lg border border-border bg-background p-3 shadow-e1",
                      r.escalatedAt && "border-warning-border bg-warning/10"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/op/bookings/${r.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {r.bookingRef}
                      </Link>
                      <Badge variant={pay.variant}>{pay.label}</Badge>
                    </div>
                    <div className="mt-1 text-sm">{r.buyerName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{r.buyerPhone}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{r.ticketCount} vé</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatVnDateTime(r.departureAt)}
                      </span>
                    </div>
                    <Badge variant={contact.variant} className="mt-2">
                      {contact.label}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
      <CardFooter className="justify-between border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {rows.length} đơn mới nhất
        </span>
        <Link
          href="/op/bookings"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Xem tất cả
          <ArrowRightIcon aria-hidden="true" className="size-3" />
        </Link>
      </CardFooter>
    </Card>
  )
}
