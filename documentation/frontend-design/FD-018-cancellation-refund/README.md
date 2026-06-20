# DS-035 -- FD-018: Cancellation & Refund UX

## 1. Overview

Customer self-service cancellation and refund tracking UI for the BusBooking platform. This spec covers the complete cancellation journey: policy visibility, fee preview, confirmation flow, refund status tracking, and edge cases (failed refunds, operator-initiated trip cancellations). All UI text uses Vietnamese with proper diacritics. Cancellation policy complies with Consumer Protection Law 2023 (No. 19/2023/QH15) Article 29 and operator-configured windows.

**Scope**: Customer-facing web UI only. Operator and admin refund management interfaces are out of scope.

---

## 2. Cancellation Policy Display

### 2.1 Display Locations

The cancellation policy must be visible at two points in the customer journey:

| Location | Trigger | Content |
|----------|---------|---------|
| Booking review page (`/booking/review`) | Before payment commitment | Full tiered fee schedule + Art. 29 countdown if applicable |
| Booking detail page (`/booking/confirmation/[token]`) | Post-payment, viewing ticket | Applicable cancellation window + fee for current time bracket |

### 2.2 Tiered Fee Schedule Table

Displayed as a styled table with the customer's current bracket highlighted:

| Khung thời gian | Phí hủy | Hoàn lại |
|------------------|---------|----------|
| Trong 24 giờ sau khi đặt | 0% | 100% giá vé |
| 24--48 giờ sau khi đặt | 10% | 90% giá vé |
| 48--72 giờ sau khi đặt | 20% | 80% giá vé |
| Sau 72 giờ | Không thể tự hủy | -- |

**Rendering rules:**

- The row matching the customer's current time bracket is highlighted with a left border accent (orange, primary brand color) and bold text.
- Expired brackets are shown in muted/disabled style.
- If the operator has configured a custom policy that extends the window or reduces fees, the operator policy replaces the default table. A footnote reads: "Chính sách hủy do nhà xe quy định" (Cancellation policy set by the operator).
- The Art. 29 statutory minimum (3 business days) is always the floor -- operator policies cannot reduce below it.

### 2.3 Art. 29 Free Cancellation Countdown

When the booking is within the 3-business-day Art. 29 window AND before trip departure:

```
+----------------------------------------------------------+
|  Hủy miễn phí trong 47 giờ 23 phút                      |
|  Theo Luật Bảo vệ quyền lợi người tiêu dùng 2023       |
+----------------------------------------------------------+
```

**Countdown logic:**

- Computed from `booking.createdAt + 3 business days` (excluding weekends and Vietnamese public holidays).
- Displayed as "X giờ Y phút" when > 1 hour remaining; "X phút" when < 1 hour.
- When the window expires, the banner disappears and the cancellation button shows the applicable fee bracket instead.

---

## 3. Cancellation Flow

### 3.1 Entry Point

On the booking detail page (`/booking/confirmation/[token]`), a secondary button is displayed for bookings in `paid` status:

```
[ Hủy đặt vé ]       (secondary/outline style, not primary)
```

**Button visibility conditions:**

| Booking Status | Button Visible | Notes |
|----------------|---------------|-------|
| `paid` | Yes | Active cancellation eligible |
| `awaiting_payment` | No | Payment not completed; hold expires naturally |
| `completed` | No | Trip already completed |
| `cancelled` | No | Already cancelled |
| `trip_cancelled` | No | Operator cancelled; auto-refund in progress |
| `no_show` | No | Trip departed, customer did not board |
| `refunded` | No | Already refunded |

### 3.2 Fee Preview (Pre-Confirmation)

Clicking "Huy dat ve" opens a bottom sheet (mobile) or modal (desktop) displaying the cancellation fee breakdown:

```
+----------------------------------------------------------+
|  Hủy đặt vé                                             |
|                                                          |
|  Mã đặt vé: BB-2026-a1b2-c3d4                          |
|  Tuyến: Thanh Hóa → TP.HCM                             |
|  Ngày đi: 25/06/2026 - 08:00                            |
|  Số vé: 2                                                |
|                                                          |
|  ┌────────────────────────────────────────────────┐      |
|  │  Giá vé:           500.000 đ                   │      |
|  │  Phí hủy (10%):    -50.000 đ                   │      |
|  │  ──────────────────────────────────────         │      |
|  │  Hoàn lại:          450.000 đ                   │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  Hoàn tiền qua MoMo                                     |
|  Thời gian hoàn tiền: 1-3 ngày làm việc                 |
|                                                          |
|  [ Quay lại ]          [ Xác nhận hủy vé ]              |
+----------------------------------------------------------+
```

**Fee preview specifications:**

| Element | Format | Source |
|---------|--------|--------|
| Ticket price | `{totalVnd} đ` with thousands separator (dấu chấm) | `booking.totalVnd` |
| Cancellation fee | `-{fee} đ` with percentage label | Computed server-side from tiered schedule |
| Refund amount | `{refundAmount} đ` | `totalVnd - fee` |
| Refund method | "Hoàn tiền qua {adapter}" | Original payment method (MoMo / VNPay / bank transfer) |
| Refund timeline | "1-3 ngày làm việc" | Static text (PSP-dependent actual timing) |

**Art. 29 variant**: If within the free cancellation window, the fee line shows "Phí hủy: 0 đ (miễn phí theo Luật BVQLNTD 2023)" and the refund amount equals the full ticket price.

### 3.3 Confirmation Dialog

The confirmation step uses a destructive action pattern:

- Primary CTA: "Xác nhận hủy vé" -- styled as destructive (red background, white text).
- Secondary CTA: "Quay lại" -- styled as outline/ghost.
- The destructive CTA requires a deliberate tap/click (no accidental activation via swipe or double-tap).
- On mobile, the destructive CTA is positioned on the right (Vietnamese reading direction, natural thumb zone for right-handed users).

### 3.4 Post-Cancellation Confirmation

After successful cancellation (`POST /api/bookings/{id}/cancel` returns 200):

```
+----------------------------------------------------------+
|  ✓ Đã hủy đặt vé thành công                             |
|                                                          |
|  Mã đặt vé: BB-2026-a1b2-c3d4                          |
|  Hoàn lại: 450.000 đ                                    |
|  Phương thức: MoMo                                       |
|  Trạng thái: Đang xử lý hoàn tiền                       |
|                                                          |
|  [ Theo dõi hoàn tiền ]     [ Về trang chủ ]            |
+----------------------------------------------------------+
```

### 3.5 Idempotent Cancel (Already Cancelled)

If the API returns `alreadyCancelled: true`, the UI displays:

```
Đặt vé này đã được hủy trước đó.
```

No error state; the booking detail page refreshes to show `cancelled` status.

---

## 4. Refund Status Tracking

### 4.1 Refund Timeline UI

Displayed on the booking detail page when a refund exists for the booking. Uses a vertical timeline (stepper) pattern:

```
Theo dõi hoàn tiền
─────────────────────────────

  ● Yêu cầu hoàn tiền           15/06/2026 10:30
  │
  ● Đang xử lý                  15/06/2026 10:35
  │
  ○ Hoàn tiền thành công         (đang chờ)
```

### 4.2 Timeline States

| Refund Status | Vietnamese Label | Icon | Description |
|---------------|-----------------|------|-------------|
| `refund_requested` | Yêu cầu hoàn tiền | Filled circle (green) | Request registered |
| `processing` | Đang xử lý | Filled circle (blue) | PSP refund submitted |
| `completed` | Hoàn tiền thành công | Filled circle (green) with checkmark | Refund confirmed by PSP |
| `failed` | Hoàn tiền thất bại | Filled circle (red) with warning | PSP returned error; retry pending |
| `permanently_failed` | Hoàn tiền thất bại | Filled circle (red) with X | Max retries exceeded; contact support |

### 4.3 Refund Method Display

Below the timeline, show the refund destination:

| Payment Adapter | Display Text |
|----------------|-------------|
| `momo` | Hoàn tiền qua MoMo |
| `vnpay` | Hoàn tiền qua VNPay |
| `bank_transfer` | Hoàn tiền qua chuyển khoản ngân hàng |

### 4.4 Failed Refund State

When refund status is `failed` or `permanently_failed`:

```
+----------------------------------------------------------+
|  ⚠ Hoàn tiền thất bại                                   |
|                                                          |
|  Chúng tôi không thể hoàn tiền tự động.                 |
|  Vui lòng liên hệ hỗ trợ:                              |
|                                                          |
|  Zalo OA: [link]                                         |
|  Email: support@busbooking.vn                            |
|  Hotline: 1900-xxxx                                      |
|                                                          |
|  Mã đặt vé: BB-2026-a1b2-c3d4                          |
|  Số tiền: 450.000 đ                                     |
+----------------------------------------------------------+
```

### 4.5 Refund Amount Display

| Refund Type | Display |
|-------------|---------|
| Full refund (fee = 0%) | "Hoàn tiền toàn bộ: {amount} đ" |
| Partial refund (fee > 0%) | "Hoàn lại: {refundAmount} đ (sau khi trừ phí hủy {fee} đ)" |

---

## 5. Trip-Cancelled Auto-Refund

When an operator cancels a trip (trigger T2), all affected bookings receive an automatic full refund. The customer sees:

### 5.1 Push Notification (SMS)

```
Chuyến xe [route] ngày [date] đã bị hủy bởi nhà xe.
Hoàn tiền tự động 100%: [amount] đ qua [adapter].
Mã vé: [bookingRef]
```

### 5.2 Booking Detail Page Banner

```
+----------------------------------------------------------+
|  Chuyến xe đã bị hủy bởi nhà xe                         |
|                                                          |
|  Hoàn tiền tự động đang được xử lý.                     |
|  Bạn không cần thực hiện thao tác nào.                   |
|                                                          |
|  Số tiền hoàn: 500.000 đ                                |
|  Phương thức: MoMo                                       |
|  Trạng thái: Đang xử lý                                 |
+----------------------------------------------------------+
```

Key UI difference from customer-initiated cancel: no cancellation fee, no confirmation dialog, and a clear message that the refund is automatic and requires no customer action.

---

## 6. Currency Formatting

All monetary values follow Vietnamese conventions:

| Rule | Example |
|------|---------|
| Currency symbol | `đ` (lowercase, postfix, space-separated) |
| Thousands separator | Dấu chấm (period): `500.000 đ` |
| No decimal places | VND is integer-only (no cents/xu) |
| Negative amounts (fees) | Prefix minus: `-50.000 đ` |

---

## 7. Error States

| Error Code | HTTP | Vietnamese Message |
|------------|------|--------------------|
| `booking_not_found` | 404 | Không tìm thấy đặt vé |
| `booking_not_cancellable` | 422 | Đặt vé không thể hủy ở trạng thái hiện tại |
| `cancellation_window_expired` | 422 | Đã hết thời hạn hủy vé. Vui lòng liên hệ hỗ trợ |
| `trip_already_departed` | 422 | Chuyến xe đã khởi hành, không thể hủy |
| Network error | -- | Không thể kết nối. Vui lòng thử lại |

---

## 8. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Destructive CTA contrast | Red background meets WCAG AA contrast ratio (4.5:1 minimum) against white text |
| Timeline screen reader | Each step announces state + timestamp; pending steps announce "đang chờ" |
| Fee breakdown | Table uses `<th>` headers; amounts use `aria-label` with full Vietnamese text |
| Countdown | `aria-live="polite"` region updates every minute; does not auto-announce more frequently |

---

## 9. Responsive Behavior

| Viewport | Cancellation Dialog | Timeline |
|----------|-------------------|----------|
| Mobile (< 768px) | Bottom sheet, full-width CTAs | Vertical stepper, left-aligned |
| Tablet (768--1024px) | Centered modal, 480px max-width | Vertical stepper |
| Desktop (> 1024px) | Centered modal, 520px max-width | Vertical stepper, inline in booking detail card |

---

## 10. Cross-References

| Document | Relevance |
|----------|-----------|
| DS-007 (Refund Flow) | Refund state machine, PSP adapter interface, retry logic, ledger integration |
| ADR-010 (Booking Lifecycle) | Booking status state machine, cancellation model (D9), discriminated result pattern |
| ADR-005 (Payment Architecture) | PSP adapters (MoMo, VNPay, bank transfer), refund API integration |
| ADR-006 (Pricing/Currency) | VND integer arithmetic, BigInt computation for fee calculation |
| ADR-019 (State Machines) | Legal transition enforcement for refund status |
| Consumer Protection Law 2023 Art. 29 | 3-business-day cancellation right for remote contracts |
| DS-014 (Complaint & Support) | Escalation path when refund fails permanently |
