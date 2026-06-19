---
screen: customer-booking-confirmation
route: /booking/confirmation/[token]
last-updated: 2026-05-20
status: draft
---

# Wireframe: Booking Confirmation

## Purpose
Terminal success page for a booking. The confirmationToken in the URL is the access key (no auth). Shows booking ref, status, trip details, buyer info, total, and — for cash bookings — a pay-on-board notice.

## Entry Points
- From: `/booking/review` after cash initiate 200; the result page "Xem thông tin đặt vé" link (paid MoMo); the bookingPendingCash SMS link; future "My bookings" history.
- Redirects to: none. `getBookingByConfirmationToken` miss → `notFound()`. `/booking/layout.tsx` whitelists this prefix (bypasses tripId guard).

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| Đặt vé thành công           (h1)     | ← text-2xl font-bold
| Mã đặt chỗ: BB-2026-xxxx-xxxx (mono) |
| Trạng thái: Chờ thanh toán tiền mặt  | ← STATUS_LABEL (text-amber-700)
|                                      |
| +----------------------------------+ |
| | Chi tiết chuyến đi      (h2)     | | ← card (bg-white border rounded-lg)
| | Tuyến      Hà Nội → TP.HCM       | |
| | Khởi hành  Thứ ..., 08:30 20/5   | | ← full VN datetime, TZ VN
| | Xe         51B-12345 (mono)      | |
| | Nhà xe     Nhà xe ABC            | |
| | Hotline    0901234567 (mono)     | |
| +----------------------------------+ |
| +----------------------------------+ |
| | Thông tin đặt vé        (h2)     | | ← card
| | Hành khách Nguyễn Văn A          | |
| | SĐT        0901234567 (mono)     | |
| | Số vé      2                     | |
| | ─────────────────────────────── | |
| | Tổng cộng        500.000đ        | | ← total (text-blue-700)
| +----------------------------------+ |
| +== amber notice (cash only) =====+  |
| | Thanh toán tiền mặt khi lên xe  | | ← only if pending_cash_payment
| | Vui lòng thanh toán ... 15 phút | |
| +=================================+  |
+--------------------------------------+
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------+
|        +------------------------------------------+      | ← max-w-md centered
|        | Đặt vé thành công | Mã + Trạng thái       |      |
|        | +--- Chi tiết chuyến đi -----------------+|      |
|        | +--- Thông tin đặt vé -------------------+|      |
|        | +--- (amber) pay-on-board notice --------+|      |
|        +------------------------------------------+      |
+----------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| ConfirmationPage (RSC) | `app/booking/confirmation/[token]/page.tsx` | No |
| Detail cards (`<dl>` ×2) | inline `bg-white border rounded-lg` | Yes — Card primitive MISSING |
| Status text | inline span (`text-amber-700`) | Yes — Badge MISSING |
| Cash notice banner | inline `bg-amber-50` section | Yes — Alert MISSING; amber palette verbatim |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | RSC fetch | server-rendered; no client spinner |
| empty | token matches no booking | `notFound()` (404) |
| success | booking found | full confirmation render |
| cash-pending | status `pending_cash_payment` | amber pay-on-board notice shown |
| paid | status `paid_operator_notified` / others | status label updates; cash notice hidden |
| error | DB throws | Next error boundary (not custom-designed) |
| disabled-action | n/a | no interactive controls / CTAs on this page |

## Interactions
- Static page — no buttons, no client JS. Read-only confirmation.
- All status values mapped via STATUS_LABEL (VN); falls back to raw status string.
- Phone / plate / hotline / ref use `font-mono`.
- No sticky CTA (none present).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| bookingRef, status, buyer, ticketCount, totalVnd | RSC render | `getBookingByConfirmationToken(token)` (in-process) | No |
| trip route, departureAt, bus plate, operator legalName + contactPhone | RSC render | same query (joined) | No |
| status label localization | render | `STATUS_LABEL` map | n/a |

## Open Questions
- No "add to calendar", "share", or "view my bookings" affordance — add for Phase A?
- Status shown as colored text only; promote to a Badge primitive for clarity.
- All statuses render under the "Đặt vé thành công" h1 — cancelled/no_show would look success-y; consider status-specific heading.

## Out of Scope
- Cancellation / refund actions.
- Re-sending the SMS.
- Account linking UI (`attachGuestBookingByPhone` is post-hoc/backend).
