---
form: operator-staff
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/operator-staff.md
endpoint: POST /api/op/staff → PATCH /api/op/staff/[id]; disable; assign-service
---

# Form: Operator — Staff Create / Edit / Disable / Assign

Operator-scoped staff CRUD. Create seeds an OperatorUser (role=staff) with a temp
password (SMS template `operatorAdminTempPassword`). PATCH is name-only — role is
immutable. `contactPhone == notificationPhone` is allowed (phones-differ CHECK dropped
Issue 020 — staff is one person). Assign-service links staff to a trip.

## Forms & Endpoints

| Form | Endpoint | Schema |
|------|----------|--------|
| Create | POST /api/op/staff | CreateStaffSchema { name, phone } |
| Edit name | PATCH /api/op/staff/[id] | UpdateStaffSchema { name } only |
| Disable | POST /api/op/staff/[id]/disable | — (confirm Dialog) |
| Assign service | POST /api/op/staff/[id]/assign | AssignServiceSchema { tripId } |

## Fields

| Form | Name | Type | Required | Default | Notes |
|------|------|------|----------|---------|-------|
| create | name | text | yes | — | DISPLAY_NAME 1–120 |
| create | phone | tel | yes | — | VN phone; becomes login phone |
| edit | name | text | yes | current | 1–120 (role NOT editable) |
| assign | tripId | select | yes | — | operator's upcoming trips |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| name | len 1–120 | on-blur | "Tên phải có từ 1 đến 120 ký tự" |
| phone | VN phone refine | on-blur | "invalid VN phone number" |
| tripId | present | on-submit | "Vui lòng chọn chuyến" |

Server: 422 PHONE_TAKEN → "Số điện thoại này đã được sử dụng." (inline under phone,
generic non-enumerating); 409 ALREADY_ASSIGNED → "Nhân viên đã được phân công chuyến
này." (banner); generic → "Có lỗi xảy ra. Vui lòng thử lại."

## Error Placement

- Inline below each field (format + PHONE_TAKEN under phone).
- Banner (`role="alert"`) for ALREADY_ASSIGNED + generic.
- Disable: destructive confirm Dialog (no extra fields) — "Vô hiệu hóa nhân viên này?
  Họ sẽ không thể đăng nhập." banner inside Dialog on error.
- Success: toast (create "Đã thêm nhân viên — mật khẩu tạm đã gửi qua SMS" / disable
  "Đã vô hiệu hóa" / assign "Đã phân công") + list refresh.

## Submit States

```
idle ──submit──▶ submitting ──ok──▶ success (toast, refresh)
                     │
                     └──err──▶ error (re-enable, announce, focus first error)
disable ──confirm Dialog──▶ submitting ──ok──▶ success (row → disabled)
                                │
                                └──err──▶ error (banner in Dialog)
```

| Form | idle label | submitting label |
|------|------------|------------------|
| create | "Thêm nhân viên" | "Đang thêm..." |
| edit | "Lưu" | "Đang lưu..." |
| disable | "Vô hiệu hóa" (destructive) | "Đang xử lý..." |
| assign | "Phân công" | "Đang phân công..." |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input/select | `<label for>` + `aria-describedby="X-err"` + `aria-required` + `aria-invalid` |
| phone | `inputmode="tel"` |
| tripId select | base-ui Select (MISSING — build) |
| disable Dialog | focus trap, Esc closes, `role="dialog" aria-modal="true"` |
| banner | `role="alert" aria-live="assertive"` |
| submit-fail | focus → first error field |

## Open Questions

- Re-enable a disabled staff member? Disable is one-way in MVP; re-enable deferred.
- Resend temp password from staff row? Out of MVP (admin CLI path exists, Issue 020).

## Out of Scope

- Role assignment / RBAC beyond staff (role immutable, no admin-role grant in UI).
- Bus / route / trip (separate files; same operator console).
