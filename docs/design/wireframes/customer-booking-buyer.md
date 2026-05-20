---
screen: customer-booking-buyer
route: /booking/customer
last-updated: 2026-05-20
status: draft
---

# Wireframe: Buyer Info (CustomerForm)

## Purpose
Collects buyer name + phone, validates client-side (Zod), then POSTs `/api/holds` to create the seat hold. On success it persists phone, seeds stores + HoldTimer, and advances to review. This is the step that actually creates the hold (B1 timer starts here).

## Entry Points
- From: `/search` "Đặt vé" (BookButton populated bookingStore tripId+ticketCount).
- Redirects to: `/booking/review?holdId=<id>` on hold-create success. Guarded by `/booking/layout.tsx` on `bookingStore.tripId` — missing trip context bounces to `/search`.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| Thông tin hành khách        (h1)     | ← text-2xl font-bold
|                                      |
| Họ và tên                 (label)    |
| [ (prefill from display name) ]      | ← <input> (editable; seeded, not locked)
|   ↳ Họ tên phải có ít nhất 4 ký tự   | ← field error (text-red-600, conditional)
|                                      |
| Số điện thoại             (label)    |
| [ (prefill busbooking_last_phone)]   | ← <input type=tel>
|   ↳ Số điện thoại không hợp lệ       | ← field error (conditional)
|                                      |
| [!] alert banner (sold_out/rate/err) | ← conditional (see States)
|                                      |
| [          Tiếp tục           ]      | ← submit Button ("Đang xử lý..." when pending)
+--------------------------------------+
   container max-w-md
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------+
|         +--------------------------------------+         | ← max-w-md, centered
|         | Thông tin hành khách                 |         |
|         | Họ và tên       [_________________]  |         |
|         | Số điện thoại   [_________________]  |         |
|         | [ alert if any ]                     |         |
|         | [           Tiếp tục            ]    |         |
|         +--------------------------------------+         |
+----------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| CustomerForm | `app/booking/customer/CustomerForm.tsx` | No (custom) |
| name/phone fields | raw `<input>` + inline `<label>` | Yes — Input + Label primitives NOT yet adopted here (divergence) |
| Submit button | raw `<button>` (blue inline) | Yes — should be Button primitive |
| Alert banners | inline divs (red-50 / yellow-50) | Yes — Toast/Alert MISSING |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | initial render | inputs prefilled from localStorage / display name; no spinner |
| empty | no saved phone / name | empty fields |
| field_errors | client Zod fails | per-field red error text under input; no navigation |
| submitting | `isPending` (useActionState) | inputs disabled, Button reads "Đang xử lý..." |
| sold_out | POST `/api/holds` 409 SOLD_OUT | red alert "đã hết chỗ"; `router.refresh()` invalidates RSC cache |
| rate_limited | POST 429 | yellow alert "thử lại sau N giây" (Retry-After) |
| error | other failure / missing trip ctx | red alert "Có lỗi xảy ra" |
| success | 201 hold created | save phone, seed stores, startTimer, `router.push('/booking/review?holdId=…')` |
| disabled-action | `isPending` | submit Button disabled |

## Interactions
- Tab order: Họ và tên → Số điện thoại → Tiếp tục.
- `noValidate` form; submit triggers client Zod before network.
- Errored fields use `aria-describedby` → error `<p id=…-error>`.
- Phone prefilled from `localStorage[busbooking_last_phone]`; name from logged-in display name (seed only, editable).
- Alerts use `role="alert"`.
- No sticky CTA — single-screen form.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| buyerName seed | mount | `getDisplayName()` (auth) | n/a |
| buyerPhone seed | mount | `localStorage.busbooking_last_phone` | n/a |
| tripId / ticketCount | submit | bookingStore | n/a |
| hold create | submit | POST `/api/holds` via `createHoldRequest()` | No — awaits 201 before navigating |

## Open Questions
- This screen still uses raw `<input>`/`<button>` + inline classes — normalize onto Input/Button/Label per design-system.
- CTA label is "Tiếp tục" (continue), not "Đặt vé" — confirm intended wording for the buyer step.
- No max-ticket vs availability hint before hold attempt (only learns on SOLD_OUT).

## Out of Scope
- Payment method choice (deferred to review step).
- OTP / account creation.
- Multi-passenger per-seat names.
