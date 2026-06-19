---
feature: customer-booking
target: WCAG 2.2 AA
last-updated: 2026-05-20
status: draft
inherits: docs/design/a11y-global.md
---

# A11y Design: Customer Booking Flow

Surfaces: customer-home, customer-search, buyer-info, review (+pay-method), result/poll,
confirmation. Wireframes: `docs/design/wireframes/customer-*.md`. Flow:
`docs/design/flows/customer-booking.md`. Inherits all global rules
(`docs/design/a11y-global.md`) — this file adds per-screen keyboard/focus/SR/live detail.

## Landmarks (per page)

| Element | Role / Tag |
|---------|-----------|
| Skip link | `<a href="#main">Bỏ qua tới nội dung</a>` (root layout) |
| Header | `<header>` + brand link |
| Main | `<main id="main">` |
| Search form region | `<form role="search" aria-label="Tìm chuyến xe">` |
| Results list | `<ul>` of trip cards (`role="list"` only if `<ul>` semantics lost) |
| Booking summary aside (review) | `<aside aria-label="Tóm tắt đặt vé">` |

## Keyboard Map

| Key | Context | Action |
|-----|---------|--------|
| Tab / Shift+Tab | global | Move through interactive elements in DOM order |
| Enter | search form | Submit search |
| Enter / Space | trip card CTA "Chọn chuyến" | Select trip → buyer-info |
| Enter | buyer-info "Tiếp tục" | Submit hold create |
| Arrow Up/Down | pay-method radio group (review) | Move between cash / MoMo |
| Space / Enter | pay-method radio | Select method |
| Enter | review "Xác nhận đặt vé" | Confirm booking |
| Esc | hold-expired modal | (no dismiss — modal forces redirect to search) |

## Tab Order

**customer-search:** origin → destination → date → "Tìm chuyến" submit → (results)
each trip card CTA in list order.
**buyer-info:** "Quay lại" link → buyerName → buyerPhone → "Tiếp tục".
**review:** "Quay lại" → pay-method radio group (single tab stop, arrows navigate) →
"Xác nhận đặt vé".
**result/poll:** focus on status region; no form. **confirmation:** focus heading;
"Đặt vé mới" CTA last.

## Focus Management

| Trigger | Focus moves to |
|---------|----------------|
| search results loaded | first trip card heading (or "Không tìm thấy chuyến" empty msg) |
| buyer-info mount | buyerName input |
| hold create validation error | first errored field (buyerName precedence) |
| hold create server error (SOLD_OUT/rate_limited/missing-trip) | banner `role="alert"` |
| advance to review | review heading h1 |
| review mount | pay-method group (cash pre-selected, 1 of N) |
| confirm success | confirmation heading h1 |
| hold-expired modal opens | modal heading (focus trap; Esc → redirect) |
| result-poll resolves (paid/failed) | status region (announced polite) |

## Live Regions

| Region | Pattern | Copy notes |
|--------|---------|------------|
| HoldTimer countdown | `role="timer" aria-live="off"` → `polite` at ≤60s | announce "Còn N phút giữ chỗ" at threshold |
| hold create banner | `role="alert" aria-live="assertive"` | SOLD_OUT / rate_limited / missing-trip / generic VN copy |
| field errors | `role="alert"` (id `buyerName-err` / `buyerPhone-err`) | verbatim from form-customer-buyer-info.md |
| result poll status | `aria-live="polite"` | "Đang xác nhận thanh toán…" → resolved state |
| submit pending | button label swap + `aria-live="polite"` | "Đang xử lý..." |

## Screen Reader Script (VoiceOver vi, review screen)

1. "Xác nhận đặt vé, tiêu đề cấp 1"
2. "Tóm tắt đặt vé, vùng bổ trợ"
3. "Tuyến Hà Nội đến Hải Phòng, 2026-05-22 07:00, 2 vé, tổng 290000 đồng" (đồng, not ₫)
4. "Còn 4 phút 32 giây giữ chỗ, bộ đếm" (only re-announced ≤60s)
5. "Phương thức thanh toán, nhóm nút chọn"
6. "Tiền mặt, đã chọn, 1 trên 2"
7. "Xác nhận đặt vé, nút"

## Pay-Method Note (Phase A)

Cash is the only enabled method in Phase A; MoMo radio present but its full poll flow is
expected-skip locally (ZaloPay/card NOT rendered — out of scope). RadioGroup must still be
a real `role="radiogroup"` (base-ui, MISSING — build) with arrow-key nav even when only
cash is interactive, so the build doesn't hardcode a single value (carry-forward:
`ReviewClient.tsx:79` currently hardcodes `cash` with no selector — build wires the group).

## Touch Targets

Trip card CTA, "Tiếp tục", "Xác nhận đặt vé" = full-width primary, use Button `lg`
(h-9=36px) padded to ≥44px hit area per global F-caveat. Pay-method radio = 24px visual +
44px hit area.

## Out of Scope

- ZaloPay / card pay methods (Phase A out of scope).
- MoMo full poll e2e (expected-skip locally; UI branch present).
- Seat-map selection (no per-seat UI in MVP — ticketCount only).

## Open Questions

- Inherits global F1 (focus ring contrast) — applies to every CTA here.
- Empty-results state copy finalization deferred to content pass.
