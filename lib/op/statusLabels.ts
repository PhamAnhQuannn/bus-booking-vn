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

// Contact-status map — used by booking-queue, manifest, booking-detail. Previously
// duplicated in 3 client files (DashboardClient, BookingDetailClient,
// StaffDashboardClient, ManifestRefresh). Single source of truth.
const CONTACT_STATUS: Record<string, StatusDisplay> = {
  pending: { variant: "pending", label: "Chưa gọi" },
  reached: { variant: "success", label: "Đã liên lạc" },
  no_answer: { variant: "danger", label: "Không bắt máy" },
  callback: { variant: "neutral", label: "Gọi lại sau" },
}

export function contactStatusDisplay(status: string | null | undefined): StatusDisplay {
  if (!status) return { variant: "pending", label: "Chưa gọi" }
  return CONTACT_STATUS[status] ?? { variant: "neutral", label: status }
}

// Payout status — previously duplicated across RevenueClient + PayoutsClient.
const PAYOUT_STATUS: Record<string, StatusDisplay> = {
  pending: { variant: "pending", label: "Chờ xử lý" },
  processing: { variant: "neutral", label: "Đang xử lý" },
  settled: { variant: "success", label: "Đã thanh toán" },
  failed: { variant: "danger", label: "Thất bại" },
}

export function payoutStatusDisplay(status: string | null | undefined): StatusDisplay {
  if (!status) return { variant: "neutral", label: "—" }
  return PAYOUT_STATUS[status] ?? { variant: "neutral", label: status }
}

// Bus type label — previously inlined in BusesClient + lib/api/busesClient.
const BUS_TYPE_LABELS: Record<string, string> = {
  coach: "Coach",
  sleeper: "Sleeper",
  limousine: "Limousine",
}

export function busTypeLabel(busType: string): string {
  return BUS_TYPE_LABELS[busType] ?? busType
}

// Booking flag glyphs — manual / cash / escalated. Variant maps to Badge variant.
// Glyph is decorative (aria-hidden); the label is the SR-accessible name.
export const FLAG_GLYPHS = {
  manual: { glyph: "✏", label: "Gắn cờ thủ công", variant: "neutral" as const },
  cash: { glyph: "₫", label: "Thanh toán tiền mặt", variant: "pending" as const },
  escalated: { glyph: "⚠", label: "Đã chuyển cấp", variant: "danger" as const },
} as const

export type FlagKind = keyof typeof FLAG_GLYPHS
