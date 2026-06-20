# DS-040 -- FD-023: E-Invoice Display & Compliance

## 1. Overview

Vietnamese e-invoice compliance UI for the BusBooking platform, implementing Decree 70/2025 (amending Decree 123/2020) transport-specific e-invoice requirements. Covers both customer-facing invoice access and operator-facing invoice management. The platform issues e-invoices on behalf of operators via MISA meInvoice (ADR-014 D1) -- the invoice shows the operator as seller with their MST (tax code).

**Regulatory context**: Decree 70/2025 mandates that transport service e-invoices include vehicle license plate, departure/destination points, and transport route description. Invoices missing these fields are invalid for GDT (General Department of Taxation) purposes and operators cannot claim VAT input deductions.

**Scope**: Customer invoice download, operator invoice management, required transport fields display, and correction invoice flow.

---

## 2. Customer-Facing Invoice Display

### 2.1 Invoice Download Locations

| Location | Route | Trigger |
|----------|-------|---------|
| Booking confirmation page | `/booking/confirmation/[token]` | After payment confirmed |
| Booking detail / ticket page | `/booking/confirmation/[token]` (revisit) | Any time post-payment |

### 2.2 Availability Conditions

The invoice download button is visible only when:

| EInvoice Status | Button Visible | Button State |
|----------------|---------------|-------------|
| `pending` | No | -- |
| `issued` | Yes | Active |
| `sent` | Yes | Active |
| `failed` | No | -- |
| `cancelled` | No | -- |
| No EInvoice record | No | -- |

### 2.3 Invoice Card on Booking Detail

```
+----------------------------------------------------------+
|  Hóa đơn điện tử                                        |
|                                                          |
|  Số hóa đơn: HD-2026-001234                             |
|  Ngày phát hành: 25/06/2026                              |
|                                                          |
|  Nhà xe: Công Ty TNHH Xe Khách Phương Trang             |
|  MST: 0312345678                                         |
|                                                          |
|  Tuyến: Thanh Hóa → TP. Hồ Chí Minh                    |
|  Biển số xe: 51B-123.45                                  |
|                                                          |
|  ┌────────────────────────────────────────────────┐      |
|  │  Giá vé (trước thuế):        318.182 đ        │      |
|  │  Thuế GTGT (10%):             31.818 đ        │      |
|  │  ──────────────────────────────────────        │      |
|  │  Tổng cộng:                   350.000 đ        │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ Tải hóa đơn ↓ ]                                      |
+----------------------------------------------------------+
```

### 2.4 Invoice Download

- "Tải hóa đơn" button triggers a PDF download of the e-invoice from MISA.
- The PDF includes the GDT-required digital signature and QR code for verification.
- File naming convention: `hoadon-{bookingRef}-{invoiceNumber}.pdf`

### 2.5 Invoice Information Fields

| Field | Vietnamese Label | Source | Notes |
|-------|-----------------|--------|-------|
| Invoice number | Số hóa đơn | `EInvoice.invoiceNumber` | Assigned by MISA |
| Issue date | Ngày phát hành | `EInvoice.issuedAt` | DD/MM/YYYY format |
| Operator name | Nhà xe | `Operator.name` | Full company name |
| Operator MST | MST | `EInvoice.operatorMst` | 10 or 13 digit tax code |
| Route | Tuyến | `EInvoice.transportRoute` | "Departure → Destination" |
| Vehicle plate | Biển số xe | `EInvoice.vehiclePlate` | Snapshot at invoice creation |
| Pre-tax amount | Giá vé (trước thuế) | Derived: `totalVnd / 1.1` | VND integer rounded |
| VAT (10%) | Thuế GTGT (10%) | Derived: `totalVnd - preTax` | Standard 10% VAT |
| Total | Tổng cộng | `booking.totalVnd` | VAT-inclusive (standard in VN) |

---

## 3. Operator-Facing Invoice Management

### 3.1 Invoice Status in Booking Detail

On the operator booking detail page (`/op/bookings/[id]`), each booking shows its invoice status as a badge:

| EInvoice Status | Vietnamese Label | Badge Color | Description |
|----------------|-----------------|-------------|-------------|
| `pending` | Chờ phát hành | Gray | Invoice queued for MISA submission |
| `issued` | Đã phát hành | Green | Successfully submitted to MISA |
| `sent` | Đã gửi | Blue | Delivered to customer |
| `failed` | Thất bại | Red | MISA API error |
| `cancelled` | Đã hủy | Dark gray | Voided (booking cancelled or correction issued) |

### 3.2 Invoice List View

Route: `/op/invoices` (or as a tab within `/op/bookings`)

| Column | Source | Format |
|--------|--------|--------|
| Số HĐ | `EInvoice.invoiceNumber` | Invoice number or "Chưa có" if pending |
| Mã vé | `booking.bookingRef` | Short booking reference |
| Ngày | `EInvoice.issuedAt` or `createdAt` | DD/MM/YYYY |
| Tuyến | `EInvoice.transportRoute` | "Origin → Destination" |
| Số tiền | `booking.totalVnd` | "350.000 đ" |
| Trạng thái | `EInvoice.status` | Status badge (see table above) |
| | | Action buttons |

**Filters:**

| Filter | Type | Options |
|--------|------|---------|
| Ngày (Date range) | Date picker | From -- To |
| Trạng thái (Status) | Multi-select | pending, issued, sent, failed, cancelled |

### 3.3 Failed Invoice Display

When an invoice has `status = 'failed'`:

```
+----------------------------------------------------------+
|  ⚠ Hóa đơn thất bại                                    |
|                                                          |
|  Mã vé: BB-2026-a1b2-c3d4                              |
|  Lỗi MISA: [error code] - [error description]           |
|                                                          |
|  [ Thử lại ]                                            |
+----------------------------------------------------------+
```

The "Thu lai" (Retry) button triggers a resubmission to MISA (`POST /api/op/einvoice/{id}/retry` or admin-only path depending on operator permissions).

### 3.4 `needsReview` Flag

Invoices flagged with `needsReview = true` (missing transport fields) display an amber badge:

```
┌──────────────────────────────────────────────────┐
│  ⚠ Cần xem xét                                   │
│                                                    │
│  Hóa đơn thiếu thông tin vận tải bắt buộc:        │
│  • Biển số xe: ✓                                   │
│  • Nơi đi: ✗ (thiếu)                              │
│  • Nơi đến: ✗ (thiếu)                             │
│                                                    │
│  Hóa đơn sẽ không được gửi cho đến khi hoàn tất.  │
└──────────────────────────────────────────────────┘
```

The checklist shows which transport fields are present and which are missing. The invoice remains in `pending` status and is held from MISA submission until an admin corrects the data.

---

## 4. Required Decree 70/2025 Transport Fields

### 4.1 Mandatory Fields on Invoice

| Vietnamese Term | English | Field Source | Display Location |
|----------------|---------|-------------|-----------------|
| Biển số xe | Vehicle license plate | `EInvoice.vehiclePlate` (snapshot from `Bus.licensePlate`) | Customer invoice card, PDF invoice, operator invoice detail |
| Nơi đi | Departure location | `EInvoice.departureCity` (snapshot from `Place.name` via Route) | Customer invoice card, PDF invoice |
| Nơi đến | Destination location | `EInvoice.destinationCity` (snapshot from `Place.name` via Route) | Customer invoice card, PDF invoice |
| Mã số thuế (MST) | Tax identification number | `EInvoice.operatorMst` (snapshot from `Operator.taxCode`) | Customer invoice card, PDF invoice |

### 4.2 Transport Route Description

The `transportRoute` field is derived as `"{departureCity} → {destinationCity}"` using the Unicode right arrow (Vietnamese business convention). Example: "Thanh Hóa → TP. Hồ Chí Minh".

### 4.3 Field Snapshot Principle

All transport fields are snapshot copies taken at invoice creation time, not live references. If a bus plate is updated or a route is renamed after invoice issuance, the invoice retains the original values. This is a legal requirement -- invoices are immutable documents (Decree 123/2020).

---

## 5. Invoice Status State Machine

### 5.1 State Diagram

```
                    +-----------+
                    |  pending  |
                    +-----+-----+
                          |
                   +------+------+
                   |             |
                   v             v
             +-----------+ +-----------+
             |  issued   | |  failed   |
             +-----+-----+ +-----------+
                   |             |
                   v             v (retry)
             +-----------+ +-----------+
             |   sent    | |  pending  |
             +-----------+ +-----------+
                   |
                   v (if booking cancelled or correction)
             +-----------+
             | cancelled |
             +-----------+
```

### 5.2 Transition Table

| From | To | Trigger | UI Impact |
|------|----|---------|-----------|
| `pending` | `issued` | MISA submission succeeds | Badge: gray → green; invoice number assigned |
| `pending` | `failed` | MISA API error | Badge: gray → red; error details shown |
| `issued` | `sent` | Delivery to customer confirmed | Badge: green → blue |
| `issued` | `cancelled` | Booking cancelled or correction invoice issued | Badge: green → dark gray |
| `sent` | `cancelled` | Correction invoice issued | Badge: blue → dark gray |
| `failed` | `pending` | Retry triggered | Badge: red → gray; re-queued |

---

## 6. Correction Invoice Flow

### 6.1 When Correction Is Needed

Correction invoices are issued per Decree 123/2020 Art. 19 when an already-issued invoice contains incorrect transport fields:

| Error Type | Example | Correction Flow |
|-----------|---------|----------------|
| Wrong vehicle plate | Bus plate updated after invoice | Operator or admin initiates correction |
| Wrong departure/destination | Route changed after invoice | Operator or admin initiates correction |
| Missing transport fields | Legacy invoice without Decree 70/2025 fields | Supplementary invoice |

### 6.2 Operator Correction Initiation

On an invoice detail page with status `issued` or `sent`:

```
+----------------------------------------------------------+
|  Hóa đơn HD-2026-001234                                 |
|                                                          |
|  Trạng thái: Đã phát hành                               |
|  ...                                                     |
|                                                          |
|  [ Yêu cầu điều chỉnh ]                                |
+----------------------------------------------------------+
```

Clicking "Yeu cau dieu chinh" opens a form showing the current invoice fields with editable corrections:

```
+----------------------------------------------------------+
|  Điều chỉnh hóa đơn (Điều 19, Nghị định 123/2020)      |
|                                                          |
|  Hóa đơn gốc: HD-2026-001234                            |
|                                                          |
|  Biển số xe:                                             |
|  Hiện tại: 51B-123.45                                    |
|  Sửa thành: [51B-678.90___________]                     |
|                                                          |
|  Nơi đi:                                                 |
|  Hiện tại: Thanh Hóa                                     |
|  Sửa thành: [Thanh Hóa_____________]                    |
|                                                          |
|  Nơi đến:                                                |
|  Hiện tại: TP. Hồ Chí Minh                              |
|  Sửa thành: [TP. Hồ Chí Minh______]                    |
|                                                          |
|  Lý do điều chỉnh: *                                    |
|  [Biển số xe đã được cập nhật do chuyển xe]             |
|                                                          |
|  [ Hủy ]              [ Gửi yêu cầu điều chỉnh ]       |
+----------------------------------------------------------+
```

### 6.3 Correction Invoice Result

A new `EInvoice` row is created with:
- `type = 'correction'`
- `originalInvoiceId` referencing the original invoice
- Corrected transport field values
- Separate invoice number assigned by MISA

The original invoice retains its status (`issued` or `sent`) -- correction invoices coexist with originals per Decree 123/2020.

---

## 7. VAT Breakdown Display

### 7.1 Calculation

Vietnamese bus tickets use VAT-inclusive pricing (standard practice). The invoice must show the breakdown:

| Component | Formula | Example (350,000 VND ticket) |
|-----------|---------|------------------------------|
| Pre-tax amount | `totalVnd / 1.1` (rounded) | 318,182 đ |
| VAT (10%) | `totalVnd - preTax` | 31,818 đ |
| Total (VAT-inclusive) | `totalVnd` | 350,000 đ |

### 7.2 Display Format

```
Giá vé (trước thuế):        318.182 đ
Thuế GTGT (10%):             31.818 đ
─────────────────────────────────────
Tổng cộng:                   350.000 đ
```

---

## 8. Error States

| Error | Vietnamese Message | Context |
|-------|--------------------|---------|
| Invoice not found | Không tìm thấy hóa đơn | Customer or operator lookup |
| Invoice not yet issued | Hóa đơn đang được xử lý. Vui lòng thử lại sau | Customer attempts download before issuance |
| MISA connection error | Không thể kết nối MISA. Hóa đơn sẽ được gửi lại tự động | Failed submission display |
| Missing operator MST | Hóa đơn bị chặn: nhà xe chưa có mã số thuế | Operator/admin alert |
| Correction submission failed | Gửi yêu cầu điều chỉnh thất bại. Vui lòng thử lại | Correction flow |

---

## 9. Responsive Behavior

| Viewport | Customer Invoice Card | Operator Invoice List | Correction Form |
|----------|---------------------|---------------------|----------------|
| Mobile (< 768px) | Full-width card, stacked layout | Card list with swipe actions | Full-width, single column |
| Tablet (768--1024px) | Inline card in booking detail | Compact table | Centered modal (540px) |
| Desktop (> 1024px) | Side card in booking detail | Full table with all columns | Centered modal (600px) |

---

## 10. Cross-References

| Document | Relevance |
|----------|-----------|
| DS-012 (Transport E-Invoice Fields) | Data model changes, source mapping, MISA XML field mapping, `needsReview` flag, correction invoice model |
| ADR-014 (E-Invoice & Compliance) | E-invoice issuer model (D1), MISA meInvoice selection (D2), tax withholding (D4) |
| Decree 70/2025 (amending Decree 123/2020) | Transport-specific e-invoice fields mandate, vehicle plate + departure/destination requirements |
| Decree 123/2020 Art. 19 | Correction invoice procedure for issued invoices with incorrect fields |
| regulatory/einvoice-tax.md | E-invoicing requirements, GDT-certified providers, VAT rates, transport-specific fields |
| ADR-006 (Pricing/Currency) | VND integer arithmetic, VAT-inclusive pricing convention |
| DS-007 (Refund Flow) | Invoice cancellation on refund/booking cancellation |
