---
form: customer-buyer-info
last-updated: 2026-05-20
status: draft
wireframe: docs/design/wireframes/buyer-info.md
endpoint: POST /api/holds
---

# Form: Customer — Buyer Info (Hold Create)

Booking-flow step between trip-select and review. Source `app/booking/customer/
CustomerForm.tsx` — already tailwind, the design-system reference form (still uses
`bg-blue-600` → normalize to `bg-primary` in build). Buyer fields ONLY (buyerName +
buyerPhone); tripId / ticketCount come from the booking store, NOT this form. NO
client-originated price (server recomputes — I7). POST /api/holds creates the hold.

## Fields

| Name | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| buyerName | text | yes | — | trim, 4–100, unicode-letter set |
| buyerPhone | tel | yes | localStorage `busbooking_last_phone` | VN mobile |

(tripId, ticketCount: from booking store — hidden carried-state, not user fields here.)

## Validation Matrix

| Field | Rule | Timing | Error copy |
|-------|------|--------|------------|
| buyerName | trim `min(4)` | on-blur | "Họ tên phải có ít nhất 4 ký tự" |
| buyerName | `max(100)` | on-blur | "Họ tên không được vượt quá 100 ký tự" |
| buyerName | `/^[\p{L}\p{M}\s'.-]+$/u` | on-blur | "Họ tên chỉ được chứa chữ cái, dấu cách và các ký tự hợp lệ" |
| buyerPhone | `/^(0|\+84)[35789][0-9]{8}$/` | on-blur | "Số điện thoại không hợp lệ" |

Server (banner): SOLD_OUT → "Chuyến xe này đã hết chỗ. Vui lòng chọn chuyến khác.";
rate_limited → "Quá nhiều yêu cầu. Vui lòng thử lại sau {retryAfter} giây."; missing-trip
→ "Thông tin chuyến xe bị thiếu. Vui lòng chọn lại."; generic → "Có lỗi xảy ra. Vui
lòng thử lại."

## Error Placement

- Inline below each field (format).
- Banner (`role="alert"`) for all server outcomes (SOLD_OUT / rate_limited /
  missing-trip / generic).
- No toast (banner + inline only on this flow step).
- On success → advance to review (hold cookie set); phone persisted to localStorage
  `busbooking_last_phone`.

## Submit States

```
idle ──submit──▶ submitting ──ok──▶ success (set bb_hold, redirect /booking/review)
                     │
                     └──err──▶ error (re-enable, announce banner, focus first error)
```

| State | Button label | Enabled | Spinner | Announce |
|-------|--------------|---------|---------|----------|
| idle | "Tiếp tục" | yes | no | — |
| submitting | "Đang xử lý..." | no | yes | aria-live polite |
| success | "Tiếp tục" | no | no | redirect /booking/review |
| error | "Tiếp tục" | yes | no | banner assertive |

## A11y Wiring

| Field | Pattern |
|-------|---------|
| buyerName | `<label for="buyerName">` Họ và tên + `aria-describedby="buyerName-err"` + `aria-required` + `aria-invalid` |
| buyerPhone | `<label for="buyerPhone">` Số điện thoại + `type="tel"` `inputmode="tel"` + `aria-describedby="buyerPhone-err"` + `aria-required` + `aria-invalid` |
| banner | `role="alert" aria-live="assertive"` |
| submit-fail | focus → first error field (buyerName precedence) |

## Open Questions

- Email field for e-ticket delivery? Not in MVP (SMS-only confirmation).
- Save buyer profile for logged-in customers (prefill name too)? Phone-only prefill
  via localStorage in MVP; authed-prefill deferred.

## Out of Scope

- Payment method selection (review step hardcodes cash; MoMo alt-branch — Phase B).
- Review / confirmation screens (separate wireframes; no form there beyond confirm CTA).
