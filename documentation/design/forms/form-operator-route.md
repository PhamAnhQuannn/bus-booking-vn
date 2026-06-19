---
form: operator-route
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/operator-routes.md
endpoint: POST /api/op/routes → PATCH /api/op/routes/[id]; pickup-points sub-CRUD
---

# Form: Operator — Route Create / Edit (+ Pickup Points)

Operator-scoped route CRUD plus a pickup-point sub-form with drag-reorder. Route =
origin + destination + durationMinutes. Pickup points are an ordered child list
(create / bulk-reorder). No price on Route (price lives on Trip).

## Fields — Route (routeCreateSchema)

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| origin | text | yes | — | 1–120 |
| destination | text | yes | — | 1–120 |
| durationMinutes | number | yes | — | int 1–7200 (≤120h) |

## Fields — Pickup Point (pickupPointCreateSchema)

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| name | text | yes | — | 1–120 |
| address | text | yes | — | 1–500 |
| displayOrder | number | no | append | int min 1 |

Reorder: `bulkReorderSchema` { orderedIds: cuid[] 1–50 } — drag-and-drop persists the
new order in one PATCH.

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| origin | len 1–120 | on-blur | "Điểm đi phải có từ 1 đến 120 ký tự" |
| destination | len 1–120 | on-blur | "Điểm đến phải có từ 1 đến 120 ký tự" |
| durationMinutes | int 1–7200 | on-blur | "Thời lượng phải từ 1 đến 7200 phút" |
| pickup.name | len 1–120 | on-blur | "Tên điểm đón phải có từ 1 đến 120 ký tự" |
| pickup.address | len 1–500 | on-blur | "Địa chỉ phải có từ 1 đến 500 ký tự" |
| pickup.displayOrder | int ≥1 | on-blur | "Thứ tự hiển thị phải là số nguyên ≥ 1" |
| orderedIds | array cuid 1–50 | on-submit (reorder) | "Danh sách sắp xếp không hợp lệ" |

Server: 422 VALIDATION (field map as above); generic → "Có lỗi xảy ra. Vui lòng thử
lại." Reorder conflict (stale ids) → "Danh sách đã thay đổi. Vui lòng tải lại." (banner).

## Error Placement

- Inline below each field (format).
- Banner (`role="alert"`) for reorder-conflict + generic.
- Success: toast "Đã lưu tuyến" / "Đã cập nhật thứ tự" + list refresh.
- Drag-reorder is optimistic: reorder UI immediately, revert on server error + banner.

## Submit States

```
idle ──submit──▶ submitting ──ok──▶ success (toast, refresh)
                     │
                     └──err──▶ error (re-enable, announce, focus first error)
reorder ──drop──▶ optimistic apply ──ok──▶ confirmed
                          │
                          └──err──▶ revert order + banner
```

| State | Route label | Pickup label | Enabled | Spinner |
|-------|-------------|--------------|---------|---------|
| idle | "Lưu tuyến" | "Thêm điểm đón" | yes | no |
| submitting | "Đang lưu..." | "Đang lưu..." | no | yes |
| error | "Lưu tuyến" | "Thêm điểm đón" | yes | no |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input | `<label for>` + `aria-describedby="X-err"` + `aria-required` + `aria-invalid` |
| pickup list | `role="list"`; each row `role="listitem"` |
| drag handle | keyboard-reorderable: `aria-roledescription="sortable"`, ↑/↓ move, announce new position via `aria-live="polite"` |
| banner | `role="alert" aria-live="assertive"` |
| submit-fail | focus → first error field |

## Open Questions

- Pickup-point delete: soft vs hard? Defer; create + reorder in MVP scope.
- Map-pin picker for address? Text only in MVP.

## Out of Scope

- Inter-stop pricing / segment fares (single route price on Trip).
- Bus / trip / staff (separate files; same operator console).
