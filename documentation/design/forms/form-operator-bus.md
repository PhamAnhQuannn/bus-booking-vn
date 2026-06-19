---
form: operator-bus
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/operator-fleet.md
endpoint: POST /api/op/buses → PATCH /api/op/buses/[id]
---

# Form: Operator — Bus Create / Edit (+ Maintenance)

Operator-scoped fleet CRUD. Two modes share one form shell: create (POST, all fields)
and edit (PATCH, partial — refine "at least one of licensePlate / capacity / busType").
Maintenance windows are a sub-form on the bus detail. Field is `licensePlate` (NOT
plateNumber). Operator IS the authority — no client-price concern here.

## Fields — Bus

| Mode | Name | Type | Required | Default | Notes |
|------|------|------|----------|---------|-------|
| create | licensePlate | text | yes | — | 6–11, `/^[A-Za-z0-9.\- ]+$/`, uppercased server-side |
| create | capacity | number | yes | — | int 1–80 |
| create | busType | select | yes | — | coach \| sleeper \| limousine |
| edit | licensePlate | text | no | current | same rule; ≥1 of 3 required |
| edit | capacity | number | no | current | int 1–80; ≥1 of 3 required |
| edit | busType | select | no | current | enum; ≥1 of 3 required |

## Fields — Maintenance (sub-form, CreateMaintenanceSchema)

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| startAt | datetime-local | yes | — | must be in the future |
| endAt | datetime-local | yes | — | must be after startAt |
| reason | textarea | no | — | max 500 |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| licensePlate | len 6–11 | on-blur | "Biển số phải có từ 6 đến 11 ký tự" |
| licensePlate | `/^[A-Za-z0-9.\- ]+$/` | on-blur | "Biển số chứa ký tự không hợp lệ" |
| capacity | int 1–80 | on-blur | "Sức chứa phải từ 1 đến 80 chỗ" |
| busType | enum | on-submit | "Vui lòng chọn loại xe" |
| edit (any) | ≥1 of 3 present | on-submit | "Vui lòng thay đổi ít nhất một thông tin" |
| startAt | future | on-blur | "Thời gian bắt đầu phải ở tương lai" |
| endAt | > startAt | on-blur | "Thời gian kết thúc phải sau thời gian bắt đầu" |
| reason | max 500 | on-change (counter) | "Lý do không được vượt quá 500 ký tự" |

Server (Issue 011 status codes): 422 PLATE_IN_USE → "Biển số này đã được sử dụng."
(inline under licensePlate); 422 CAPACITY_REDUCTION_BLOCKED → "Không thể giảm sức
chứa: đã có ghế được đặt vượt mức mới." (inline under capacity); 422
FUTURE_TRIPS_ASSIGNED → "Không thể vô hiệu hóa: xe còn chuyến trong tương lai."
(banner, on deactivate); 409 MAINTENANCE_OVERLAP → "Lịch bảo trì trùng với khoảng
đã có." (inline under startAt). Generic → "Có lỗi xảy ra. Vui lòng thử lại."

## Error Placement

- Inline below each field (format + the field-specific server codes above).
- Banner (`role="alert"`) for FUTURE_TRIPS_ASSIGNED (deactivate action) + generic.
- Summary block on submit-fail with ≥2 inline errors, links to each field.
- Success: toast "Đã lưu xe" (server-confirmed write) + list refresh; no inline.

## Submit States

```
idle ──submit──▶ submitting ──ok(200/201)──▶ success (toast, close panel, refresh list)
                     │
                     └──err──▶ error (re-enable, announce, focus first error field)
```

| State | Create label | Edit label | Enabled | Spinner |
|-------|--------------|------------|---------|---------|
| idle | "Thêm xe" | "Lưu thay đổi" | yes | no |
| submitting | "Đang lưu..." | "Đang lưu..." | no | yes |
| error | "Thêm xe" | "Lưu thay đổi" | yes | no |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input/select | `<label for>` + `aria-describedby="X-hint X-err"` + `aria-required` + `aria-invalid` |
| busType select | base-ui Select (MISSING primitive — build); native fallback `<select>` |
| reason counter | `aria-live="polite"` remaining-chars; not color-only |
| banner | `role="alert" aria-live="assertive"` |
| submit-fail | focus → first error field; summary announced assertive |

## Open Questions

- Deactivate vs delete bus: deactivate (soft) only in MVP; hard-delete out of scope.
- Maintenance edit/cancel after create? Create + list only in MVP.

## Out of Scope

- Seat-map layout editor (capacity is a scalar; per-seat layout deferred).
- Route / trip / staff (separate files; same operator console).
