# DS-033 Post-Payment & Booking Confirmation

Frontend UX specification for payment status polling, success confirmation, failure landing, token-based page access, and notification triggers.

---

## 1. Payment Status Polling

### 1.1 Trigger

After returning from a PSP redirect (MoMo app, VNPay portal), the browser lands on `/booking/result/[confirmationToken]`. The page polls the booking status to determine whether payment succeeded.

### 1.2 Polling Strategy

| Phase | Interval | Duration | Behavior |
|-------|----------|----------|----------|
| Initial | 2 seconds | 0-30s | Fast polling for typical PSP confirmation latency |
| Backoff | Exponential (4s, 8s, 16s) | 30-60s | Reduce server load if webhook is delayed |
| Timeout | Stop polling | After 60s | Show processing message with support contact |

### 1.3 Polling UI States

| State | Display |
|-------|---------|
| Polling active | Spinner + "Dang kiem tra thanh toan..." (Checking payment...) |
| Status: `paid` | Redirect to `/booking/confirmation/[confirmationToken]` |
| Status: `payment_failed_expired` | Show failure page (section 4) |
| Status: `awaiting_payment` (still) | Continue polling until timeout |
| Timeout (no status change in 60s) | "Dang xu ly, vui long cho. He thong se tu dong cap nhat." with support contact |

### 1.4 Timeout Display

```
+----------------------------------------------------------+
|                                                          |
|  [Spinner]                                               |
|                                                          |
|  Dang xu ly thanh toan                                   |
|                                                          |
|  Thanh toan cua ban dang duoc xu ly.                     |
|  Vui long khong dong trang nay.                          |
|                                                          |
|  Neu da thanh toan thanh cong, he thong se tu dong       |
|  cap nhat trong vai phut.                                |
|                                                          |
|  Can ho tro? Lien he:                                    |
|  Zalo OA: [link]  |  Email: support@busbooking.vn        |
|                                                          |
+----------------------------------------------------------+
```

---

## 2. Success Confirmation Page

### 2.1 Route

`/booking/confirmation/[confirmationToken]`

### 2.2 Page Layout

```
+----------------------------------------------------------+
|                                                          |
|  [Green checkmark - large]                               |
|                                                          |
|  Dat ve thanh cong!                                      |
|                                                          |
|  MA DAT VE                                               |
|  +------------------------------------------------------+|
|  |         BB-2026-a1b2-c3d4                            ||
|  |         [QR Code]                                     ||
|  +------------------------------------------------------+|
|                                                          |
|  THONG TIN CHUYEN XE                                     |
|  +------------------------------------------------------+|
|  | Nha xe: Phuong Trang (FUTA)                          ||
|  | Lien he nha xe: 1900 6067                            ||
|  | Tuyen: Ho Chi Minh -> Da Lat                         ||
|  | Ngay: Thu Bay, 01/02/2026                             ||
|  | Gio khoi hanh: 06:30                                  ||
|  | Diem don: Ben xe Mien Dong                            ||
|  | Huong dan don: Cong so 3, quay ve so 12              ||
|  | So luong ve: 2                                        ||
|  +------------------------------------------------------+|
|                                                          |
|  [Tai ve PDF]    [Chia se qua Zalo]                      |
|                                                          |
|  THONG TIN PHAP LY                                       |
|  +------------------------------------------------------+|
|  | Nha xe: Cong ty TNHH Phuong Trang                    ||
|  | MST: 0301234567                                       ||
|  | Giay phep tuyen: GP-12345/SGTVT                      ||
|  | Dieu khoan huy ve: [link]                             ||
|  | Lien he nen tang: support@busbooking.vn               ||
|  +------------------------------------------------------+|
|                                                          |
|  HOA DON                                                 |
|  [Tai hoa don] (khi co)                                  |
|                                                          |
+----------------------------------------------------------+
```

### 2.3 Confirmation Elements

| Element | Source | Display |
|---------|--------|---------|
| Booking reference | `Booking.bookingRef` | `BB-YYYY-[0-9a-z]{4}-[0-9a-z]{4}` format (base36 lowercase) |
| QR code | Generated from `confirmationToken` URL | Scannable QR linking to this confirmation page |
| Operator name | `Trip.route.operator.brandName` | Full brand name |
| Operator contact | `Operator.contactPhone` | Displayed phone number for customer to call |
| Route | `Route.fromPlace.name -> Route.toPlace.name` | Vietnamese with diacritics |
| Date | `Trip.departureAt` | Formatted: "Thu Bay, 01/02/2026" (Vietnamese day of week) |
| Departure time | `Trip.departureAt` | `HH:mm` in `Asia/Ho_Chi_Minh` |
| Pickup point | From hold data | Station name, pickup area, or custom address |
| Pickup instructions | `OperatorPickupArea.instructions` or custom | Free-text directions |
| Ticket count | `Booking.ticketCount` | "2 ve" |
| Ticket PDF download | `Booking.ticketPdfKey` | CTA: "Tai ve PDF" -- available when PDF generated (async cron) |

### 2.4 QR Code for Boarding

| Property | Specification |
|----------|---------------|
| Content | URL: `https://busbooking.vn/booking/confirmation/{confirmationToken}` |
| Size | 200x200px |
| Error correction | Level M (medium) |
| Purpose | Operator scans at boarding for check-in verification |
| Fallback | Booking reference displayed as text alongside QR |

---

## 3. Legal Content Requirements

### 3.1 E-Transactions Law 2023 Compliance

The confirmation page must include:

| Requirement | Content | Source |
|-------------|---------|--------|
| Operator identity | Full legal name, MST (tax code) | Art. 37-39, CPL 2023 |
| Route authorization | Transport license reference (when available) | Transport regulations |
| Cancellation terms | Link to cancellation/refund policy | CPL 2023 Art. 29 |
| Platform contact | Email and Zalo OA link for complaints | CPL 2023 complaint handling |
| Departure details | Route, date, time, pickup point | E-Transactions Law 2023 |
| Price | Total paid amount in VND | E-Transactions Law 2023 |

### 3.2 Legal Content Section

| Label (Vietnamese) | Content |
|---------------------|---------|
| "Nha xe" | Operator legal entity name |
| "MST" | Operator tax identification number (10 or 13 digits) |
| "Giay phep tuyen" | Route authorization reference (if available) |
| "Dieu khoan huy ve" | Link to cancellation policy page |
| "Lien he nen tang" | Platform email + Zalo OA link |

---

## 4. E-Invoice Link

### 4.1 Invoice Availability

| State | Display |
|-------|---------|
| EInvoice `status = 'pending'` | Hidden -- invoice not yet issued |
| EInvoice `status = 'issued'` or `'sent'` | "Tai hoa don" (Download invoice) link |
| EInvoice `status = 'blocked'` | Hidden -- admin intervention needed |
| EInvoice `status = 'failed'` | Hidden -- retry in progress |
| No EInvoice row | "Hoa don dien tu dang duoc xu ly" (E-invoice being processed) |

### 4.2 Invoice Display

| Element | Specification |
|---------|---------------|
| CTA | "Tai hoa don" button/link |
| Format | PDF download or link to MISA meInvoice viewer |
| Vietnamese label | "Hoa don dien tu" with subtitle "Theo Thong tu 32/2025/TT-BTC" |
| Timing | Async issuance -- may not be available immediately. MISA submission via 5-min cron |

---

## 5. Failure Landing Page

### 5.1 Route

`/booking/result/[confirmationToken]` -- same route as polling page, renders failure when status is terminal-negative.

### 5.2 Failure Display

```
+----------------------------------------------------------+
|                                                          |
|  [Red X icon]                                            |
|                                                          |
|  Thanh toan khong thanh cong                             |
|                                                          |
|  {Friendly failure reason in Vietnamese}                 |
|                                                          |
|  +------------------------------------------------------+|
|  | [Thu lai]          [Chon phuong thuc khac]            ||
|  +------------------------------------------------------+|
|                                                          |
|  Neu can ho tro:                                         |
|  Zalo OA: [link]  |  Email: support@busbooking.vn        |
|                                                          |
+----------------------------------------------------------+
```

### 5.3 Failure Reasons

| PSP Code Category | Vietnamese Message |
|-------------------|--------------------|
| Insufficient balance | "So du tai khoan khong du. Vui long nap them hoac chon phuong thuc khac." |
| Transaction rejected | "Giao dich bi tu choi boi ngan hang. Vui long lien he ngan hang hoac thu lai." |
| User cancelled | "Ban da huy giao dich. Chon phuong thuc thanh toan de thu lai." |
| Timeout | "Giao dich het thoi gian xu ly. Vui long thu lai." |
| Generic failure | "Thanh toan khong thanh cong. Vui long thu lai hoac chon phuong thuc khac." |

### 5.4 Retry Options

| Condition | Available actions |
|-----------|-------------------|
| Hold still active (timer > 0) | "Thu lai" (retry same method) + "Chon phuong thuc khac" (pick different method) |
| Hold expired | "Tim chuyen khac" only (no retry possible) |
| Booking terminal (`payment_failed_expired`) | "Tim chuyen khac" only |

---

## 6. Token Page Independence

### 6.1 Design Principle

Both `/booking/result/[confirmationToken]` and `/booking/confirmation/[confirmationToken]` are **token-gated, stateless pages**:

| Property | Value |
|----------|-------|
| Auth required | No -- accessible via URL token alone |
| Zustand dependency | None -- no client store required |
| Session dependency | None -- works in incognito, shared links, different devices |
| Data source | Server-side lookup by `confirmationToken` from URL |
| Shareable | Customer can share confirmation URL with travel companion |

### 6.2 Token Security

| Concern | Implementation |
|---------|----------------|
| Token format | URL-safe random string (not the booking ref) |
| Guessability | Cryptographically random, not sequential |
| Expiry | No expiry -- confirmation page remains accessible indefinitely |
| Privacy | Page shows booking details; only those with the token can view |

---

## 7. SMS/Email Notification Triggers

### 7.1 Booking Confirmation Notifications

| Channel | Trigger | Content | Timing |
|---------|---------|---------|--------|
| SMS (eSMS) | Booking transitions to `paid` | Booking ref + route + departure time + confirmation URL | Within 60s (cron-dispatched) |
| Email (Resend) | Booking transitions to `paid` | Full booking details + QR code + ticket PDF link | Within 5 min |
| Zalo ZNS | Booking transitions to `paid` | Structured template with booking ref + action buttons | Within 60s (when ZNS integrated) |

### 7.2 SMS Content Template

```
[BusBooking] Dat ve thanh cong!
Ma dat ve: BB-2026-a1b2-c3d4
Tuyen: Ho Chi Minh -> Da Lat
Ngay: 01/02/2026, 06:30
Xem ve: https://busbooking.vn/t/[shortlink]
```

### 7.3 Email Content

| Section | Content |
|---------|---------|
| Subject | "Xac nhan dat ve - BB-2026-a1b2-c3d4" |
| Header | Green banner: "Dat ve thanh cong!" |
| Body | Full trip details, passenger info, pickup instructions |
| QR code | Embedded QR image linking to confirmation page |
| Ticket PDF | Attached or linked when available |
| Footer | Operator contact, platform support, cancellation policy link |

### 7.4 Notification Timing

| Event | Notification | Channel | SLA |
|-------|--------------|---------|-----|
| Payment confirmed | Booking confirmation | SMS + Email | 60s (SMS), 5 min (email) |
| Ticket PDF generated | PDF ready notification | Email | Async (cron-generated) |
| E-invoice issued | Invoice available | Email | Async (5-min MISA cron) |
| Trip cancelled by operator | Cancellation alert | SMS + Email | 60s (SMS) |

---

## 8. Cash Booking Confirmation

### 8.1 Distinct Confirmation for Cash

Cash bookings skip the polling phase and land directly on a modified confirmation page:

| Element | Difference from paid confirmation |
|---------|-----------------------------------|
| Status badge | Amber "Cho thanh toan" instead of green "Da xac nhan" |
| Heading | "Dat cho thanh cong!" (not "Dat ve thanh cong!") |
| Message | "Cho ngoi da duoc dat. Vui long thanh toan khi len xe." |
| Price section | "Can thanh toan: 700.000 d (khi len xe)" |
| QR code | Still generated for boarding reference |
| SMS content | "[BusBooking] Dat cho thanh cong! Thanh toan 700.000d khi len xe." |

---

## 9. Re-Visit Patterns

### 9.1 Customer Returns to Confirmation Page

| Scenario | Behavior |
|----------|----------|
| Direct URL visit | Page loads from server, displays current booking state |
| Link from SMS | Same as direct URL |
| Shared link (another person) | Works -- no auth required |
| Stale/deleted booking | 404 page: "Khong tim thay thong tin dat ve." |

### 9.2 Ticket Re-Download

| State | PDF available |
|-------|---------------|
| `paid` | Yes -- "Tai ve PDF" CTA visible when `ticketPdfKey` is set |
| `completed` | Yes |
| `awaiting_payment` (cash) | No PDF -- only booking reference |
| `cancelled` / `trip_cancelled` | No PDF -- status badge shows cancelled state |

---

## 10. Accessibility

| Concern | Implementation |
|---------|----------------|
| Polling state | `aria-live="polite"` on status message container |
| Success announcement | `role="alert"` on "Dat ve thanh cong!" heading |
| QR code | `alt="Ma QR dat ve BB-2026-a1b2-c3d4"` |
| PDF download | `aria-label="Tai ve PDF ve xe"` |
| Invoice link | `aria-label="Tai hoa don dien tu"` |
| Failure message | `role="alert"` on error heading |
| Support links | Visible focus indicators on Zalo OA and email links |

---

## Cross-References

| Document | Relevance |
|----------|-----------|
| [ADR-010 Booking Lifecycle](../../architecture-decisions/ADR-010-booking-lifecycle/) | Booking state machine, hold-then-book, guest booking, e-invoice timing |
| [ADR-013 Notification Architecture](../../architecture-decisions/ADR-013-notification-architecture/) | ZNS/SMS/email hierarchy, cron-only outbox, I9 PII invariant |
| [DS-012 Transport E-Invoice](../../design-specifications/DS-012-transport-einvoice/) | Transport-specific fields, MISA integration, Decree 70/2025 compliance |
| [DS-005 Webhook Design](../../design-specifications/DS-005-webhook-design/) | Payment processing pipeline, status transitions, notification enqueue |
| [FD-014 Hold Timer](../FD-014-hold-timer/) | Hold expiry during payment, timer persistence |
| [FD-015 Payment Checkout](../FD-015-payment-checkout/) | Pre-payment review, PSP flow initiation |
| [Business: State Machines](../../business/domain-model/state-machines.md) | Booking status transitions, EInvoice lifecycle |
