import { describe, it, expect } from "vitest"
import { BookingStatus, TripStatus } from "@prisma/client"

import {
  bookingStatusDisplay,
  tripStatusDisplay,
  routeActiveDisplay,
} from "@/lib/op/statusLabels"

describe("statusLabels", () => {
  it("maps every BookingStatus enum value to a non-empty label", () => {
    for (const status of Object.values(BookingStatus)) {
      const d = bookingStatusDisplay(status)
      expect(d.label.length).toBeGreaterThan(0)
      expect(d.variant).toBeTruthy()
    }
  })

  it("maps every TripStatus enum value to a non-empty label", () => {
    for (const status of Object.values(TripStatus)) {
      const d = tripStatusDisplay(status)
      expect(d.label.length).toBeGreaterThan(0)
      expect(d.variant).toBeTruthy()
    }
  })

  it("uses pending variant for unpaid bookings, success for paid", () => {
    expect(bookingStatusDisplay("awaiting_payment").variant).toBe("pending")
    expect(bookingStatusDisplay("paid_operator_notified").variant).toBe("success")
    expect(bookingStatusDisplay("cancelled").variant).toBe("danger")
  })

  it("appends (đóng bán) only on a sales-closed scheduled trip", () => {
    expect(tripStatusDisplay("scheduled").label).toBe("Đã lên lịch")
    expect(tripStatusDisplay("scheduled", true).label).toBe("Đã lên lịch (đóng bán)")
    // salesClosed on a non-scheduled status does not annotate
    expect(tripStatusDisplay("completed", true).label).toBe("Hoàn tất")
  })

  it("maps route active flag to success/danger", () => {
    expect(routeActiveDisplay(true)).toEqual({ variant: "success", label: "Hoạt động" })
    expect(routeActiveDisplay(false)).toEqual({ variant: "danger", label: "Vô hiệu hóa" })
  })
})
