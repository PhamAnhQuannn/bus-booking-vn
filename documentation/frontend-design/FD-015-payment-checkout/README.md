# DS-032 Booking Review & Payment Checkout

Frontend UX specification for the booking review page, payment method selection, price transparency, consent capture, and payment flow per PSP.

---

## 1. Booking Review Page Layout

### 1.1 Route

`/booking/review` -- requires active hold (`bb_hold` cookie with valid `holdId`)

### 1.2 Page Structure

```
+----------------------------------------------------------+
|  [Hold Timer - sticky]       Thoi gian giu cho: 08:42    |
+----------------------------------------------------------+
|                                                          |
|  THONG TIN CHUYEN XE (Trip Summary)                      |
|  +------------------------------------------------------+|
|  | Nha xe: Phuong Trang (FUTA)          [Operator Logo] ||
|  | Tuyen: Ho Chi Minh -> Da Lat                         ||
|  | Ngay: Thu Bay, 01/02/2026                             ||
|  | Gio khoi hanh: 06:30                                  ||
|  | Loai xe: Limousine                                    ||
|  | Diem don: Ben xe Mien Dong                            ||
|  +------------------------------------------------------+|
|                                                          |
|  THONG TIN HANH KHACH (Passenger Info)                   |
|  +------------------------------------------------------+|
|  | Ho ten: [input]                                       ||
|  | So dien thoai: +84 901 234 567 (pre-filled or input) ||
|  | Email (tuy chon): [input]                             ||
|  | So luong ve: 2                                        ||
|  +------------------------------------------------------+|
|                                                          |
|  CHI TIET GIA (Price Breakdown)                          |
|  +------------------------------------------------------+|
|  | 2 x 350.000 d                         700.000 d       ||
|  |                                                      ||
|  | Tong cong (da bao gom VAT):           700.000 d       ||
|  | Khong phat sinh phi them.                             ||
|  +------------------------------------------------------+|
|                                                          |
|  PHUONG THUC THANH TOAN (Payment Method)                 |
|  [Payment method selection - see section 3]              |
|                                                          |
|  DIEU KHOAN (Terms & Consent)                            |
|  [Consent checkboxes - see section 6]                    |
|                                                          |
|  [Xac nhan dat ve va thanh toan]                         |
|                                                          |
+----------------------------------------------------------+
```

### 1.3 Data Source

The review page calls a lib function in-process (NOT a self-fetch to its own API) to resolve hold details. The `bb_hold` cookie is verified server-side, and hold data including trip summary, route, operator, and price is loaded from the database directly.

---

## 2. Guest vs Authenticated Divergence

| Element | Guest | Authenticated Customer |
|---------|-------|------------------------|
| Phone field | Editable input, pre-filled from hold creation phone | Pre-filled from customer record, read-only |
| Name field | Required input | Pre-filled if available, editable |
| Email field | Optional input | Pre-filled if available, editable |
| Post-booking | "Tao tai khoan de xem lich su dat ve?" prompt | No prompt |
| Identity | Phone from hold | Customer ID from session |

---

## 3. Payment Method Selection

### 3.1 PSP Table

| PSP | Vietnamese Label | Icon | Status | Integration Phase |
|-----|-----------------|------|--------|-------------------|
| Bank transfer | "Chuyển khoản" | Building2 (bank icon) | Active (launch) | Phase 1 |
| Cash | "Thanh toán khi lên xe" | Cash icon | Active (launch) | Phase 1 |
| MoMo | "Ví MoMo" | MoMo logo (Wallet) | Active | Phase 2 |
| VNPay | "VNPay (Thẻ/QR/Ví)" | VNPay logo | Active | Phase 2 |

### 3.2 Selection UI

| Element | Specification |
|---------|---------------|
| Component | Radio group (`value` + `onValueChange()`) |
| Layout | Vertical stack, one card per method |
| Card content | PSP icon + label + brief description |
| Default selection | Bank transfer (first listed, launch PSP) |
| Keyboard | Arrow keys navigate, Space/Enter selects |
| `aria-label` | "Chon phuong thuc thanh toan" (Choose payment method) |

### 3.3 MoMo Payment Flow

```
User selects MoMo -> Click "Xac nhan dat ve va thanh toan"
  -> POST /api/bookings/initiate (creates booking, returns MoMo redirect URL)
  -> Redirect/deep-link to MoMo app
  -> Customer authenticates in MoMo (PIN or biometric)
  -> MoMo redirects back to /booking/result/[confirmationToken]
  -> Page polls for booking status (see FD-016)
```

| Element | Detail |
|---------|--------|
| Deep link | MoMo app-switch on mobile; QR code fallback on desktop |
| Timing | Best case 45s, median 90s, worst case 3-4 min |
| Hold timer | Remains visible; hold must not expire during payment |

### 3.4 VNPay Payment Flow

```
User selects VNPay -> Click CTA
  -> POST /api/bookings/initiate (returns VNPay portal URL)
  -> Browser redirect to VNPay payment portal
  -> Customer selects bank/card/QR within VNPay
  -> VNPay redirects back to /booking/result/[confirmationToken]
  -> Dual confirmation: Return URL + IPN webhook (both idempotent)
```

| Element | Detail |
|---------|--------|
| Redirect | Full-page redirect to VNPay portal |
| Return | VNPay redirects to `/api/payments/vnpay/return` which redirects to result page |
| Cards accepted | Domestic NAPAS, international Visa/MC |

### 3.5 Bank Transfer (VietQR + SePay) Payment Flow

> **Updated 2026-06-20**: Confirmation via SePay webhook (push-based, 5-30s), not cron-based reconciliation.

```
User selects "Chuyển khoản" -> Click CTA
  -> POST /api/bookings/initiate { paymentMethod: 'bank_transfer' }
  -> Returns payUrl = /booking/bank-transfer?bookingRef=...&amount=...
  -> Redirect to internal QR display page
  -> Customer scans QR with banking app, confirms transfer
  -> SePay webhook confirms payment (5-30s)
  -> Client polling detects status='paid' -> auto-redirect to result page
```

| Element | Detail |
|---------|--------|
| QR display | VietQR image via `img.vietqr.io` API with pre-filled Agribank account, amount, bookingRef |
| Bank details | Ngân hàng Agribank, số tài khoản, chủ tài khoản, số tiền, nội dung CK |
| Copy buttons | Three copy-to-clipboard buttons: account number, amount, bookingRef |
| Reference | Booking ref as transfer memo, e.g., `BB-2026-a1b2-c3d4` |
| Polling | Client polls `GET /api/bookings/status?token=<confirmationToken>` every 5s |
| Auto-redirect | When status = `paid` → redirect to `/booking/result/[token]` |
| Hold timer | Visible during QR display — customer must complete before hold expiry |
| Fallback | If QR image fails to load, manual transfer details shown prominently |

**Transfer Instructions (Vietnamese):**

```
Bước 1: Mở ứng dụng ngân hàng của bạn
Bước 2: Quét mã QR hoặc nhập thông tin chuyển khoản
Bước 3: Kiểm tra số tiền và nội dung chuyển khoản
Bước 4: Xác nhận chuyển khoản
```

**Confirmation latency:** 5-30 seconds via SePay webhook (not 30 minutes via cron). Customer experience is comparable to MoMo/VNPay. See DS-013 for full design.

### 3.6 Cash-at-Boarding Flow

```
User selects "Thanh toan khi len xe" -> Click CTA
  -> POST /api/bookings/initiate (creates booking with paymentMethod='cash')
  -> Booking created in awaiting_payment status
  -> Redirect to /booking/confirmation/[confirmationToken]
  -> Distinct confirmation: reservation only, not paid
```

| Element | Detail |
|---------|--------|
| CTA text | "Dat cho -- thanh toan khi len xe" (Reserve -- pay at boarding) |
| Confirmation | Distinct from paid confirmation: "Cho ngoi da duoc dat. Vui long thanh toan khi len xe." |
| No payment redirect | Direct confirmation, no PSP interaction |

---

## 4. Price Transparency

### 4.1 Legal Requirements

| Requirement | Source | Implementation |
|-------------|--------|----------------|
| Total price shown before payment commitment | Art. 6 Decree 10/2020, CPL 2023, Pricing Law 2023 | Price breakdown section visible before CTA |
| No hidden fees at checkout | CPL 2023 | "Khong phat sinh phi them" (No additional fees) displayed |
| VAT-inclusive pricing | Tax law (standard in VN) | "Da bao gom VAT" (VAT included) label |
| Prices in VND only | Currency law | VND formatting throughout |
| Confirmation step before payment | E-Transactions Law 2023 | Review page IS the confirmation step |

### 4.2 Price Display

| Element | Format | Example |
|---------|--------|---------|
| Unit price | `{n}.000 d` (dot separator, dong symbol) | `350.000 d` |
| Quantity | `{qty} x {unit_price}` | `2 x 350.000 d` |
| Total | Bold, larger text | `700.000 d` |
| VAT note | Grey subtext | "Da bao gom VAT" |
| No-fee note | Grey subtext | "Khong phat sinh phi them" |

### 4.3 I7 Invariant Compliance

The price displayed on the review page is `Trip.price * ticketCount`, derived server-side. The client never computes, modifies, or submits price values. The `POST /api/bookings/initiate` request body does NOT include a price field -- the server reads `Trip.price` from the database at booking creation time.

---

## 5. E-Wallet Cap Warning

### 5.1 VND Limits

| Limit | Value | Trigger |
|-------|-------|---------|
| Single transaction biometric | >= VND 10,000,000 | MoMo/ZaloPay prompt biometric auth |
| Monthly e-wallet cap | VND 100,000,000 | Checkout may fail silently |

### 5.2 Warning Display

| Condition | Message |
|-----------|---------|
| Total >= VND 10M and payment method is e-wallet | "Giao dich tren 10 trieu dong can xac thuc sinh trac hoc tren ung dung vi." |
| General note (always shown for e-wallet) | "Han muc vi dien tu: 100 trieu dong/thang. Neu vuot han muc, vui long chon phuong thuc thanh toan khac." |
| Suggested fallback | "Chuyen khoan ngan hang (VietQR)" or "VNPay (the ngan hang)" links below warning |

---

## 6. Consent Checkboxes

### 6.1 Required Consents

| Consent | Type | Label (Vietnamese) | Pre-ticked |
|---------|------|---------------------|-----------|
| Cancellation policy | `no_refund` | "Toi da doc va dong y voi chinh sach huy ve va hoan tien." | No (PDPL 2025 prohibits pre-ticked) |
| PII processing | `pii_storage` | "Toi dong y cho phep luu tru va xu ly thong tin ca nhan de xu ly dat ve theo Luat Bao ve Du lieu Ca nhan 2025." | No |

### 6.2 Consent UI

| Element | Specification |
|---------|---------------|
| Component | `Checkbox` (`checked` + `onCheckedChange()`) |
| Label link | "chinh sach huy ve" links to cancellation policy page in new tab |
| Validation | Both checkboxes must be checked before CTA is enabled |
| Error | If user clicks CTA without checking: "Vui long dong y voi cac dieu khoan truoc khi tiep tuc." |
| Storage | `ConsentRecord` created at booking initiation with `version` and `consentedAt` |

---

## 7. Payment Failure Recovery

### 7.1 Error Handling

| Scenario | Display | Actions |
|----------|---------|---------|
| PSP redirect failure | "Khong the ket noi voi cong thanh toan. Vui long thu lai." | "Thu lai" (Retry) button |
| Payment declined by PSP | "Thanh toan bi tu choi. Vui long kiem tra tai khoan hoac thu phuong thuc khac." | "Thu lai" + "Chon phuong thuc khac" |
| Hold expired during payment | HoldExpiryModal (non-dismissible) | "Tim chuyen khac" only |
| Network error mid-payment | "Da xay ra loi mang. Neu ban da thanh toan, he thong se tu dong cap nhat trong vai phut." | "Kiem tra trang thai" link |
| Timeout (no webhook within 60s of return) | "Dang xu ly thanh toan. Vui long cho..." with support contact | Auto-polling continues |

### 7.2 Retry Within Hold TTL

If the hold is still active (timer > 0), the customer can:

1. Retry the same payment method
2. Switch to a different payment method
3. Both options available on the error screen

If the hold has expired, retry is not possible -- only "Tim chuyen khac" is available.

---

## 8. Final CTA

### 8.1 CTA Variants

| Payment method | CTA text (Vietnamese) |
|----------------|------------------------|
| MoMo | "Xác nhận đặt vé và thanh toán" (Confirm booking and pay) |
| VNPay | "Xác nhận đặt vé và thanh toán" |
| Bank transfer | "Xác nhận đặt vé và chuyển khoản" (Confirm booking and transfer) |
| Cash | "Đặt chỗ -- thanh toán khi lên xe" (Reserve -- pay at boarding) |

### 8.2 CTA State

| State | Behavior |
|-------|----------|
| Disabled | When: consent checkboxes unchecked, required fields empty, or hold expired |
| Loading | Spinner + "Dang xu ly..." (Processing...) -- prevents double-click |
| Error | Re-enabled after error toast dismissal |

### 8.3 Legal Compliance (E-Transactions Law 2023)

The CTA serves as the electronic contract confirmation. The review page satisfies the E-Transactions Law 2023 requirement that the consumer must have the opportunity to review and confirm before completing the transaction. The booking confirmation (next page) includes: operator identity, route authorization, cancellation terms, and platform contact.

---

## 9. Accessibility

| Concern | Implementation |
|---------|----------------|
| Payment method selection | `role="radiogroup"`, `aria-label="Chon phuong thuc thanh toan"` |
| Consent checkboxes | Associated `<label>` elements, `aria-required="true"` |
| Price breakdown | Structured as definition list or table with `aria-label` |
| Hold timer | `role="timer"`, `aria-live="polite"` (see FD-014) |
| Error messages | `<p role="alert">` for validation errors |
| Focus management | Focus moves to first error on validation failure |
| VietQR instructions | `aria-label` on step list, copy button has `aria-label="Sao chep ma giao dich"` |

---

## 10. Mobile Considerations

| Concern | Implementation |
|---------|----------------|
| Layout | Single column, full-width sections |
| Payment method cards | Full-width, stacked vertically |
| Hold timer | Sticky top bar, 44px height minimum |
| CTA | Full-width sticky bottom button |
| MoMo deep-link | Uses `intent://` URI scheme on Android for native app switch |
| Keyboard | Virtual keyboard does not obscure price or CTA |
| Touch targets | All interactive elements >= 44px |

---

## Cross-References

| Document | Relevance |
|----------|-----------|
| [ADR-005 Payment Architecture](../../architecture-decisions/ADR-005-payment-architecture/) | PSP selection, webhook verification, marketplace model, refund strategy |
| [ADR-010 Booking Lifecycle](../../architecture-decisions/ADR-010-booking-lifecycle/) | Hold-then-book model, price authority (I7), guest booking, consent records |
| [DS-005 Webhook Design](../../design-specifications/DS-005-webhook-design/) | Webhook processing pipeline, PSP adapter layer, amount guard |
| [FD-014 Hold Timer](../FD-014-hold-timer/) | HoldTimer component, expiry modal, timer state management |
| [Business: Payment Regulations](../../business/regulatory/payment.md) | E-wallet limits, IPS classification, fund flow |
| [Business: Consumer Protection](../../business/regulatory/consumer-protection.md) | Price transparency, confirmation step, unfair terms, complaint handling |
| [Business: Invariants Catalog](../../business/domain-model/invariants-catalog.md) | I7 no client-originated price, capacity guard |
