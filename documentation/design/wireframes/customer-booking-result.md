---
screen: customer-booking-result
route: /booking/result/[token]
last-updated: 2026-05-20
status: draft
---

# Wireframe: MoMo Payment Result (poll)

## Purpose
Alt-pay (MoMo) result page reached via the MoMo return URL. Status-driven: while `awaiting_payment` it auto-refreshes every 5s via `<meta http-equiv="refresh">` (capped 24 ≈ 2 min via `?r=` counter); on paid → success + link to confirmation; on failed → retry to search.

## Entry Points
- From: MoMo return URL after `paymentMethod:'momo'` initiate (no prior bookingStore state).
- Redirects to: none auto. Links out to `/booking/confirmation/<token>` (paid) or `/search` (failed). `getBookingByConfirmationToken` miss → `notFound()`. `/booking/layout.tsx` whitelists this prefix (token IS the access key, bypasses tripId guard).

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px) — awaiting_payment (polling)
```
+--------------------------------------+
| <meta refresh 5s; url=?r=N+1>        | ← only while pending & N<24
| Đang xử lý thanh toán       (h1)     |
| Mã đặt chỗ: BB-2026-xxxx-xxxx (mono) |
|                                      |
| +== amber banner =================+  |
| | Đang chờ xác nhận thanh toán Mo | | ← bg-amber-50 border-amber-200 text-amber-900
| | Vui lòng hoàn tất ... cập nhật  | |
| |   sau 5 giây.                   | |
| +=================================+  |
|                                      |
| +----------------------------------+ |
| | Thông tin đặt vé        (h2)     | | ← summary card
| | Tuyến  Hà Nội → TP.HCM           | |
| | Số vé  2                         | |
| | Tổng cộng        500.000đ        | |
| +----------------------------------+ |
+--------------------------------------+
```

## Layout — Mobile — poll-cap reached (r ≥ 24)
```
| +== amber banner =================+  |
| | Đang chờ xác nhận thanh toán Mo | |
| | Vui lòng hoàn tất ...           | |
| | Trang đã dừng tự động làm mới.  | | ← cap message
| |  [Tải lại trang] để kiểm tra.   | | ← manual reload link (?r reset)
| +=================================+  |
   (no <meta refresh> emitted)
```

## Layout — Mobile — paid / failed
```
PAID (green):                          FAILED (red):
+== green banner ===============+      +== red banner ================+
| Đặt vé và thanh toán thành... |      | Thanh toán không thành công  |
| Cảm ơn bạn ...                |      | Giao dịch MoMo ... bị hủy.   |
| [ Xem thông tin đặt vé ]      |      | [ Tìm chuyến khác ]          |
+===============================+      +==============================+
  → /booking/confirmation/[token]        → /search
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------+
|        +------------------------------------------+      | ← max-w-md centered
|        | Đang xử lý thanh toán  |  Mã đặt chỗ ...  |      |
|        | [ status banner: amber / green / red ]   |      |
|        | +--------------------------------------+ |      |
|        | | Thông tin đặt vé (Tuyến/Số vé/Tổng)  | |      |
|        | +--------------------------------------+ |      |
|        +------------------------------------------+      |
+----------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| ResultPage (RSC) | `app/booking/result/[token]/page.tsx` | No |
| `<meta httpEquiv="refresh">` | inline | n/a (no component) |
| Status banner (amber/green/red) | inline sections | Yes — Alert MISSING; use result-page palette verbatim |
| Summary card (`<dl>`) | inline `bg-white border rounded-lg` | Yes — Card primitive MISSING |
| CTA links | `<a>` styled as button | Yes — could be Button asChild |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | RSC fetch | server-rendered each poll cycle (full reload, not client spinner) |
| empty | token matches no booking | `notFound()` (404 page) |
| pending (polling) | status `awaiting_payment`, r<24 | amber banner + `<meta refresh>` 5s |
| poll-cap-reached | status pending, r≥24 | amber banner + "dừng tự động làm mới" + manual reload link; NO meta refresh |
| success | `paid_operator_notified` / `completed` | green banner + "Xem thông tin đặt vé" → confirmation |
| error/failed | `payment_failed_expired` | red banner + "Tìm chuyến khác" → /search |
| fallback | any other status (e.g. cancelled) | gray neutral panel "đang được xử lý ... liên hệ hỗ trợ" |
| disabled-action | n/a | links always active; no disabled control |

## Interactions
- No client JS interaction; navigation is via `<a>` links + meta-refresh reload.
- Poll counter `?r=N` increments per refresh; clamped to MAX_AUTO_REFRESH (24).
- Manual "Tải lại trang" link resets to `/booking/result/[token]` (drops `?r`).
- Banner palette fixed per design-system (amber/green/red verbatim).
- No sticky CTA — single CTA inside the relevant banner.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| booking status + ref + trip route + ticketCount + totalVnd | each RSC render | `getBookingByConfirmationToken(token)` (in-process) | No |
| refresh counter | render | `searchParams.r` (clamped) | n/a |
| status transition (paid/fail) | server-side | MoMo webhook updates Booking before next poll | No |

## Open Questions
- After poll cap, only manual reload remains — should a "contact support" / "open MoMo app again" affordance be added?
- Pending banner shows no elapsed-time / attempt counter to the user.
- Full meta-refresh reload re-fetches the whole page each 5s — acceptable load vs a client poll?

## Out of Scope
- MoMo redirect/handoff itself (gateway-hosted).
- Cash flow (goes straight to confirmation, never here).
- ZaloPay / card.
