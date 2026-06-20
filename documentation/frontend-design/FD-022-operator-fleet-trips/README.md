# DS-039 -- FD-022: Operator Trip & Fleet Management

## 1. Overview

Core operator daily workflow UI for the BusBooking platform: bus fleet management, route configuration, trip scheduling (including recurring templates), and passenger manifest. These are the screens operators use every day -- simplicity and speed are paramount, especially for the "Bac Tam" micro-operator persona (very low tech literacy, phone-based).

**Target personas**: "Bac Tam" (1--5 buses, paper ledger background), "Cong Ty Xe Khach Tinh" (6--30 buses, basic POS), "Xe Limousine Cao Cap" (5--25 premium coaches, own website).

**Scope**: Operator console pages under `/op/`. Admin and customer-facing interfaces are out of scope.

---

## 2. Bus Management

### 2.1 Route

`/op/buses`

### 2.2 Bus List View

| Column | Source | Format |
|--------|--------|--------|
| Biển số xe | `Bus.licensePlate` | Plate format (e.g., `51B-123.45`) |
| Sức chứa | `Bus.capacity` | Integer + "chỗ" (e.g., "45 chỗ") |
| Loại xe | `Bus.busType` | Badge: Xe khách / Giường nằm / Limousine |
| Trạng thái | Derived from `deactivatedAt` | Badge: Hoạt động (green) / Ngưng (red) |
| Bảo trì | `BusMaintenance` windows | Next window date or "Không có" |

**Bus type badge mapping:**

| Enum | Vietnamese | Badge Color |
|------|-----------|-------------|
| `coach` | Xe khách | Gray |
| `sleeper` | Giường nằm | Blue |
| `limousine` | Limousine | Gold/amber |

### 2.3 Create / Edit Bus Form

```
+----------------------------------------------------------+
|  Thêm xe mới                                             |
|                                                          |
|  Biển số xe: * [51B-123.45___________]                  |
|  Sức chứa: * [45_] chỗ                                 |
|  Loại xe: * [▾ Xe khách / Giường nằm / Limousine]      |
|                                                          |
|  Lịch bảo trì (tùy chọn):                              |
|  ┌────────────────────────────────────────────────┐      |
|  │  Từ: [DD/MM/YYYY HH:MM]                       │      |
|  │  Đến: [DD/MM/YYYY HH:MM]                      │      |
|  │  Lý do: [________________]                     │      |
|  │                              [ + Thêm lịch ]  │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ Hủy ]                     [ Lưu ]                    |
+----------------------------------------------------------+
```

### 2.4 Capacity Reduction Guard

When editing a bus and reducing capacity below the current number of paid bookings on upcoming trips:

```
+----------------------------------------------------------+
|  ⚠ Không thể giảm sức chứa                              |
|                                                          |
|  12 hành khách đã đặt vé trên các chuyến sắp tới.       |
|  Sức chứa không thể giảm dưới 12 chỗ.                   |
+----------------------------------------------------------+
```

This is an inline warning (not a modal) displayed below the capacity field. The save button is disabled until the capacity is >= the booked count.

### 2.5 Deactivation Guard

When attempting to deactivate a bus that has upcoming assigned trips:

```
+----------------------------------------------------------+
|  ⚠ Không thể ngưng hoạt động                            |
|                                                          |
|  Xe 51B-123.45 có 3 chuyến xe sắp tới.                  |
|  Vui lòng hủy hoặc chuyển xe cho các chuyến trước       |
|  khi ngưng hoạt động.                                    |
+----------------------------------------------------------+
```

---

## 3. Route Management

### 3.1 Route

`/op/routes`

### 3.2 Route List View

| Column | Source | Format |
|--------|--------|--------|
| Tuyến | Route origin + destination | "Thanh Hóa → TP.HCM" |
| Thời gian | `Route.durationMinutes` | "X giờ Y phút" |
| Điểm đón | Count of `RoutePickupArea` | "3 điểm đón" |
| Trạng thái | Derived from `deactivatedAt` | Hoạt động / Ngưng |

### 3.3 Create / Edit Route Form

```
+----------------------------------------------------------+
|  Thêm tuyến mới                                         |
|                                                          |
|  Nơi đi: * [Thanh Hóa__________________] (combobox)    |
|  Nơi đến: * [TP. Hồ Chí Minh___________] (combobox)    |
|  Thời gian: * [18_] giờ [30_] phút                     |
|                                                          |
|  Điểm đón:                                              |
|  ┌────────────────────────────────────────────────┐      |
|  │  ✓ Bến xe Thanh Hóa (Bến xe)                  │      |
|  │  ✓ Ngã tư Vọng, Hà Nội (Đón tận nơi)        │      |
|  │                             [ + Thêm điểm ]   │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ Hủy ]                     [ Lưu ]                    |
+----------------------------------------------------------+
```

**Place combobox**: Supports Vietnamese diacritics search via `unaccent_immutable ILIKE`. Typing "Da Nang" or "Đà Nẵng" both match. The combobox shows `Place.name` with aliases.

---

## 4. Trip Management

### 4.1 Route

`/op/trips`

### 4.2 Trip List View

| Column | Source | Format |
|--------|--------|--------|
| Ngày | `Trip.departureAt` | DD/MM/YYYY |
| Tuyến | Route origin → destination | "Thanh Hóa → TP.HCM" |
| Xe | `Bus.licensePlate` | Plate number |
| Giờ đi | `Trip.departureAt` | HH:MM (Vietnam TZ) |
| Chỗ | Booked / capacity | "12/45" |
| Giá | `Trip.price` | "350.000 đ" |
| Trạng thái | `Trip.status` | Status badge |

**Status badge mapping:**

| Status | Vietnamese | Badge Color |
|--------|-----------|-------------|
| `scheduled` | Đã lên lịch | Blue |
| `departed` | Đã khởi hành | Green |
| `completed` | Hoàn thành | Gray |
| `cancelled` | Đã hủy | Red |

**Filters**: Date range picker, route selector, status filter, bus selector.

### 4.3 Create Trip Form

```
+----------------------------------------------------------+
|  Tạo chuyến xe mới                                      |
|                                                          |
|  Tuyến: * [▾ Chọn tuyến______________]                  |
|  Xe: * [▾ Chọn xe____________________]                  |
|  Ngày đi: * [DD/MM/YYYY]                                |
|  Giờ đi: * [HH:MM] (Giờ Việt Nam, UTC+7)               |
|  Giá vé: * [350.000] đ                                  |
|                                                          |
|  Điểm đón cho chuyến này:                               |
|  ┌────────────────────────────────────────────────┐      |
|  │  ☑ Bến xe Thanh Hóa                            │      |
|  │  ☑ Ngã tư Vọng, Hà Nội                        │      |
|  │  ☐ Bến xe Giáp Bát                             │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ Hủy ]                     [ Tạo chuyến ]             |
+----------------------------------------------------------+
```

**Price input**: VND integer, no decimals. Formatted with thousands separator on blur (`350000` displays as `350.000`). I7-exempt: operator IS the price authority for their own trips.

**Timezone**: The departure time picker explicitly labels "Giờ Việt Nam" (Vietnam Time, UTC+7). All trip times are stored and displayed in Asia/Ho_Chi_Minh timezone.

### 4.4 Trip Actions per State

| Status | Available Actions |
|--------|------------------|
| `scheduled` | Chỉnh sửa (Edit), Hủy chuyến (Cancel), Đánh dấu khởi hành (Mark Departed) |
| `departed` | Đánh dấu hoàn thành (Mark Completed), Xem bảng kê (View Manifest) |
| `completed` | Xem bảng kê (View Manifest), Xem đặt vé (View Bookings) |
| `cancelled` | Xem chi tiết (View, read-only) |

Actions are displayed as a dropdown menu (three-dot icon) on each trip row, or as buttons on the trip detail page.

### 4.5 Cancel Trip Confirmation

```
+----------------------------------------------------------+
|  ⚠ Hủy chuyến xe                                        |
|                                                          |
|  Tuyến: Thanh Hóa → TP.HCM                             |
|  Ngày: 25/06/2026 - 08:00                               |
|  Xe: 51B-123.45                                          |
|                                                          |
|  12 đặt vé đã thanh toán sẽ được hoàn tiền tự động.    |
|  3 đặt chỗ tạm sẽ được hủy.                            |
|                                                          |
|  Lý do hủy: *                                           |
|  [________________________________]                      |
|                                                          |
|  [ Quay lại ]          [ Xác nhận hủy chuyến ]          |
+----------------------------------------------------------+
```

The destructive CTA "Xac nhan huy chuyen" is styled in red. The count of affected bookings and holds is fetched from the server to give the operator a clear impact preview.

### 4.6 Paired Return Trip

From an existing outbound trip, operators can create a return trip:

```
+----------------------------------------------------------+
|  Tạo chuyến về từ chuyến đi                             |
|                                                          |
|  Chuyến đi: Thanh Hóa → TP.HCM (25/06 08:00)          |
|  Chuyến về: TP.HCM → Thanh Hóa                         |
|                                                          |
|  Ngày về: * [26/06/2026]                                |
|  Giờ về: * [14:00]                                      |
|  Xe: [51B-123.45] (cùng xe chuyến đi)                  |
|  Giá vé: * [350.000] đ                                  |
|                                                          |
|  [ Hủy ]                     [ Tạo chuyến về ]          |
+----------------------------------------------------------+
```

**Bus overlap check**: If the return departure time overlaps with the outbound trip (considering route duration + 60-minute buffer), a warning is displayed:

```
⚠ Xe 51B-123.45 có thể chưa hoàn thành chuyến đi (dự kiến
đến 26/06 02:30). Vui lòng điều chỉnh giờ về.
```

---

## 5. Trip Templates

### 5.1 Route

`/op/trip-templates`

### 5.2 Template List View

| Column | Source | Format |
|--------|--------|--------|
| Tuyến | Route origin → destination | "Thanh Hóa → TP.HCM" |
| Xe | `Bus.licensePlate` | Plate number |
| Giờ đi | `RecurringTripTemplate.departureLocalTime` | HH:MM |
| Ngày trong tuần | `daysOfMask` bitmask | Day badges |
| Giá | Price | "350.000 đ" |

**Day-of-week badges**: Mon--Sun displayed as Vietnamese abbreviations:

| Day | Vietnamese | Abbreviation |
|-----|-----------|-------------|
| Monday | Thứ Hai | T2 |
| Tuesday | Thứ Ba | T3 |
| Wednesday | Thứ Tư | T4 |
| Thursday | Thứ Năm | T5 |
| Friday | Thứ Sáu | T6 |
| Saturday | Thứ Bảy | T7 |
| Sunday | Chủ Nhật | CN |

Active days shown as filled badges; inactive days as outline/muted.

### 5.3 Create Template Form

```
+----------------------------------------------------------+
|  Tạo lịch chạy định kỳ                                  |
|                                                          |
|  Tuyến: * [▾ Chọn tuyến______________]                  |
|  Xe: * [▾ Chọn xe____________________]                  |
|  Giờ đi: * [08:00] (Giờ Việt Nam)                       |
|  Giá vé: * [350.000] đ                                  |
|                                                          |
|  Ngày trong tuần: *                                      |
|  ┌────────────────────────────────────────────────┐      |
|  │  ☑ T2  ☑ T3  ☑ T4  ☑ T5  ☑ T6  ☐ T7  ☐ CN │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ Hủy ]                     [ Tạo lịch ]               |
+----------------------------------------------------------+
```

### 5.4 14-Day Preview Calendar

After creating a template, a 14-day preview calendar shows generated trips:

```
+----------------------------------------------------------+
|  Xem trước 14 ngày tới                                   |
|                                                          |
|  T2 23/06  ● 08:00 Thanh Hóa → TP.HCM (51B-123.45)    |
|  T3 24/06  ● 08:00 Thanh Hóa → TP.HCM (51B-123.45)    |
|  T4 25/06  ● 08:00 Thanh Hóa → TP.HCM (51B-123.45)    |
|  T5 26/06  ⚠ 08:00 Thanh Hóa → TP.HCM (51B-123.45)   |
|             ↳ Trùng với bảo trì xe 51B-123.45           |
|  T6 27/06  ● 08:00 Thanh Hóa → TP.HCM (51B-123.45)    |
|  T7 28/06  — (không chạy)                               |
|  CN 29/06  — (không chạy)                               |
|  ...                                                     |
+----------------------------------------------------------+
```

**Conflict highlighting**: Trips that conflict with bus maintenance windows or other trips on the same bus are highlighted with a warning icon and explanation.

---

## 6. Manifest

### 6.1 Route

`/op/manifest/[tripId]`

### 6.2 Manifest View

```
+----------------------------------------------------------+
|  Bảng kê hành khách                                      |
|                                                          |
|  Tuyến: Thanh Hóa → TP.HCM                             |
|  Ngày: 25/06/2026 - 08:00                               |
|  Xe: 51B-123.45 (45 chỗ)                                |
|  Đã đặt: 12/45                        [ Làm mới 🔄 ]   |
|                                                          |
|  ┌──────┬──────────────┬──────┬────────┬──────┬────────┐|
|  │ Mã   │ Họ tên       │ SĐT  │ Đón    │ TT   │ Thao  │|
|  │ vé   │              │      │ tại    │      │ tác   │|
|  ├──────┼──────────────┼──────┼────────┼──────┼────────┤|
|  │ a1b2 │ Nguyễn Văn A │ *567 │ Bến xe │ ✓ TT │ [Lên] │|
|  │ c3d4 │ Trần Thị B   │ *890 │ Ngã tư │ ✓ TT │ [Lên] │|
|  │ e5f6 │ Lê Văn C     │ *234 │ Bến xe │ ○ CT │ [Lên] │|
|  └──────┴──────────────┴──────┴────────┴──────┴────────┘|
|                                                          |
|  [ Tải PDF ↓ ]                                           |
+----------------------------------------------------------+
```

### 6.3 Manifest Columns

| Column | Vietnamese Header | Source | Notes |
|--------|------------------|--------|-------|
| Mã vé | Booking ref (last 4 chars) | `booking.bookingRef` | Short form for display |
| Họ tên | Passenger name | `booking.passengerName` | Full name |
| SĐT | Phone (last 4 digits) | `booking.passengerPhone` | Privacy: `*567` format |
| Đón tại | Pickup location | `booking.pickupLocation` | Station name or area |
| TT (Thanh toán) | Payment status | `booking.status` | Badge: ✓ TT (paid) / ○ CT (awaiting) |
| Thao tác | Action buttons | -- | Check-in / No-show |

**Phone masking**: Only the last 4 digits are shown to the operator. Full phone numbers are not exposed in the manifest UI (privacy by design, PII minimization).

### 6.4 Check-In Action

Tapping "Len" (Boarded) marks the passenger as checked in:

- Changes the row to a green highlight.
- Icon changes from button to checkmark.
- Optimistic UI update; confirmed by server.

### 6.5 No-Show Action

Long-press or secondary menu on a row reveals "Khong den" (No-show):

```
+----------------------------------------------------------+
|  Đánh dấu không đến?                                    |
|                                                          |
|  Hành khách: Lê Văn C                                   |
|  Mã vé: e5f6                                            |
|                                                          |
|  [ Hủy ]          [ Xác nhận không đến ]                |
+----------------------------------------------------------+
```

Confirmation required to prevent accidental marking.

### 6.6 PDF Download

"Tai PDF" generates a printable PDF manifest for offline use or 3G/poor connectivity areas:

- A4 landscape format.
- Includes: trip details header, passenger table, QR code linking back to the digital manifest.
- Phone numbers show last 4 digits only (same as UI).

### 6.7 Refresh Button

"Lam moi" button fetches the latest manifest data. Useful for operators checking in passengers as new bookings arrive close to departure time.

---

## 7. VND Price Input Component

Used across trip and template creation forms:

| Behavior | Detail |
|----------|--------|
| Input type | `number` (no decimals) |
| On focus | Show raw integer (e.g., `350000`) |
| On blur | Format with thousands separator (e.g., `350.000`) |
| Suffix | "đ" label outside the input field |
| Validation | Must be > 0; integer only |
| Keyboard | Numeric keyboard on mobile (`inputmode="numeric"`) |

---

## 8. Error States

| Error | Vietnamese Message | Context |
|-------|--------------------|---------|
| `plate_in_use` | Biển số xe đã được sử dụng | Bus create/edit (HTTP 422) |
| `capacity_reduction_blocked` | Không thể giảm sức chứa dưới số hành khách đã đặt | Bus edit (HTTP 422) |
| `future_trips_assigned` | Có chuyến xe sắp tới, không thể ngưng hoạt động | Bus deactivation (HTTP 422) |
| `bus_overlap_with_outbound` | Xe trùng lịch với chuyến đi | Paired return (HTTP 422) |
| `maintenance_overlap` | Xe đang trong lịch bảo trì | Trip create (HTTP 409) |
| Network error | Không thể kết nối. Vui lòng thử lại | Any action |

---

## 9. Responsive Behavior

| Viewport | List Views | Forms | Manifest |
|----------|-----------|-------|----------|
| Mobile (< 768px) | Card layout (stacked), swipe for actions | Full-width, single column | Scrollable table, sticky header |
| Tablet (768--1024px) | Compact table | Centered, max 640px | Full table |
| Desktop (> 1024px) | Full table with all columns | Side panel or modal | Full table with inline actions |

---

## 10. Cross-References

| Document | Relevance |
|----------|-----------|
| business/domain-model/state-machines.md | Trip lifecycle (Section 1), Booking status (Section 2), Hold lifecycle (Section 3) |
| business/domain-model/bounded-contexts.md | Fleet/Catalog context (Section 2), Booking context (Section 3) |
| business/domain-model/ubiquitous-language.md | Trip, Bus, Route, Place, Hold, RecurringTripTemplate, PickupKind definitions |
| business/personas/operator-personas.md | Persona tech literacy, top needs, daily workflow patterns |
| ADR-010 (Booking Lifecycle) | Capacity model (D2), capacity guard (D3), price authority (D6), booking status (D7) |
| ADR-009 (Concurrency & Seat Holding) | Hold TTL, advisory locks, concurrent hold cap |
| DS-007 (Refund Flow) | Trip cancellation refund cascade (trigger T2) |
| DS-012 (Transport E-Invoice Fields) | Vehicle plate + route fields on invoices |
