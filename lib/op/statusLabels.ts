import type { BookingStatus, TripStatus } from "@prisma/client"

import type { badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

export interface StatusDisplay {
  variant: BadgeVariant
  label: string
}

// Single source of truth: Prisma enum value (verbatim) → Badge variant + Vietnamese
// label. Never inline a status string at a Badge call site — import from here.

const BOOKING_STATUS: Record<BookingStatus, StatusDisplay> = {
  awaiting_payment: { variant: "pending", label: "Chờ thanh toán" },
  pending_cash_payment: { variant: "pending", label: "Chờ thu tiền mặt" },
  paid_operator_notified: { variant: "success", label: "Đã thanh toán" },
  completed: { variant: "success", label: "Hoàn tất" },
  cancelled: { variant: "danger", label: "Đã hủy" },
  trip_cancelled: { variant: "danger", label: "Chuyến đã hủy" },
  no_show: { variant: "danger", label: "Vắng mặt" },
  payment_failed_expired: { variant: "danger", label: "Thanh toán thất bại" },
}

const TRIP_STATUS: Record<TripStatus, StatusDisplay> = {
  scheduled: { variant: "neutral", label: "Đã lên lịch" },
  departed: { variant: "pending", label: "Đã khởi hành" },
  completed: { variant: "success", label: "Hoàn tất" },
  cancelled: { variant: "danger", label: "Đã hủy" },
}

export function bookingStatusDisplay(status: BookingStatus): StatusDisplay {
  return BOOKING_STATUS[status]
}

export function tripStatusDisplay(
  status: TripStatus,
  salesClosed = false
): StatusDisplay {
  const base = TRIP_STATUS[status]
  // salesClosed is an orthogonal flag on a scheduled trip — annotate, don't replace.
  if (salesClosed && status === "scheduled") {
    return { variant: base.variant, label: `${base.label} (đóng bán)` }
  }
  return base
}

export function routeActiveDisplay(active: boolean): StatusDisplay {
  return active
    ? { variant: "success", label: "Hoạt động" }
    : { variant: "danger", label: "Vô hiệu hóa" }
}
