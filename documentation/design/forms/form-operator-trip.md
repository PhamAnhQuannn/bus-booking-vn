---
form: operator-trip
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/operator-trips.md
endpoint: POST /api/op/trips; PATCH /api/op/trips/[id]; /from-template; /paired-return; /cancel; recurring-templates
---

# Form: Operator — Trip Create / Edit / Templates / Cancel

Multiple related operator forms on the trips console. Operator IS the price authority
(I7-exempt — price accepted on body, inline `// I7-exempt:` at each route). Trip
lifecycle: scheduled → departed → completed / cancelled. Cancel is idempotent (200 +
`already_cancelled:true` discriminator).

## Forms & Endpoints

| Form | Endpoint | Schema |
|------|----------|--------|
| Create one-off | POST /api/op/trips | CreateTripSchema |
| Edit | PATCH /api/op/trips/[id] | PatchTripSchema |
| From template | POST /api/op/trips/from-template | FromTemplateSchema |
| Paired return | POST /api/op/trips/[id]/paired-return | PairedReturnSchema |
| Cancel | POST /api/op/trips/[id]/cancel | CancelTripSchema |
| Recurring template | POST /api/op/trips/recurring-templates | CreateRecurringTemplateSchema |
| Sales toggle | (on trip row) | SalesToggleSchema |

## Fields

| Form | Name | Type | Required | Default | Notes |
|------|------|------|----------|---------|-------|
| create | routeId | select | yes | — | operator's routes |
| create | busId | select | yes | — | operator's buses |
| create | departureAt | datetime-local | yes | — | ISO datetime |
| create | price | number | yes | — | int min 0 (VND) |
| create | blockedSeats | number | no | 0 | int min 0 |
| edit | price | number | no | current | int min 0; ≥1 field |
| edit | salesClosed | toggle | no | current | bool; ≥1 field |
| edit | blockedSeats | number | no | current | int min 0; ≥1 field |
| from-template | templateId | select | yes | — | recurring template |
| from-template | departureAt | datetime-local | yes | — | concrete instance |
| from-template | price | number | no | template | int min 0 |
| paired-return | returnDepartureAt | datetime-local | yes | — | return leg |
| paired-return | price | number | no | outbound | int min 0 |
| cancel | reason | textarea | yes | — | min 10 chars |
| recurring | routeId | select | yes | — | — |
| recurring | busId | select | yes | — | — |
| recurring | price | number | yes | — | int min 0 |
| recurring | departureLocalTime | text | yes | — | HH:MM 00:00–23:59 |
| recurring | daysOfMask | multiselect | yes | — | int 1–127 (Mon=1..Sun=64) |
| recurring | validFrom | date | yes | — | YYYY-MM-DD |
| recurring | validUntil | date | yes | — | YYYY-MM-DD ≥ validFrom |

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| price | int ≥0 | on-blur | "Giá vé phải là số nguyên không âm" |
| blockedSeats | int ≥0 | on-blur | "Số ghế khóa phải là số nguyên không âm" |
| edit (any) | ≥1 field present | on-submit | "Vui lòng thay đổi ít nhất một thông tin" |
| cancel.reason | min 10 | on-submit | "cancelReason must be at least 10 characters" |
| departureLocalTime | HH:MM regex | on-blur | "departureLocalTime must be HH:MM (00:00–23:59)" |
| daysOfMask | int 1–127 | on-submit | "Vui lòng chọn ít nhất một ngày trong tuần" |
| validFrom | YYYY-MM-DD | on-blur | "validFrom must be YYYY-MM-DD" |
| validUntil | YYYY-MM-DD | on-blur | "validUntil must be YYYY-MM-DD" |
| validUntil | ≥ validFrom | on-submit | "validUntil must be >= validFrom" |

Server: 409 BUS_OVERLAP (create/edit reassign) → "Xe đã có chuyến trùng giờ." 422
BUS_OVERLAP_WITH_OUTBOUND (paired-return per AC6) → "Chuyến về trùng giờ với chuyến
đi." (SPEC CONFLICT: same code is 409 in reassignBus — divergence flagged inline,
keep both per AC verbatim). 409 MAINTENANCE_OVERLAP → "Xe đang trong lịch bảo trì."
422 SALES_CLOSED / depart-blocks-bookings handled by `salesClosed` flag. Generic →
"Có lỗi xảy ra. Vui lòng thử lại."

## Error Placement

- Inline below each field (format).
- Banner (`role="alert"`) for overlap/maintenance conflicts + generic.
- Cancel: destructive Dialog with reason textarea; banner inside Dialog on error.
- Idempotent cancel: `already_cancelled:true` (200) treated as success (no error
  surfaced) — toast "Chuyến đã được hủy trước đó."
- Success: toast (create "Đã tạo chuyến" / cancel "Đã hủy chuyến") + list refresh.

## Submit States

```
idle ──submit──▶ submitting ──ok──▶ success (toast, refresh / close panel)
                     │
                     └──err──▶ error (re-enable, announce, focus first error)
cancel ──confirm Dialog (reason)──▶ submitting ──200──▶ success
                                        │           (already_cancelled:true → same)
                                        └──err──▶ error (banner in Dialog)
```

| Form | idle label | submitting label |
|------|------------|------------------|
| create | "Tạo chuyến" | "Đang tạo..." |
| edit | "Lưu thay đổi" | "Đang lưu..." |
| from-template | "Tạo từ mẫu" | "Đang tạo..." |
| paired-return | "Tạo chuyến về" | "Đang tạo..." |
| cancel | "Xác nhận hủy" (destructive) | "Đang hủy..." |
| recurring | "Lưu mẫu" | "Đang lưu..." |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| each input/select | `<label for>` + `aria-describedby="X-hint X-err"` + `aria-required` + `aria-invalid` |
| select (route/bus/template) | base-ui Select (MISSING — build) |
| daysOfMask | Checkbox group (MISSING primitive — build); `<fieldset><legend>Ngày trong tuần</legend>` |
| salesClosed | toggle switch, `role="switch" aria-checked` |
| cancel Dialog | focus trap, Esc closes, `role="dialog" aria-modal="true"` |
| banner | `role="alert" aria-live="assertive"` |
| submit-fail | focus → first error field |

## Open Questions

- depart/complete mark actions live on the trip detail/manifest, NOT this create form
  — endpoints exist in flow contract but not yet wired in trip clients (build wires).
- Paired-return vs from-template precedence in UI: separate actions, not combined.

## Out of Scope

- Manifest passenger transitions (cash-collected / picked-up / no-show) — booking-detail.
- Bus / route / staff (separate files; same operator console).
