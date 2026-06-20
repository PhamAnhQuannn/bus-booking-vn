# DS-037 -- FD-020: Complaint Submission & Tracking

## 1. Overview

Customer complaint submission and status tracking UI for the BusBooking platform, implementing the mandatory complaint handling requirements of Consumer Protection Law 2023 (No. 19/2023/QH15). The law requires an accessible complaint channel, written acknowledgement within 3 business days, and resolution within 7--30 days depending on complexity. This is a legal launch gate.

**Scope**: Customer-facing complaint submission form, status tracking page, response thread display, and footer support channel links. Operator and admin complaint management interfaces are out of scope.

---

## 2. Complaint Entry Points

Complaints can be initiated from three locations:

| Entry Point | URL | Pre-filled Data | Context |
|-------------|-----|-----------------|---------|
| Booking detail page | `/booking/confirmation/[token]` (button) | `bookingId`, `operatorId` (derived), customer phone | Post-trip or active booking issue |
| Footer link | All pages footer: "Khiếu nại" | None | General complaint channel |
| Booking confirmation page | Post-payment confirmation | `bookingId`, `operatorId`, customer phone | Immediate post-booking issue |

### 2.1 Booking Detail Entry

A secondary link or button appears below the booking details:

```
Bạn gặp vấn đề với chuyến đi này?  [ Gửi khiếu nại ]
```

Clicking opens the complaint form with `bookingId` pre-filled and booking details displayed (route, date, operator name).

### 2.2 Footer Entry

The footer "Khiếu nại" link navigates to `/complaint/new` without pre-filled data. The customer manually enters booking reference (optional) and contact details.

---

## 3. Complaint Form

### 3.1 Layout

```
+----------------------------------------------------------+
|  Gửi khiếu nại                                          |
|                                                          |
|  Danh mục: *                                             |
|  ┌────────────────────────────────────┐                  |
|  │  ▾ Chọn danh mục                  │                  |
|  └────────────────────────────────────┘                  |
|                                                          |
|  Mã đặt vé (nếu có):                                    |
|  [BB-2026-a1b2-c3d4_____________]     (pre-filled or     |
|                                        manual entry)     |
|                                                          |
|  Tiêu đề: *                                             |
|  [________________________________]   (tối đa 200 ký tự)|
|                                                          |
|  Mô tả chi tiết: *                                      |
|  ┌────────────────────────────────────┐                  |
|  │                                    │                  |
|  │                                    │   (tối đa 5.000  |
|  │                                    │    ký tự)        |
|  └────────────────────────────────────┘                  |
|                                                          |
|  Hình ảnh minh chứng (tùy chọn):                        |
|  ┌──────────┐                                            |
|  │  + Tải   │  Chấp nhận: JPG, PNG, PDF                 |
|  │   ảnh    │  Tối đa: 5 MB / ảnh, 3 ảnh               |
|  └──────────┘                                            |
|                                                          |
|  Thông tin liên hệ:                                     |
|  Số điện thoại: * [+84 901 234 567___]                  |
|  Email (tùy chọn): [________________]                    |
|                                                          |
|  [ Gửi khiếu nại ]                                      |
+----------------------------------------------------------+
```

### 3.2 Category Selector

7 complaint categories from DS-014:

| Category Enum | Vietnamese Label | Auto-Priority |
|--------------|-----------------|---------------|
| `booking_issue` | Vấn đề đặt vé | -- |
| `payment_issue` | Vấn đề thanh toán | -- |
| `refund_issue` | Vấn đề hoàn tiền | `high` (auto) |
| `service_quality` | Chất lượng dịch vụ | -- |
| `operator_conduct` | Thái độ nhà xe / tài xế | -- |
| `safety_concern` | Vấn đề an toàn | `urgent` (auto) |
| `other` | Khác | -- |

**Auto-priority note:** Selecting "Van de an toan" (safety concern) triggers an immediate admin notification and sets priority to `urgent`. The UI does not display priority to the customer.

### 3.3 Field Validation

| Field | Required | Validation | Error Message |
|-------|----------|------------|---------------|
| `category` | Yes | Must be valid enum | Vui lòng chọn danh mục |
| `bookingId` | No | If provided, must be valid booking ref format | Mã đặt vé không hợp lệ |
| `subject` | Yes | 1--200 characters | Tiêu đề phải từ 1 đến 200 ký tự |
| `description` | Yes | 1--5,000 characters | Mô tả phải từ 1 đến 5.000 ký tự |
| `customerPhone` | Yes (guest); auto-filled for logged-in | Vietnamese phone format (+84...) | Số điện thoại không hợp lệ |
| `customerEmail` | No | Valid email format | Email không hợp lệ |
| Evidence images | No | JPG/PNG/PDF, max 5 MB per file, max 3 files | Tệp quá lớn hoặc sai định dạng |

### 3.4 Guest Complaint

Guests (not logged in) must provide a phone number for tracking. The form shows an additional field:

```
Bạn chưa đăng nhập. Vui lòng nhập số điện thoại để theo dõi khiếu nại.
Số điện thoại: * [________________]
```

Guest complaint tracking uses the `refCode` + phone number combination for authentication.

---

## 4. Submission Confirmation

### 4.1 Success Screen

After successful submission (`POST /api/complaints` returns 201):

```
+----------------------------------------------------------+
|  ✓ Khiếu nại đã được gửi thành công                     |
|                                                          |
|  Mã khiếu nại: KN-2026-0042                             |
|                                                          |
|  Chúng tôi sẽ phản hồi trong 3 ngày làm việc.           |
|                                                          |
|  Bạn có thể theo dõi trạng thái tại:                    |
|  busbooking.vn/complaint/KN-2026-0042                    |
|                                                          |
|  [ Theo dõi khiếu nại ]     [ Về trang chủ ]            |
+----------------------------------------------------------+
```

### 4.2 Reference Code Format

Reference codes follow the pattern `KN-YYYY-NNNN` (mapped from the database `CPL-YYYY-NNNN` refCode format). "KN" = "Khiếu nại" for customer-facing display. The format is sequential per year, gap-free.

### 4.3 SMS Confirmation

The customer receives an SMS:

```
Khiếu nại của bạn (mã: KN-2026-0042) đã được tiếp nhận.
Chúng tôi sẽ phản hồi trong 3 ngày làm việc.
Theo dõi: busbooking.vn/complaint/KN-2026-0042
```

---

## 5. Status Tracking Page

### 5.1 Route

`/complaint/[ref]` -- accessible by reference code. Authentication: Customer JWT (if logged in, `customerId` must match) or phone verification (for guests).

### 5.2 Complaint Timeline

```
+----------------------------------------------------------+
|  Khiếu nại KN-2026-0042                                 |
|                                                          |
|  Danh mục: Vấn đề thanh toán                            |
|  Tiêu đề: Đã thanh toán nhưng chưa nhận vé             |
|  Mã đặt vé: BB-2026-a1b2-c3d4                          |
|                                                          |
|  Trạng thái                                              |
|  ─────────────────────────────────                       |
|                                                          |
|  ● Đã gửi                    15/06/2026 10:30           |
|  │                                                       |
|  ● Đã tiếp nhận              16/06/2026 09:15           |
|  │  "Khiếu nại đã được tiếp nhận và chuyển đến          |
|  │   bộ phận xử lý."                                    |
|  │                                                       |
|  ● Đang xử lý                17/06/2026 14:00           |
|  │                                                       |
|  ○ Đã giải quyết             (đang chờ)                 |
|                                                          |
|  Hạn giải quyết: 16/07/2026 (còn 27 ngày)              |
+----------------------------------------------------------+
```

### 5.3 Complaint States

| Status | Vietnamese Label | Icon | Timeline Meaning |
|--------|-----------------|------|-----------------|
| `submitted` | Đã gửi | Filled circle (gray) | Complaint registered, awaiting acknowledgement |
| `acknowledged` | Đã tiếp nhận | Filled circle (blue) | Platform confirmed receipt (within 3 business days) |
| `investigating` | Đang xử lý | Filled circle (blue, pulsing) | Under active investigation |
| `resolved` | Đã giải quyết | Filled circle (green) with checkmark | Resolution provided |
| `escalated` | Đã chuyển cấp cao hơn | Filled circle (amber) with arrow | SLA breached or customer-escalated |

### 5.4 SLA Deadline Display

| Context | Display |
|---------|---------|
| Awaiting acknowledgement | "Chúng tôi sẽ phản hồi trước DD/MM/YYYY" |
| Under investigation (simple, 7-day) | "Hạn giải quyết: DD/MM/YYYY (còn X ngày)" |
| Under investigation (complex, 30-day) | "Hạn giải quyết: DD/MM/YYYY (còn X ngày)" |
| SLA breached | "Quá hạn xử lý" with amber warning |

---

## 6. Response Thread

### 6.1 Display Rules

The complaint detail page shows a chronological thread of responses:

| Author Type | Display Name | Visibility |
|-------------|-------------|-----------|
| `admin` (non-internal) | Đội ngũ hỗ trợ BusBooking | Visible to customer |
| `operator` (non-internal) | Nhà xe [Operator Name] | Visible to customer |
| `customer` | Bạn | Visible to customer |
| `system` | Hệ thống | Visible to customer |
| Any `internal = true` | -- | NOT visible to customer |

### 6.2 Response Card Layout

```
┌──────────────────────────────────────────────────┐
│  Đội ngũ hỗ trợ BusBooking     16/06/2026 09:15 │
│                                                    │
│  Chúng tôi đã xác nhận thanh toán VietQR của bạn │
│  là 350.000 đ và cập nhật trạng thái đặt vé      │
│  sang đã thanh toán. Vé đã được gửi qua SMS.     │
│  Xin lỗi vì sự bất tiện.                         │
└──────────────────────────────────────────────────┘
```

### 6.3 Customer Reply

Customers can add messages to the thread from the tracking page:

```
+----------------------------------------------------------+
|  Phản hồi:                                               |
|  ┌────────────────────────────────────┐                  |
|  │                                    │                  |
|  └────────────────────────────────────┘                  |
|  [ Gửi phản hồi ]                                       |
+----------------------------------------------------------+
```

---

## 7. Escalation Notice

### 7.1 Auto-Escalation

If a complaint is not acknowledged within 3 business days, the system auto-acknowledges and auto-escalates. The customer sees:

```
+----------------------------------------------------------+
|  ⚠ Khiếu nại đã được tự động chuyển cấp cao hơn        |
|                                                          |
|  Khiếu nại của bạn chưa được giải quyết trong thời      |
|  hạn quy định. Đội ngũ quản lý đang ưu tiên xem xét.   |
|                                                          |
|  Nếu cần hỗ trợ thêm, bạn có quyền liên hệ:           |
|  • Cục Cạnh tranh và Bảo vệ người tiêu dùng (VCCA)     |
|  • Sở Công Thương tỉnh/thành phố                        |
+----------------------------------------------------------+
```

### 7.2 Customer-Initiated Escalation

Customers can request escalation after the complaint is in `investigating` state for more than 7 days:

```
Khiếu nại đã quá 7 ngày chưa được giải quyết.
[ Yêu cầu chuyển cấp cao hơn ]
```

---

## 8. Footer Support Channel (All Pages)

### 8.1 Required Channels

Law 19/2023 mandates accessible complaint mechanisms. The footer of all pages displays:

```
+----------------------------------------------------------+
|  Hỗ trợ khách hàng                                      |
|                                                          |
|  Zalo OA: [Zalo icon + link]                             |
|  Email: support@busbooking.vn                            |
|  Hotline: 1900-xxxx                                      |
|  Khiếu nại: busbooking.vn/complaint/new                 |
+----------------------------------------------------------+
```

### 8.2 Visibility

The support section appears in the footer on ALL pages:

- Public pages (search, home, about)
- Authenticated pages (account settings, booking history)
- Booking confirmation page
- Error pages (404, 500)

### 8.3 Zalo OA Link

The Zalo OA link opens the platform's Zalo Official Account chat. Format:

```
https://zalo.me/[ZaloOA_ID]
```

This is the Stage 0 minimum viable support channel per DS-014. Zalo is the primary support channel expected by Vietnamese customers.

---

## 9. Pre-Filled Email Link

For the email complaint path, the booking detail page generates a pre-filled `mailto` link:

```
mailto:support@busbooking.vn
  ?subject=Khi%E1%BA%BFu%20n%E1%BA%A1i%20-%20M%C3%A3%20v%C3%A9%20BB-2026-a1b2-c3d4
  &body=M%C3%A3%20%C4%91%E1%BA%B7t%20v%C3%A9%3A%20BB-2026-a1b2-c3d4%0A%0AVui%20l%C3%B2ng%20m%C3%B4%20t%E1%BA%A3%20v%E1%BA%A5n%20%C4%91%E1%BB%81%3A%0A
```

Decoded:
- Subject: "Khiếu nại - Mã vé BB-2026-a1b2-c3d4"
- Body: "Mã đặt vé: BB-2026-a1b2-c3d4\n\nVui lòng mô tả vấn đề:\n"

---

## 10. Error States

| Error Code | HTTP | Vietnamese Message |
|------------|------|--------------------|
| `complaint_not_found` | 404 | Không tìm thấy khiếu nại |
| `complaint_not_owned` | 403 | Bạn không có quyền xem khiếu nại này |
| `booking_not_found` | 422 | Mã đặt vé không tồn tại |
| `subject_too_long` | 422 | Tiêu đề quá dài (tối đa 200 ký tự) |
| `description_too_long` | 422 | Mô tả quá dài (tối đa 5.000 ký tự) |
| Network error | -- | Không thể kết nối. Vui lòng thử lại |

---

## 11. Responsive Behavior

| Viewport | Form Layout | Timeline |
|----------|-------------|----------|
| Mobile (< 768px) | Full-width, single column, bottom-positioned CTA | Vertical stepper, compact |
| Tablet (768--1024px) | Centered, max 640px width | Vertical stepper |
| Desktop (> 1024px) | Two-column: complaint detail left, timeline right | Vertical stepper, side panel |

---

## 12. Cross-References

| Document | Relevance |
|----------|-----------|
| DS-014 (Complaint & Support API) | Complaint data model, state machine, SLA deadlines, cron monitoring, notification templates |
| Consumer Protection Law 2023 (No. 19/2023/QH15) | Art. 37--39: complaint channel mandate, 3-day acknowledge, 7--30-day resolve |
| ADR-010 (Booking Lifecycle) | Booking status state machine, booking-to-complaint linkage |
| ADR-013 (Notification Architecture) | SMS notification templates for complaint lifecycle |
| ADR-015 (Error Contract) | Error envelope format for complaint API errors |
| DS-007 (Refund Flow) | Complaint-to-refund flow when resolution includes a refund |
