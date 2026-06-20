# DS-036 -- FD-019: Consent, Privacy & PDPL Compliance

## 1. Overview

Privacy and consent management UI for the BusBooking platform, implementing Vietnam's Personal Data Protection Law (PDPL 2025, No. 91/2025/QH15) and its implementing decree (Decree 356/2025/ND-CP). This is a legal launch gate -- the platform cannot process personal data without compliant consent collection, a published privacy policy, and a functional DSAR (Data Subject Access Request) self-service portal.

**Scope**: Customer-facing consent banner, registration consent, preference center, privacy policy page, DSAR portal, and DPO contact display. Admin DSAR management UI is out of scope.

---

## 2. Consent Banner

### 2.1 Trigger

The consent banner appears on first visit (no consent records exist for the session/customer). It is a persistent bottom bar (not a modal) that does not block page interaction but remains visible until the user takes action.

### 2.2 Layout

```
+------------------------------------------------------------------+
|  Chúng tôi sử dụng dữ liệu cá nhân của bạn để cung cấp dịch    |
|  vụ đặt vé xe. Bạn có thể quản lý tùy chọn quyền riêng tư.     |
|                                                                    |
|  [ Chấp nhận tất cả ]  [ Từ chối tất cả ]  [ Tùy chỉnh ]       |
+------------------------------------------------------------------+
```

### 2.3 "Tuy chinh" (Manage Preferences) Expanded View

Clicking "Tuy chinh" expands the banner or opens a panel with per-purpose toggles:

| Purpose | Vietnamese Label | Default State | Withdrawable |
|---------|-----------------|---------------|-------------|
| `booking_processing` | Xử lý đặt vé | Always on (non-toggleable) | No (service-required) |
| `payment_processing` | Xử lý thanh toán | Always on (non-toggleable) | No (service-required) |
| `marketing_sms` | Tin nhắn quảng cáo (SMS) | Off | Yes |
| `marketing_email` | Email quảng cáo | Off | Yes |
| `analytics` | Phân tích sử dụng | Off | Yes |
| `third_party_sharing` | Chia sẻ với đối tác | Off | Yes |

**PDPL Art. 9 compliance:**

- No pre-ticked boxes. All optional toggles default to OFF.
- Service-required purposes (`booking_processing`, `payment_processing`) are shown as always-on with a lock icon and explanation: "Cần thiết để cung cấp dịch vụ đặt vé. Bạn có thể rút lại bằng cách xóa tài khoản."
- Each purpose has a plain-language description visible below the toggle (expandable on mobile).

### 2.4 Per-Purpose Descriptions

| Purpose | Description (Vietnamese) |
|---------|-------------------------|
| `booking_processing` | Chúng tôi xử lý họ tên, số điện thoại và thông tin chuyến đi để hoàn tất đặt vé. |
| `payment_processing` | Chúng tôi chia sẻ số điện thoại với đối tác thanh toán (MoMo, VNPay) để xử lý giao dịch. |
| `marketing_sms` | Gửi tin nhắn SMS về khuyến mãi và ưu đãi. Bạn có thể hủy bất kỳ lúc nào. |
| `marketing_email` | Gửi email về khuyến mãi, chuyến xe mới và thông tin hữu ích. Bạn có thể hủy bất kỳ lúc nào. |
| `analytics` | Thu thập dữ liệu ẩn danh về cách bạn sử dụng trang web để cải thiện dịch vụ. |
| `third_party_sharing` | Chia sẻ thông tin cá nhân với đối tác phân phối vé. |

### 2.5 Button Behavior

| Button | Action |
|--------|--------|
| Chấp nhận tất cả | Grants consent for ALL purposes (including optional). Creates `ConsentRecord` rows for each purpose with `granted: true`. |
| Từ chối tất cả | Grants consent for service-required purposes only. Creates `ConsentRecord` rows with `granted: false` for optional purposes, `granted: true` for required. |
| Lưu tùy chọn (in expanded view) | Saves the specific toggle states. Creates `ConsentRecord` rows per the selected values. |

### 2.6 Consent Record Storage

Each consent action creates immutable `ConsentRecord` rows (one per purpose):

| Field | Value |
|-------|-------|
| `customerId` | Current customer ID (or session ID for anonymous, linked on registration) |
| `purpose` | Consent purpose enum |
| `granted` | `true` or `false` |
| `ipAddress` | Request IP |
| `userAgent` | Browser user agent string |
| `createdAt` | Timestamp |

Records are append-only -- withdrawing consent creates a new `ConsentRecord` with `granted: false`, never mutates existing rows.

---

## 3. Consent at Registration

### 3.1 Registration Form Inline Consent

During phone+OTP registration (`/register`), consent checkboxes appear below the registration fields:

```
+----------------------------------------------------------+
|  Đăng ký tài khoản                                       |
|                                                          |
|  Số điện thoại: +84 901 234 567  ✓ Đã xác minh          |
|  Họ tên: [________________]                              |
|  Email (tùy chọn): [________________]                    |
|                                                          |
|  ┌────────────────────────────────────────────────┐      |
|  │  Đồng ý xử lý dữ liệu:                       │      |
|  │                                                │      |
|  │  ✓ Xử lý đặt vé và thanh toán (bắt buộc)     │      |
|  │  ☐ Nhận tin nhắn SMS quảng cáo                │      |
|  │  ☐ Nhận email quảng cáo                       │      |
|  │  ☐ Phân tích sử dụng                          │      |
|  │  ☐ Chia sẻ dữ liệu với đối tác               │      |
|  │                                                │      |
|  │  Xem Chính sách bảo mật [link]                │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ Đăng ký ]                                             |
+----------------------------------------------------------+
```

- Service-required consent is shown as a checked, disabled checkbox with "(bắt buộc)" label.
- Optional consents are unchecked by default.
- Link to privacy policy opens `/privacy` in a new tab.

---

## 4. Consent Preference Center

### 4.1 Location

Accessible from `/account/settings` under a "Quyền riêng tư" (Privacy) section. Also linked from the consent banner's "Tùy chỉnh" action.

### 4.2 Layout

```
+----------------------------------------------------------+
|  Cài đặt quyền riêng tư                                 |
|                                                          |
|  Mục đích bắt buộc                                      |
|  ┌────────────────────────────────────────────────┐      |
|  │  Xử lý đặt vé          [Luôn bật] 🔒          │      |
|  │  Cần thiết để cung cấp dịch vụ đặt vé.        │      |
|  │  Để ngừng xử lý, vui lòng xóa tài khoản.     │      |
|  │                                                │      |
|  │  Xử lý thanh toán      [Luôn bật] 🔒          │      |
|  │  Cần thiết để xử lý thanh toán vé xe.         │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  Mục đích tùy chọn                                      |
|  ┌────────────────────────────────────────────────┐      |
|  │  SMS quảng cáo         [toggle: ON/OFF]        │      |
|  │  Đã đồng ý: 15/01/2026                        │      |
|  │                                                │      |
|  │  Email quảng cáo       [toggle: ON/OFF]        │      |
|  │  Chưa đồng ý                                  │      |
|  │                                                │      |
|  │  Phân tích sử dụng     [toggle: ON/OFF]        │      |
|  │  Đã đồng ý: 15/01/2026                        │      |
|  │                                                │      |
|  │  Chia sẻ với đối tác   [toggle: ON/OFF]        │      |
|  │  Chưa đồng ý                                  │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  [ Lưu thay đổi ]                                       |
+----------------------------------------------------------+
```

### 4.3 Toggle Behavior

- Toggling OFF fires `POST /api/customers/me/consent/withdraw` with `{ purpose }`.
- Toggling ON fires a consent grant (new `ConsentRecord` with `granted: true`).
- Each toggle shows the date of last consent action ("Da dong y: DD/MM/YYYY" or "Chua dong y").
- Service-required toggles show a lock icon and cannot be toggled; the explanation directs to account deletion.

---

## 5. Privacy Policy Page

### 5.1 Route

`/privacy` -- publicly accessible, no authentication required.

### 5.2 Language

Vietnamese language (primary). The page must use proper diacritics throughout.

### 5.3 Required Sections (PDPL 2025)

| Section | Vietnamese Heading | Content |
|---------|-------------------|---------|
| 1 | Giới thiệu | Platform identity, DPO contact, policy effective date |
| 2 | Dữ liệu thu thập | Categories: identity (phone, name, email), booking data (routes, dates), payment data (transaction IDs -- no card numbers stored), device data (IP, user agent) |
| 3 | Mục đích xử lý | Mapping of each data category to processing purpose(s) |
| 4 | Thời gian lưu trữ | Retention periods per data tier: T1 Operational (24 months post-deletion), T2 Compliance (5 years), T3 Financial (10 years for ledger/invoice) |
| 5 | Chia sẻ với bên thứ ba | Third-party data sharing inventory: eSMS (phone for OTP/SMS), Resend (email for notifications), MISA (booking details for e-invoice), VNPay/MoMo (phone for payment), FPT Cloud (hosting) |
| 6 | Quyền của bạn | Data subject rights: access, correction, deletion, consent withdrawal, objection to processing. Response deadlines per PDPL: Access 10 days, Correction 10 days, Deletion 20 days, Consent withdrawal 15 days |
| 7 | Chuyển dữ liệu ra nước ngoài | Cross-border transfer disclosure (if applicable): which processors, which countries, CDTIA filing status |
| 8 | Bảo mật dữ liệu | Security measures: encryption at rest and in transit, access controls, breach notification (72-hour MPS, 24-hour for financial data breaches) |
| 9 | Liên hệ DPO | DPO name/title, email, phone, mailing address |
| 10 | Cập nhật chính sách | How policy updates are communicated; version history |

### 5.4 Formatting

- Table of contents with anchor links at the top.
- Each section uses clear headings and bullet points.
- Legal terms are explained in plain Vietnamese (avoid legalistic phrasing).
- Last updated date prominently displayed: "Cập nhật lần cuối: DD/MM/YYYY".

---

## 6. DSAR Self-Service Portal

### 6.1 Location

Accessible from `/account/settings` under a "Quyền dữ liệu" (Data Rights) section.

### 6.2 Request Types

| Request Type | Vietnamese Label | Statutory Deadline | Description |
|-------------|-----------------|-------------------|-------------|
| `ACCESS` / `EXPORT` | Yêu cầu truy cập / xuất dữ liệu | 10 ngày | Download all personal data in JSON format |
| `RECTIFICATION` | Yêu cầu chỉnh sửa | 10 ngày | Correct inaccurate personal data |
| `DELETION` | Yêu cầu xóa dữ liệu | 20 ngày | Delete account and personal data |
| `CONSENT_WITHDRAWAL` | Rút lại đồng ý | 15 ngày | Withdraw consent for specific purpose |

### 6.3 Submission Form

```
+----------------------------------------------------------+
|  Yêu cầu quyền dữ liệu                                 |
|                                                          |
|  Loại yêu cầu:                                          |
|  ┌────────────────────────────────────┐                  |
|  │ ○ Truy cập / Xuất dữ liệu        │                  |
|  │ ○ Chỉnh sửa thông tin             │                  |
|  │ ○ Xóa tài khoản                   │                  |
|  │ ○ Rút lại đồng ý                  │                  |
|  └────────────────────────────────────┘                  |
|                                                          |
|  Lý do (tùy chọn):                                      |
|  [________________________________]                      |
|                                                          |
|  [ Gửi yêu cầu ]                                        |
+----------------------------------------------------------+
```

**Rate limit**: Maximum 3 DSAR submissions per customer per 30-day period. If exceeded: "Bạn đã gửi tối đa 3 yêu cầu trong 30 ngày. Vui lòng thử lại sau."

### 6.4 Status Tracking

After submission, the request appears in a "Yêu cầu của tôi" list:

```
+----------------------------------------------------------+
|  Yêu cầu của tôi                                        |
|                                                          |
|  ┌────────────────────────────────────────────────┐      |
|  │  #1  Xuất dữ liệu                             │      |
|  │  Trạng thái: Đang xử lý                       │      |
|  │  Ngày gửi: 15/06/2026                          │      |
|  │  Hạn xử lý: 25/06/2026 (còn 8 ngày)          │      |
|  └────────────────────────────────────────────────┘      |
|                                                          |
|  ┌────────────────────────────────────────────────┐      |
|  │  #2  Rút lại đồng ý (SMS quảng cáo)          │      |
|  │  Trạng thái: Hoàn thành ✓                     │      |
|  │  Ngày gửi: 10/06/2026                          │      |
|  │  Hoàn thành: 10/06/2026                        │      |
|  └────────────────────────────────────────────────┘      |
+----------------------------------------------------------+
```

### 6.5 Deadline Countdown

Each pending request shows a countdown to the statutory deadline:

| Days Remaining | Display | Color |
|---------------|---------|-------|
| > 5 days | "còn X ngày" | Default text |
| 3--5 days | "còn X ngày" | Amber/warning |
| 1--2 days | "còn X ngày" | Red/urgent |
| Overdue | "Quá hạn X ngày" | Red with alert icon |

### 6.6 Export Download

When an export request is completed:

- A "Tải xuống" (Download) button appears on the request card.
- The download link is a 7-day signed URL to the JSON export file.
- After 7 days, the link expires: "Liên kết tải xuống đã hết hạn. Vui lòng gửi yêu cầu mới."
- Notification sent via SMS/email when export is ready.

### 6.7 Account Deletion Flow

Selecting "Xoa tai khoan" opens a dedicated confirmation flow:

```
+----------------------------------------------------------+
|  ⚠ Xóa tài khoản                                        |
|                                                          |
|  Bạn sắp yêu cầu xóa tài khoản và tất cả dữ liệu     |
|  cá nhân. Hành động này không thể hoàn tác.              |
|                                                          |
|  Lưu ý:                                                  |
|  • Lịch sử đặt vé sẽ bị xóa                            |
|  • Vé đã mua cho chuyến sắp tới vẫn có hiệu lực        |
|  • Hồ sơ tài chính được lưu giữ 10 năm (quy định       |
|    pháp luật)                                            |
|  • Bạn có 72 giờ để hủy yêu cầu này                    |
|                                                          |
|  Nhập "XÓA" để xác nhận:                                |
|  [________________]                                      |
|                                                          |
|  [ Hủy ]              [ Xóa tài khoản ]                 |
+----------------------------------------------------------+
```

**72-hour confirmation window:**

- After submission, the account enters a 72-hour cooling-off period.
- During this period, a banner appears on login: "Tài khoản sẽ bị xóa vào DD/MM/YYYY lúc HH:MM. [Hủy yêu cầu xóa]"
- If the customer cancels within 72 hours, the deletion request is voided.
- After 72 hours, the deletion proceeds (soft-delete + anonymization scheduling).
- Paid bookings for upcoming trips are NOT cancelled -- the customer can still travel.

---

## 7. DPO Contact Display

### 7.1 Locations

The DPO contact information must be accessible from:

| Location | Display |
|----------|---------|
| Privacy policy page (`/privacy`) | Full section with name/title, email, phone, address |
| Account settings > Quyền dữ liệu | Link: "Liên hệ Cán bộ bảo vệ dữ liệu" with email and phone |
| Footer (all pages) | "Bảo mật dữ liệu: [email]" link |

### 7.2 Contact Format

```
Cán bộ bảo vệ dữ liệu cá nhân (DPO)
Email: dpo@busbooking.vn
Điện thoại: [phone number]
```

---

## 8. Consent Withdrawal Consequences

When a customer withdraws consent for an optional purpose, the UI must confirm the consequence:

| Purpose | Consequence Message |
|---------|-------------------|
| `marketing_sms` | Bạn sẽ không nhận tin nhắn quảng cáo nữa. Tin nhắn đặt vé và OTP không bị ảnh hưởng. |
| `marketing_email` | Bạn sẽ không nhận email quảng cáo nữa. Email xác nhận đặt vé không bị ảnh hưởng. |
| `analytics` | Dữ liệu sử dụng ẩn danh sẽ không được thu thập. |
| `third_party_sharing` | Thông tin cá nhân sẽ không được chia sẻ với đối tác phân phối. |

Attempting to withdraw service-required consent returns HTTP 422 with message: "Không thể rút lại đồng ý xử lý bắt buộc. Để ngừng tất cả xử lý, vui lòng yêu cầu xóa tài khoản."

---

## 9. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Consent toggles | Standard `<input type="checkbox">` with `role="switch"` for screen readers; disabled state announced |
| Banner keyboard navigation | Tab-navigable; Escape does not dismiss (consent is required action) |
| Privacy policy | Proper heading hierarchy (`<h1>` through `<h3>`); link targets announced |
| DSAR form | Form labels associated via `<label for>`; error messages via `aria-describedby` |

---

## 10. Cross-References

| Document | Relevance |
|----------|-----------|
| DS-015 (DSAR & Privacy API) | DSAR data model, export bundle format, deletion flow, anonymization cron |
| ADR-014 (E-Invoice & Compliance) | PDPL 2025 obligations, DPO appointment (D6), consent model (D7), retention tiers |
| ADR-008 (Security Posture) | Data classification, PII handling, consent architecture |
| PDPL 2025 (No. 91/2025/QH15) | Art. 9 (consent), Art. 10 (rectification), Art. 11 (erasure), Art. 12 (portability) |
| Decree 356/2025/ND-CP | PDPL implementation: DPIA, CDTIA, consent forms, DPO requirements |
| Consumer Protection Law 2023 | Art. 37--39 (platform liability for data handling) |
| regulatory/data-privacy.md | PDPL compliance actions, CDTIA filing status, VN cloud migration |
| regulatory/compliance-timeline.md | DPIA filing deadline (60 days), DPO appointment timeline |
