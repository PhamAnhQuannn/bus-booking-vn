# DS-034 Booking Lifecycle & Status UI

Frontend UX specification for booking status badges, My Bookings page, booking detail view, cancellation flow, re-booking shortcut, and ticket re-download.

---

## 1. Booking Status Badge Design

### 1.1 Status Badge Table

| Status | Vietnamese Label | Color | Icon | Available Actions |
|--------|-----------------|-------|------|-------------------|
| `awaiting_payment` | "Cho thanh toan" | Amber | Clock | "Thanh toan" (Pay now), "Huy" (Cancel) |
| `paid` | "Da xac nhan" | Green | Checkmark | "Xem ve" (View ticket), "Huy ve" (Cancel ticket) |
| `completed` | "Hoan thanh" | Blue | Flag | "Xem ve" (View ticket), "Dat lai" (Re-book) |
| `cancelled` | "Da huy" | Grey | X circle | "Dat lai" (Re-book) |
| `trip_cancelled` | "Chuyen bi huy" | Red | Alert triangle | "Tim chuyen khac" (Find another trip), "Dat lai" (Re-book) |
| `no_show` | "Khong co mat" | Grey/dark | Eye-off | "Dat lai" (Re-book) |
| `payment_failed_expired` | "Thanh toan that bai" | Red | X circle | "Dat lai" (Re-book) |
| `refunded` | "Da hoan tien" | Purple | Arrow-left | "Dat lai" (Re-book) |

### 1.2 Badge Component

| Property | Specification |
|----------|---------------|
| Component | `BookingStatusBadge` |
| Rendering | Pill shape with icon + label |
| Size | `px-3 py-1 text-sm font-medium rounded-full` |
| Icon size | 16x16px, inline before label |
| Contrast | WCAG AA on all background/text combinations |

### 1.3 Status Mapping to State Machine

All status values correspond to `LEGAL_BOOKING_TRANSITIONS` map entries (ADR-019). The badge component reads the `status` field from `BookingDto` and maps it through a lookup table. No client-side status derivation occurs -- the server is the single source of truth for booking status.

---

## 2. My Bookings Page

### 2.1 Route

`/bookings` -- requires authenticated customer session.

### 2.2 Tab Structure

| Tab | Vietnamese Label | Filter | Sort |
|-----|-----------------|--------|------|
| Upcoming | "Sap toi" | `status IN ('paid', 'awaiting_payment') AND trip.departureAt > NOW()` | `departureAt ASC` |
| Past | "Da di" | `status IN ('completed', 'no_show')` | `departureAt DESC` |
| Cancelled | "Da huy" | `status IN ('cancelled', 'trip_cancelled', 'payment_failed_expired', 'refunded')` | `updatedAt DESC` |

### 2.3 Booking List Card

```
+----------------------------------------------------------+
|  [StatusBadge: Da xac nhan]        BB-2026-a1b2-c3d4     |
|                                                          |
|  Ho Chi Minh -> Da Lat                                   |
|  Thu Bay, 01/02/2026  |  06:30                           |
|  Nha xe: Phuong Trang  |  2 ve                           |
|  700.000 d                                               |
|                                                          |
|  [Xem chi tiet ->]                                       |
+----------------------------------------------------------+
```

### 2.4 List Card Elements

| Element | Source | Display |
|---------|--------|---------|
| Status badge | `Booking.status` | Badge component (see section 1) |
| Booking ref | `Booking.bookingRef` | `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` format |
| Route | `Trip.route.fromPlace.name -> Trip.route.toPlace.name` | Vietnamese with diacritics |
| Date | `Trip.departureAt` | "Thu Bay, 01/02/2026" (Vietnamese day of week) |
| Time | `Trip.departureAt` | `HH:mm` in `Asia/Ho_Chi_Minh` |
| Operator | `Trip.route.operator.brandName` | Brand name |
| Ticket count | `Booking.ticketCount` | "{n} ve" |
| Total price | `Booking.totalPrice` | VND formatted: "700.000 d" |
| Detail link | "Xem chi tiet" | Navigates to booking detail page |

### 2.5 Empty States

| Tab | Heading | Subtext | CTA |
|-----|---------|---------|-----|
| Upcoming | "Chua co chuyen di nao sap toi" | "Tim va dat ve ngay!" | "Tim chuyen xe" -> search page |
| Past | "Chua co chuyen di nao" | "Chuyen di hoan thanh se hien thi o day." | None |
| Cancelled | "Khong co ve nao bi huy" | -- | None |

---

## 3. Booking Detail Page

### 3.1 Route

`/bookings/[bookingRef]` -- requires authenticated customer who owns the booking.

### 3.2 Page Layout

```
+----------------------------------------------------------+
|  <- Quay lai                                             |
|                                                          |
|  [StatusBadge: Da xac nhan]                              |
|  Ma dat ve: BB-2026-a1b2-c3d4                            |
|                                                          |
|  THONG TIN CHUYEN XE                                     |
|  +------------------------------------------------------+|
|  | Nha xe: Phuong Trang (FUTA)                          ||
|  | Lien he nha xe: 1900 6067                            ||
|  | Tuyen: Ho Chi Minh -> Da Lat                         ||
|  | Ngay: Thu Bay, 01/02/2026                             ||
|  | Gio khoi hanh: 06:30                                  ||
|  | Loai xe: Limousine                                    ||
|  | Diem don: Ben xe Mien Dong                            ||
|  | Huong dan don: Cong so 3, quay ve so 12              ||
|  +------------------------------------------------------+|
|                                                          |
|  THONG TIN HANH KHACH                                    |
|  +------------------------------------------------------+|
|  | Ho ten: Nguyen Van A                                  ||
|  | So dien thoai: ****1234                               ||
|  | So luong ve: 2                                        ||
|  +------------------------------------------------------+|
|                                                          |
|  THANH TOAN                                              |
|  +------------------------------------------------------+|
|  | 2 x 350.000 d = 700.000 d                            ||
|  | Phuong thuc: Vi MoMo                                 ||
|  | Trang thai: Da thanh toan                             ||
|  +------------------------------------------------------+|
|                                                          |
|  [QR Code]                                               |
|                                                          |
|  [Tai ve PDF]  [Huy ve]  [Dat lai]                       |
|                                                          |
|  HOA DON                                                 |
|  [Tai hoa don] (khi co)                                  |
|                                                          |
+----------------------------------------------------------+
```

### 3.3 Detail Elements

| Section | Elements |
|---------|----------|
| Header | Status badge, booking reference |
| Trip info | Operator (name, contact phone), route, date, time, bus type, pickup point, pickup instructions |
| Passenger info | Name, masked phone (`****1234`), ticket count |
| Payment | Line item breakdown, payment method, payment status |
| QR code | Same as confirmation page QR -- links to token-gated confirmation URL |
| Actions | Context-dependent action buttons (see section 1.1) |
| E-invoice | "Tai hoa don" link when available (see FD-016 section 4) |

### 3.4 Phone Masking

| Context | Display | Rationale |
|---------|---------|-----------|
| Booking detail (own booking) | `****1234` | I9 invariant: minimize PII exposure in UI |
| Booking detail (shared) | N/A -- detail page requires auth | Only owner can view |

---

## 4. Cancellation Flow

### 4.1 Cancellation Eligibility

| Booking Status | Cancellable | Condition |
|----------------|-------------|-----------|
| `awaiting_payment` (cash) | Yes | Any time before departure |
| `paid` | Yes | Subject to cancellation policy |
| `completed` | No | Trip already finished |
| `cancelled` | No | Already cancelled (idempotent return) |
| `trip_cancelled` | No | Operator-initiated, handled separately |

### 4.2 Cancellation Confirmation Modal

```
+--------------------------------------------------+
|                                                  |
|  Xac nhan huy ve                                 |
|                                                  |
|  Ban co chac muon huy ve nay?                    |
|                                                  |
|  Ma dat ve: BB-2026-a1b2-c3d4                    |
|  Tuyen: Ho Chi Minh -> Da Lat                    |
|  Ngay: 01/02/2026, 06:30                         |
|                                                  |
|  Chinh sach huy ve:                              |
|  {cancellation policy text}                      |
|                                                  |
|  [Giu ve]              [Xac nhan huy]            |
|                                                  |
+--------------------------------------------------+
```

### 4.3 Cancellation UX

| Element | Specification |
|---------|---------------|
| Trigger | "Huy ve" button on booking detail or list card |
| Confirmation | Modal with booking summary and cancellation policy |
| Primary CTA | "Xac nhan huy" (Confirm cancellation) -- destructive variant (red) |
| Secondary CTA | "Giu ve" (Keep ticket) -- default variant |
| Loading | "Dang xu ly huy ve..." (Processing cancellation...) |
| Success | Badge updates to "Da huy". Toast: "Ve da duoc huy thanh cong." |
| Idempotent | Second cancel returns HTTP 200 with `already_cancelled: true` (per ADR discriminated result pattern) -- UI shows "Ve nay da duoc huy truoc do." |

### 4.4 Consumer Protection Law 2023 -- 3-Day Cancellation Right

| Element | Detail |
|---------|--------|
| Right | CPL 2023 grants 3-day cooling-off period from electronic contract signing |
| UI | Within 3 days of booking: "Ban co quyen huy ve trong vong 3 ngay ke tu ngay dat ve theo Luat Bao ve Quyen loi Nguoi tieu dung 2023." displayed in cancellation modal |
| After 3 days | Standard cancellation policy applies |

### 4.5 Refund Display (Post-Cancellation)

| Payment method | Refund message |
|----------------|----------------|
| MoMo / VNPay | "Tien hoan se duoc chuyen ve tai khoan trong 5-7 ngay lam viec." |
| Bank transfer | "Tien hoan se duoc chuyen ve tai khoan ngan hang trong 5-7 ngay lam viec." |
| Cash (awaiting_payment) | No refund needed: "Dat cho da duoc huy. Khong phat sinh phi." |

---

## 5. Trip Cancellation by Operator

### 5.1 Notification

| Channel | Content |
|---------|---------|
| SMS | "[BusBooking] Chuyen xe {route} ngay {date} da bi huy boi nha xe. Xin loi vi su bat tien." |
| Email | Full details + refund timeline + "Dat chuyen khac" CTA |
| In-app | Booking badge changes to `trip_cancelled` on next page load |

### 5.2 Detail Page for Trip-Cancelled Booking

| Element | Display |
|---------|---------|
| Badge | Red "Chuyen bi huy" |
| Explanation | "Nha xe da huy chuyen nay. Ban se duoc hoan tien day du." |
| Refund status | "Dang xu ly hoan tien" or "Da hoan tien" based on booking status |
| Actions | "Tim chuyen khac" (search with same route pre-filled), "Dat lai" |

---

## 6. Re-Book Shortcut

### 6.1 Trigger

"Dat lai" (Re-book) button visible on completed, cancelled, trip_cancelled, no_show, payment_failed_expired, and refunded bookings.

### 6.2 Behavior

| Step | Detail |
|------|--------|
| 1 | Extract route (origin + destination) from the booking |
| 2 | Navigate to search page: `/tuyen/{origin-slug}/{destination-slug}/{next-available-date}` |
| 3 | Date defaults to next available departure date (VN timezone today or tomorrow if today has no departures) |
| 4 | Ticket count pre-filled from original booking |
| 5 | Search auto-executes on page load |

### 6.3 Vietnamese Labels

| Context | Label |
|---------|-------|
| Button | "Dat lai" |
| Tooltip | "Tim chuyen xe cung tuyen" (Find trip on same route) |

---

## 7. Ticket Download & Re-Download

### 7.1 PDF Ticket

| Property | Specification |
|----------|---------------|
| Generation | Async via cron after booking confirmed |
| Storage | Blob storage, keyed by `Booking.ticketPdfKey` |
| Content | Booking ref, QR code, trip details, passenger info, operator info |
| Format | A5 landscape, optimized for mobile viewing and printing |

### 7.2 Download CTA

| Booking status | CTA visible | Label |
|----------------|-------------|-------|
| `paid` | Yes (when `ticketPdfKey` set) | "Tai ve PDF" |
| `completed` | Yes | "Tai ve PDF" |
| `awaiting_payment` | No | -- |
| `cancelled` | No | -- |
| `trip_cancelled` | No | -- |

### 7.3 Zalo Share

| Element | Specification |
|---------|---------------|
| CTA | "Chia se qua Zalo" |
| Content | Confirmation page URL (token-gated, no auth required for recipient) |
| Implementation | Zalo SDK share button or URL scheme |
| Fallback | Copy link to clipboard: "Sao chep lien ket" |

---

## 8. Real-Time Status Updates

### 8.1 Status Change Detection

| Method | Detail |
|--------|--------|
| Page load | Fresh booking data fetched on every page visit (RSC server render) |
| No WebSocket | Status changes are low-frequency; polling on page load is sufficient |
| Notification-driven | SMS/email notifies customer of status changes; customer revisits page |

### 8.2 Status Transition Animations

| Transition | Animation |
|------------|-----------|
| Any status change | Badge color cross-fade (CSS `transition: background-color 300ms`) |
| Cancelled | Slight shake animation on badge (`motion-safe:` guarded) |
| No animation library | CSS-only transitions per FD-005 guidelines |

---

## 9. Accessibility

| Concern | Implementation |
|---------|----------------|
| Status badge | `aria-label="Trang thai dat ve: {status Vietnamese label}"` |
| Tab navigation | `role="tablist"`, `role="tab"`, `role="tabpanel"` on My Bookings tabs |
| Booking card | `role="article"`, `aria-label="{route} - {date} - {status}"` |
| Cancel confirmation | Modal with `role="alertdialog"`, `aria-describedby` linking to policy text |
| QR code | `alt="Ma QR dat ve {bookingRef}"` |
| PDF download | `aria-label="Tai ve PDF ve xe"` |
| Focus management | Focus trapped in cancel modal; returns to trigger button on close |

---

## 10. Guest Booking Access

### 10.1 Guest Without Account

| Scenario | Access method |
|----------|---------------|
| View booking | Via confirmation URL from SMS/email (token-gated, no auth) |
| Cancel booking | Via confirmation page cancel action (token-gated) |
| My Bookings list | Not available -- requires registration |
| Post-registration | All guest bookings linked via `attachGuestBookingByPhone` appear in My Bookings |

### 10.2 Registration Prompt

| Location | Message |
|----------|---------|
| Confirmation page | "Dang ky tai khoan de xem lai tat ca cac ve da dat" |
| After 2nd guest booking | "Ban da dat 2 ve. Tao tai khoan de quan ly tat ca ve o mot noi." |
| CTA | "Tao tai khoan" -> `/login` with `returnUrl` |

---

## Cross-References

| Document | Relevance |
|----------|-----------|
| [ADR-010 Booking Lifecycle](../../architecture-decisions/ADR-010-booking-lifecycle/) | 8 booking states, state machine transitions, idempotent cancel, guest booking |
| [ADR-019 State Machines](../../architecture-decisions/ADR-019-state-machines/) | `LEGAL_BOOKING_TRANSITIONS`, discriminated result pattern, `SELECT FOR UPDATE` in `$transaction` |
| [Business: State Machines](../../business/domain-model/state-machines.md) | Full transition table with guards and side effects |
| [FD-016 Booking Confirmation](../FD-016-booking-confirmation/) | Confirmation page, QR code, token-based access, notification triggers |
| [FD-005 Motion & Interaction](../FD-005-motion-interaction/) | CSS-only animations, `motion-safe:` guard |
| [FD-012 Authentication](../FD-012-authentication/) | Guest booking path, `attachGuestBookingByPhone`, session handling |
| [Business: Consumer Protection](../../business/regulatory/consumer-protection.md) | 3-day cancellation right, complaint handling SLA |
| [Business: Ubiquitous Language](../../business/domain-model/ubiquitous-language.md) | Booking, Hold, Trip definitions |
