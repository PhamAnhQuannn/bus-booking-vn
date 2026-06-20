# DS-038 -- FD-021: Operator Onboarding & KYB

## 1. Overview

Operator acquisition funnel for the BusBooking platform: registration, first-login password gate, KYB (Know-Your-Business) document submission wizard, approval status display, and resubmission flow. The onboarding process collects the documents required by multiple regulatory domains (transport licensing, e-invoice authorization, tax compliance, payment settlement) and drives the Operator through the approval lifecycle (`PENDING_REVIEW` through `APPROVED`).

**Target personas**: "Bac Tam" (micro, 1--5 buses, very low tech literacy), "Cong Ty Xe Khach Tinh" (mid-size, 6--30 buses, medium tech literacy), "Xe Limousine Cao Cap" (limousine/VIP, medium-high tech literacy).

**Scope**: Operator-facing web UI only. Admin approval queue and KYB review interfaces are out of scope.

---

## 2. Registration

### 2.1 Route

`/op/register`

### 2.2 Form Fields

| Field | Required | Validation | Vietnamese Label |
|-------|----------|------------|-----------------|
| Email | Yes | Valid email format | Email |
| Phone | Yes | Vietnamese phone format (+84...) | Số điện thoại |
| Password | Yes | Min 8 characters | Mật khẩu |
| Company name | Yes | 1--200 characters | Tên nhà xe / công ty |
| Entity type | Yes | `company` or `individual_household` | Loại hình kinh doanh |

### 2.3 Entity Type Selector

```
Loại hình kinh doanh: *

○ Doanh nghiệp (công ty TNHH, cổ phần)
   Tự kê khai thuế thu nhập doanh nghiệp (CIT)

○ Hộ kinh doanh / Cá nhân
   Nền tảng sẽ khấu trừ thuế GTGT (~3%) và TNCN (~1.5%)
   theo quy định Luật Thương mại điện tử 2025
```

The entity type determines tax withholding behavior per ADR-014 D4. This selection is visible during registration to set expectations early. A tooltip explains: "Chọn loại hình phù hợp với giấy đăng ký kinh doanh của bạn."

### 2.4 Post-Registration

On successful registration:
- An `applicationRef` is generated for tracking.
- The operator account is created with status `PENDING_REVIEW`.
- A temporary password is generated (if admin-initiated) or the user's chosen password is stored.
- SMS and email confirmation sent: "Đăng ký thành công. Vui lòng đăng nhập và hoàn tất hồ sơ KYB."

---

## 3. First Login Gate

### 3.1 Route

`/op/first-login`

### 3.2 Behavior

When an operator logs in with a temporary password (`requiresPasswordChange: true` in JWT claims), the middleware redirects to `/op/first-login` before allowing access to any console page.

```
+----------------------------------------------------------+
|  Đổi mật khẩu                                           |
|                                                          |
|  Bạn cần đổi mật khẩu trước khi sử dụng hệ thống.     |
|                                                          |
|  Mật khẩu hiện tại: [________________]                  |
|  Mật khẩu mới: [________________]                       |
|  Xác nhận mật khẩu mới: [________________]              |
|                                                          |
|  Yêu cầu: tối thiểu 8 ký tự                            |
|                                                          |
|  [ Đổi mật khẩu ]                                       |
+----------------------------------------------------------+
```

### 3.3 Password Change Flow

- On successful password change, a new JWT is minted with `requiresPasswordChange: false`.
- The operator is redirected to the console dashboard or KYB wizard (if KYB not yet started).
- The allowlist for the first-login path is exact-match only (`/op/first-login`) -- no prefix-match bypass possible.

---

## 4. KYB Application Wizard

### 4.1 Route

`/op/kyb`

### 4.2 Multi-Step Wizard

The KYB wizard uses a horizontal stepper (desktop) or vertical stepper (mobile) with 5 steps. Progress is saved per-step -- the operator can leave and resume later.

```
Step 1        Step 2        Step 3        Step 4        Step 5
Thông tin  →  Giấy tờ   →  Ngân hàng →  Hóa đơn   →  Xác nhận
doanh nghiệp  pháp lý      thanh toán    điện tử       & nộp
  [●]          [○]          [○]          [○]          [○]
```

### 4.3 Step 1: Company Information

| Field | Required | Validation | Vietnamese Label |
|-------|----------|------------|-----------------|
| Company name | Yes | Pre-filled from registration | Tên nhà xe / công ty |
| Entity type | Yes | Pre-filled from registration | Loại hình kinh doanh |
| MST (tax code) | Yes | 10 or 13 digits | Mã số thuế (MST) |
| Province | Yes | Dropdown of Vietnamese provinces | Tỉnh / thành phố |
| Business address | Yes | Free text | Địa chỉ kinh doanh |
| Representative name | Yes | Full name | Người đại diện pháp luật |

```
+----------------------------------------------------------+
|  Bước 1: Thông tin doanh nghiệp                         |
|                                                          |
|  Tên nhà xe: [Xe Khách Phương Trang__]                  |
|  Mã số thuế (MST): [0312345678______]                   |
|  Tỉnh / thành phố: [▾ Chọn tỉnh/thành]                |
|  Địa chỉ: [123 Quốc lộ 1A, Q.Bình Thạnh]              |
|  Người đại diện: [Nguyễn Văn A_________]                |
|                                                          |
|  [ Tiếp tục → ]                                         |
+----------------------------------------------------------+
```

### 4.4 Step 2: Document Upload

Required documents sourced from regulatory requirements across transport, e-invoice, and payment domains:

| Document | Vietnamese Label | Source Requirement | Accepted Formats | Max Size |
|----------|-----------------|-------------------|-----------------|----------|
| Business license (ERC) | Giấy đăng ký kinh doanh | Decree 85/2021 (MOIT), E-Commerce Law 2025 | PDF, JPG, PNG | 10 MB |
| Transport license | Giấy phép kinh doanh vận tải | Decree 10/2020 (MoT) | PDF, JPG, PNG | 10 MB |
| Passenger insurance | Bảo hiểm hành khách | Decree 03/2021 (amended 67/2023) | PDF, JPG, PNG | 10 MB |
| Route authorization | Giấy phép tuyến đường | Provincial transport dept | PDF, JPG, PNG | 10 MB |

```
+----------------------------------------------------------+
|  Bước 2: Giấy tờ pháp lý                                |
|                                                          |
|  Giấy đăng ký kinh doanh *                              |
|  ┌──────────────────┐                                    |
|  │  + Kéo thả hoặc  │  Định dạng: PDF, JPG, PNG         |
|  │    chọn tệp      │  Tối đa: 10 MB                    |
|  └──────────────────┘                                    |
|  ✓ business_license.pdf (2.3 MB) — Đã tải lên           |
|                                                          |
|  Giấy phép kinh doanh vận tải *                          |
|  ┌──────────────────┐                                    |
|  │  + Kéo thả hoặc  │                                    |
|  │    chọn tệp      │                                    |
|  └──────────────────┘                                    |
|                                                          |
|  Bảo hiểm hành khách *                                   |
|  ┌──────────────────┐                                    |
|  │  + Kéo thả hoặc  │                                    |
|  │    chọn tệp      │                                    |
|  └──────────────────┘                                    |
|                                                          |
|  Giấy phép tuyến đường (tùy chọn)                       |
|  ┌──────────────────┐                                    |
|  │  + Kéo thả hoặc  │                                    |
|  │    chọn tệp      │                                    |
|  └──────────────────┘                                    |
|                                                          |
|  [ ← Quay lại ]              [ Tiếp tục → ]             |
+----------------------------------------------------------+
```

**Upload behavior:**

- Drag-and-drop or file picker.
- Upload progress bar with percentage.
- On successful upload: checkmark icon + filename + file size.
- On failure: red icon + "Tải lên thất bại. Vui lòng thử lại" with retry button.
- Files stored via `StoredObject` with `purpose: 'kyb_document'`.

### 4.5 Step 3: Bank Account

| Field | Required | Validation | Vietnamese Label |
|-------|----------|------------|-----------------|
| Bank name | Yes | Dropdown of Vietnamese banks | Ngân hàng |
| Account number | Yes | 6--20 digits | Số tài khoản |
| Account holder name | Yes | Must match business registration name | Tên chủ tài khoản |

```
+----------------------------------------------------------+
|  Bước 3: Thông tin ngân hàng                             |
|                                                          |
|  Ngân hàng: [▾ Vietcombank____________]                 |
|  Số tài khoản: [0071001234567_________]                 |
|  Tên chủ tài khoản: [CONG TY TNHH XE KHACH PT]         |
|                                                          |
|  ⓘ Tên chủ tài khoản phải trùng với tên trên            |
|    giấy đăng ký kinh doanh.                              |
|                                                          |
|  [ ← Quay lại ]              [ Tiếp tục → ]             |
+----------------------------------------------------------+
```

### 4.6 Step 4: E-Invoice Authorization

| Field | Required | Validation | Vietnamese Label |
|-------|----------|------------|-----------------|
| MISA customer code | Yes | Alphanumeric | Mã khách hàng MISA |
| MISA API key | Yes | Non-empty | Khóa API MISA |
| Authorization confirmation | Yes | Checkbox | Xác nhận ủy quyền |

```
+----------------------------------------------------------+
|  Bước 4: Ủy quyền hóa đơn điện tử                      |
|                                                          |
|  Nền tảng sẽ phát hành hóa đơn điện tử thay mặt        |
|  nhà xe theo Nghị định 123/2020 Điều 17.                |
|                                                          |
|  Mã khách hàng MISA: [________________]                 |
|  Khóa API MISA: [________________]                      |
|                                                          |
|  ☐ Tôi xác nhận ủy quyền cho nền tảng phát hành        |
|    hóa đơn điện tử thay mặt nhà xe, hiển thị tên       |
|    và MST của nhà xe trên hóa đơn.                      |
|                                                          |
|  [ ← Quay lại ]              [ Tiếp tục → ]             |
+----------------------------------------------------------+
```

### 4.7 Step 5: Review & Submit

```
+----------------------------------------------------------+
|  Bước 5: Xác nhận và nộp hồ sơ                          |
|                                                          |
|  Thông tin doanh nghiệp                                 |
|  ┌────────────────────────────────────────────────┐      |
|  │  Tên: Công Ty TNHH Xe Khách Phương Trang      │      |
|  │  MST: 0312345678                               │      |
|  │  Tỉnh: TP. Hồ Chí Minh                        │      |
|  │  Loại hình: Doanh nghiệp            [Sửa ✎]  │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  Giấy tờ pháp lý                                        |
|  ┌────────────────────────────────────────────────┐      |
|  │  ✓ Giấy đăng ký kinh doanh                    │      |
|  │  ✓ Giấy phép vận tải                          │      |
|  │  ✓ Bảo hiểm hành khách             [Sửa ✎]  │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  Ngân hàng                                               |
|  ┌────────────────────────────────────────────────┐      |
|  │  Vietcombank - 0071001234567                   │      |
|  │  CONG TY TNHH XE KHACH PT          [Sửa ✎]  │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  Hóa đơn điện tử                                        |
|  ┌────────────────────────────────────────────────┐      |
|  │  MISA: Đã kết nối                  [Sửa ✎]  │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ ← Quay lại ]              [ Nộp hồ sơ ]              |
+----------------------------------------------------------+
```

Each section has an "Sua" (edit) link that navigates back to the relevant step. The "Nop ho so" button submits the complete KYB application and transitions the operator to `PENDING_REVIEW`.

---

## 5. KYB Status Display

### 5.1 Persistent Banner

A persistent banner appears at the top of all operator console pages showing the current approval status:

| Operator Status | Banner Style | Vietnamese Text | CTA |
|----------------|-------------|-----------------|-----|
| `PENDING_REVIEW` | Amber background | Hồ sơ đang chờ xét duyệt | -- |
| `UNDER_REVIEW` | Blue background | Hồ sơ đang được xem xét | -- |
| `APPROVED` | No banner | -- | -- |
| `REJECTED` | Red background | Hồ sơ bị từ chối -- Lý do: [reason] | Nộp lại |
| `SUSPENDED` | Red background | Tài khoản bị tạm ngưng. Liên hệ hỗ trợ: support@busbooking.vn | -- |

### 5.2 Banner Layout (Rejected Example)

```
+----------------------------------------------------------+
|  ⚠ Hồ sơ bị từ chối                                     |
|  Lý do: Giấy phép vận tải đã hết hạn.                   |
|  Vui lòng cập nhật giấy tờ và nộp lại.                  |
|                                              [ Nộp lại ] |
+----------------------------------------------------------+
```

### 5.3 Capability Restrictions

While not `APPROVED`, certain console features are restricted:

| Capability | PENDING_REVIEW | UNDER_REVIEW | REJECTED | SUSPENDED |
|-----------|---------------|-------------|----------|-----------|
| Login | Yes | Yes | Yes | Yes |
| View dashboard | Yes (empty state) | Yes (empty state) | Yes (empty state) | Yes (read-only) |
| Create buses/routes/trips | No | No | No | No |
| Appear in search | No | No | No | No |
| Sell tickets | No | No | No | No |
| Edit KYB / resubmit | Yes (if not yet submitted) | No | Yes | No |

---

## 6. Resubmission Flow

### 6.1 Trigger

When an operator is in `REJECTED` status, clicking "Nộp lại" in the banner navigates to the KYB wizard with previously submitted data pre-filled. The rejection reason is displayed at the top of the wizard.

### 6.2 Editable Fields

Only fields related to the rejection reason should need updating, but all fields remain editable for convenience. Previously uploaded documents that were not rejected remain in place -- only the rejected documents need re-uploading.

### 6.3 Post-Resubmission

On resubmission:
- Operator status transitions from `REJECTED` back to `PENDING_REVIEW`.
- The rejection reason is cleared.
- Admin receives notification of resubmission.
- The banner updates to the amber "Ho so dang cho xet duyet" state.

---

## 7. License Expiry Alert

### 7.1 60-Day Warning

When a transport license expiry date is within 60 days, a warning banner appears:

```
+----------------------------------------------------------+
|  ⚠ Giấy phép vận tải sẽ hết hạn vào DD/MM/YYYY         |
|  (còn X ngày). Vui lòng cập nhật giấy phép mới.         |
|                                            [ Cập nhật ]  |
+----------------------------------------------------------+
```

### 7.2 Expiry Behavior

| Days to Expiry | Banner Style | Action |
|----------------|-------------|--------|
| > 60 days | No banner | -- |
| 30--60 days | Amber warning | "Cập nhật" link to document upload |
| 7--30 days | Red warning | Same link, more urgent copy |
| Expired | Red banner, console features restricted | Operator cannot create new trips |

---

## 8. Progress Indicator

### 8.1 KYB Checklist

On the operator dashboard (when KYB is in progress), a checklist widget shows completion status:

```
+----------------------------------------------------------+
|  Hoàn tất hồ sơ KYB                                     |
|                                                          |
|  ✓ Thông tin doanh nghiệp                               |
|  ✓ Giấy tờ pháp lý                                      |
|  ○ Thông tin ngân hàng                                   |
|  ○ Ủy quyền hóa đơn điện tử                             |
|  ○ Xác nhận và nộp                                       |
|                                                          |
|  Tiến độ: 2/5 bước                    [ Tiếp tục → ]    |
+----------------------------------------------------------+
```

### 8.2 Step Status Icons

| Status | Icon | Meaning |
|--------|------|---------|
| Completed | Filled checkmark (green) | Step data saved successfully |
| Current | Empty circle with highlight | Step in progress |
| Pending | Empty circle (gray) | Not yet started |
| Error | Red exclamation | Validation errors on this step |

---

## 9. Error States

| Error | Vietnamese Message | Context |
|-------|--------------------|---------|
| MST format invalid | MST phải gồm 10 hoặc 13 chữ số | Step 1 validation |
| Document upload failed | Tải lên thất bại. Vui lòng thử lại | Step 2 upload |
| File too large | Tệp quá lớn (tối đa 10 MB) | Step 2 upload |
| Invalid file format | Chỉ chấp nhận PDF, JPG, PNG | Step 2 upload |
| Bank account mismatch | Tên chủ tài khoản không trùng với tên doanh nghiệp | Step 3 warning (soft) |
| MISA connection failed | Không thể kết nối MISA. Vui lòng kiểm tra thông tin | Step 4 validation |
| Network error | Không thể kết nối. Vui lòng thử lại | Any step |

---

## 10. Responsive Behavior

| Viewport | Wizard Layout | Banner |
|----------|--------------|--------|
| Mobile (< 768px) | Vertical stepper, full-width steps, bottom nav | Full-width, stacked CTA |
| Tablet (768--1024px) | Horizontal stepper, centered content (640px max) | Full-width |
| Desktop (> 1024px) | Horizontal stepper, two-column layout (form left, preview right) | Full-width |

---

## 11. Cross-References

| Document | Relevance |
|----------|-----------|
| business/domain-model/state-machines.md | Operator approval lifecycle (Section 5): PENDING_REVIEW, UNDER_REVIEW, APPROVED, REJECTED, SUSPENDED |
| business/regulatory/README.md | Consolidated operator onboarding document requirements |
| business/regulatory/transport.md | Transport license, route authorization, passenger insurance requirements |
| business/personas/operator-personas.md | Persona tech literacy levels, onboarding friction concerns |
| ADR-014 (E-Invoice & Compliance) | E-invoice authorization model (D1), tax withholding by entity type (D4) |
| ADR-010 (Booking Lifecycle) | First-login password gate (Mistake Log Issue 010) |
| DS-012 (Transport E-Invoice Fields) | MISA integration, operator MST requirement |
| regulatory/einvoice-tax.md | Decree 123/2020 Art. 17 third-party e-invoice authorization |
| regulatory/compliance-timeline.md | Week-by-week onboarding dependencies |
