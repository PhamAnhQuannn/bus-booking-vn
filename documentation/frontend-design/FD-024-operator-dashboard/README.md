# DS-041 FD-024: Operator Dashboard & Revenue

## 1. Overview

The operator dashboard is the primary workspace for bus operators managing their daily operations and finances on the platform. It spans three route surfaces --- `/op/dashboard` (home), `/op/reports/revenue` (revenue analytics), and `/op/money` (payout management) --- unified by a single design language that prioritizes financial transparency and operational clarity.

All monetary values are displayed in VND (integer, no subunit). Currency math is BigInt server-side; the UI renders formatted integers only. The platform fee is operator-absorbed and invisible to customers.

---

## 2. Dashboard Home (`/op/dashboard`)

### 2.1 Stat Cards

Four stat cards in a responsive grid (`grid-cols-2` mobile, `grid-cols-4` desktop).

| Card | Label (VI) | Value | Format | Icon |
|------|-----------|-------|--------|------|
| Today's Trips | Chuyến hôm nay | Count of trips departing today | Integer | `Bus` |
| Today's Bookings | Vé hôm nay | Count of bookings for today's trips | Integer with unviewed badge | `Ticket` |
| Unviewed Bookings | Vé mới | Count since `lastBookingsViewedAt` | Red badge on Bookings card | --- |
| Available Balance | Số dư khả dụng | Withdrawable balance (VND) | `xxx.xxx d` | `Wallet` |

**Unviewed bookings badge**: Derived from `OperatorUser.lastBookingsViewedAt`. Navigating to the bookings list resets the timestamp. Badge renders as a numeric indicator (e.g., `+3`) overlaid on the Bookings card.

**Balance derivation**: Always computed from the append-only ledger (`SUM` of credits minus debits). Never stored as a column. The displayed value reflects T+1 settlement --- only trips completed more than 24 hours ago contribute to the available balance.

### 2.2 Today's Departures List

Sortable table (desktop) / stacked cards (mobile) showing all trips departing today in the operator's `Asia/Ho_Chi_Minh` timezone.

| Column | Label (VI) | Format |
|--------|-----------|--------|
| Departure Time | Giờ khởi hành | `HH:mm` |
| Route | Tuyến | `{origin} - {destination}` |
| Bus | Xe | Plate number |
| Seats | Ghế | `{booked}/{total}` with fill-rate color: green (< 70%), amber (70-90%), red (> 90%) |
| Status | Trạng thái | Badge: `Lên lịch` / `Đã khởi hành` / `Hoàn thành` / `Đã hủy` |

**Row tap**: navigates to `/op/trips/[tripId]` detail view.

### 2.3 Quick Actions

Three action buttons below the departures list:

| Action | Label (VI) | Route | Icon |
|--------|-----------|-------|------|
| Create Trip | Tạo chuyến mới | `/op/trips/new` | `Plus` |
| View Bookings | Xem đặt vé | `/op/bookings` | `ClipboardList` |
| Request Withdrawal | Rút tiền | `/op/money` | `ArrowDownToLine` |

### 2.4 Empty State --- Day-1 Onboarding Checklist

When the operator has zero buses, routes, or trips, the dashboard replaces the departures list with an onboarding checklist:

```
Bắt đầu với [Platform Name]

[ ] 1. Thêm xe khách          → /op/buses/new
      Nhập biển số và số ghế

[ ] 2. Thêm tuyến đường       → /op/routes/new
      Chọn điểm đi và điểm đến

[ ] 3. Tạo chuyến đầu tiên    → /op/trips/new
      Lên lịch chuyến và bắt đầu bán vé
```

Each step shows a green checkmark when completed. Steps are sequential --- step 2 is visually muted until step 1 completes. Progress persists across sessions.

---

## 3. Revenue Reports (`/op/reports/revenue`)

### 3.1 Filters

| Filter | Type | Default | Notes |
|--------|------|---------|-------|
| Date Range | Date picker pair | Last 30 days | Vietnam timezone (`Asia/Ho_Chi_Minh`). Server-side date derivation uses `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })` |
| Route | Select dropdown | All routes | Populated from operator's active routes |

Date range picker uses Vietnamese locale labels: `Từ ngày` / `Đến ngày`.

### 3.2 Summary Cards

Four summary cards above the breakdown table:

| Card | Label (VI) | Derivation |
|------|-----------|------------|
| Gross Revenue | Tổng doanh thu | `SUM(booking_credit)` for period |
| Platform Commission | Phí nền tảng | `SUM(platform_fee)` for period (absolute value) |
| Tax Withholding | Khấu trừ thuế | `SUM(tax_withheld)` for period. Shown only for `individual_household` tax classification |
| Net Payout | Thực nhận | Gross - Commission - Tax |

### 3.3 Per-Trip Breakdown Table

| Column | Label (VI) | Format |
|--------|-----------|--------|
| Date | Ngày | `dd/MM/yyyy` |
| Route | Tuyến | `{origin} - {destination}` |
| Bookings | Số vé | Integer count |
| Gross | Doanh thu | `xxx.xxx d` |
| Commission | Phí NTT | `xxx.xxx d` |
| Tax | Thuế | `xxx.xxx d` (conditional column) |
| Net | Thực nhận | `xxx.xxx d` |

**Tax column visibility**: Only rendered when `Operator.taxClassification === 'individual_household'`. Company operators (`company`) self-file taxes and see no tax column.

**Pagination**: 20 rows per page. Server-side pagination with `?page=N` query param.

### 3.4 CSV Export

Button: "Xuất CSV" with `Download` icon. Generates server-side via `buildRevenueCsv` / `buildBookingRevenueCsv`. File name: `doanh-thu_{operatorSlug}_{startDate}_{endDate}.csv`. Columns match the table above. Encoding: UTF-8 with BOM (for Excel Vietnamese diacritics compatibility).

---

## 4. Payout Dashboard (`/op/money`)

### 4.1 Balance Widget

Three-column layout (desktop) / stacked cards (mobile):

| Section | Label (VI) | Description |
|---------|-----------|-------------|
| Pending | Đang chờ quyết toán | Revenue from trips completed < 24h ago. Not yet withdrawable |
| Available | Số dư khả dụng | Withdrawable balance. Derived from ledger |
| Total Paid | Tổng đã rút | Cumulative successful payouts |

### 4.2 T+1 Settlement Explanation

Inline info banner below the balance widget:

> **Quyết toán T+1**: Doanh thu hôm nay sẽ sẵn sàng rút vào ngày mai. Sau khi chuyến hoàn thành, số tiền sẽ chuyển sang "Số dư khả dụng" sau 24 giờ.

### 4.3 Withdrawal Request

| Element | Specification |
|---------|--------------|
| Minimum | 100.000 VND. Amounts below show: "Số tiền tối thiểu: 100.000 d" |
| Amount input | Numeric, VND formatted with dot separators. Pre-fill with full available balance |
| Payout account | Display bank name + masked account number (last 4 digits). Link to `/op/settings` to change |
| CTA button | "Rut tien" (primary orange). Disabled when available balance < 100.000 |
| Confirmation | Modal: "Rut X d ve tai khoan [Bank] ***1234?" with Confirm/Cancel |
| Success toast | "Yeu cau rut tien da duoc ghi nhan. Thoi gian xu ly: 1-3 ngay lam viec." |

**Payout account verification gate**: If `PayoutAccount.verifiedAt` is null (e.g., after editing bank details), the withdrawal button is disabled with: "Tai khoan thanh toan dang cho xac minh. Vui long lien he ho tro."

### 4.4 Payout History Table

| Column | Label (VI) | Format |
|--------|-----------|--------|
| Date | Ngay yeu cau | `dd/MM/yyyy HH:mm` |
| Amount | So tien | `xxx.xxx d` |
| Status | Trang thai | Badge (see below) |
| Account | Tai khoan | Bank name + last 4 digits |

**Status badges**:

| Status | Label (VI) | Color | Description |
|--------|-----------|-------|-------------|
| `requested` | Da yeu cau | Blue | Withdrawal submitted |
| `processing` | Dang xu ly | Amber | PSP bank transfer initiated |
| `paid` | Da thanh toan | Green | Funds transferred |
| `failed` | That bai | Red | Transfer failed |

### 4.5 Failed Payout Alert

When the most recent payout has `status === 'failed'`, render a persistent alert banner at the top of the page:

> **Chuyen tien that bai** --- Kiem tra thong tin tai khoan ngan hang tai [Cai dat](/op/settings). Neu thong tin chinh xac, vui long lien he ho tro.

Alert uses `role="alert"` and `aria-live="assertive"`.

---

## 5. Commission Transparency

### 5.1 Settings Display (`/op/settings`)

The operator settings page includes a "Phi nen tang" (Platform Fee) section showing:

- Current rate: resolved via `getEffectiveFeeRate(operatorId, now)` and displayed as percentage (e.g., "6%")
- Effective date: when the current rate took effect
- Worked example with the operator's most common ticket price:

```
Vi du tinh phi:
  Gia ve:           400.000 d
  Phi nen tang (6%): 24.000 d
  Ban nhan:         376.000 d
```

If a promotional/introductory rate is active: "Uu dai: 5% trong 3 thang dau (ket thuc ngay dd/MM/yyyy)".

### 5.2 Fee Rate Encoding

The fee is stored as `ratePpm` (parts-per-million) in the `FeeConfig` table with effective-dating. Display conversion: `ratePpm / 10000` = percentage. Example: `60000 ppm = 6%`.

| Rate | ratePpm | Display |
|------|---------|---------|
| 5% introductory | 50000 | 5% |
| 6% default | 60000 | 6% |
| 8% standard | 80000 | 8% |
| 10% standard | 100000 | 10% |
| 20% ceiling | 200000 | 20% |

---

## 6. Tax Withholding Display

### 6.1 Applicability

Only for operators with `Operator.taxClassification === 'individual_household'`. Company operators self-file and see no withholding.

### 6.2 Payout Breakdown

When tax withholding applies, the payout detail view expands:

```
Chi tiet thanh toan:
  Doanh thu gop:              1.200.000 d
  Phi nen tang (6%):            -72.000 d
  Khau tru thue GTGT (3%):     -36.000 d
  Khau tru thue TNCN (1,5%):   -18.000 d
  ──────────────────────────
  Thuc nhan:                  1.074.000 d
```

### 6.3 Tax Line Items

| Tax Type | Label (VI) | Rate | Ledger Entry Type |
|----------|-----------|------|-------------------|
| VAT | Khau tru thue GTGT | ~3% | `tax_withheld` |
| PIT | Khau tru thue TNCN | ~1.5% | `tax_withheld` |
| Total Tax | Tong khau tru thue | ~4.5% | Sum of above |

Rates are approximate per current Vietnamese tax regulations for individual/household business operators. Exact rates follow Circular 40/2021/TT-BTC.

---

## 7. Responsive Behavior

| Viewport | Dashboard | Revenue Reports | Payout |
|----------|-----------|----------------|--------|
| Mobile (< 768px) | 2-column stat grid, stacked departure cards, vertical quick actions | Stacked filter inputs, horizontal-scroll table, sticky summary | Stacked balance cards, full-width withdrawal form |
| Tablet (768-1023px) | 4-column stat grid, compact table, inline quick actions | Side-by-side filters, table with horizontal scroll | 3-column balance, inline form |
| Desktop (1024px+) | 4-column stat grid, full table, inline quick actions | Inline filters, full table | 3-column balance, inline form with history |

---

## 8. Accessibility

- All monetary values include `aria-label` with spelled-out amounts: `aria-label="400 nghin dong"`
- Status badges use both color AND text label (not color-only)
- Stat cards are focusable with `tabindex="0"` and descriptive `aria-label`
- Date inputs use native date picker with Vietnamese locale fallback
- CSV export button has `aria-describedby` linking to the current filter state

---

## 9. Cross-References

| Reference | Relevance |
|-----------|-----------|
| ADR-006 Pricing & Currency | VND integer handling, fee encoding (ratePpm), tax withholding model |
| ADR-002 NFR Targets | Operator console CRUD <= 200ms p95 |
| DS-028 FD-011 Data Fetching | RSC page fetches via lib functions, no self-fetch |
| DS-018 FD-001 Design System | Color tokens, typography, component primitives |
| DS-024 FD-007 Responsive/Mobile | Breakpoints, operator nav patterns |
| Bounded Contexts: Finance/Ledger | Append-only ledger, balance derivation, payout pipeline |
| Bounded Contexts: Reporting | `getRevenueReport`, `buildRevenueCsv`, operator-scoped |
| Operator Personas | Micro (cash-flow sensitive, same-day payout), Mid-size (route analytics), Cooperative (tax docs per member) |
