---
screen: customer-booking-review
route: /booking/review
last-updated: 2026-05-20
status: draft
---

# Wireframe: Order Review + Pay (cash)

## Purpose
Final review of the held order (trip, ticket count, total) with the live HoldTimer. Confirming POSTs `/api/bookings/initiate` with `paymentMethod: 'cash'` (golden path) and advances to the confirmation page. Hosts the HoldExpiryModal interrupt (B1).

## Entry Points
- From: `/booking/customer` success → `/booking/review?holdId=<id>`.
- Redirects to: `/booking/confirmation/<confirmationToken>` on 200. On hold expiry, HoldExpiryModal redirects to `/search`. Server-side: missing/mismatched `bb_hold` cookie or absent hold → `redirect('/search')`.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| Xem lại đơn hàng            (h1)     | ← text-2xl font-bold
|                                      |
| +----------------------------------+ |
| | Chi tiết đặt chỗ        (h2)     | | ← summary card (bg-white border rounded-lg)
| | Mã chuyến        <tripId> (mono) | |
| | Số vé            2               | |
| | ─────────────────────────────── | |
| | Tổng cộng        500.000đ        | | ← total (text-blue-700, font-semibold)
| +----------------------------------+ |
|                                      |
| ⏱ 09:45 còn lại                      | ← HoldTimer (aria-live; turns red ≤T-2m)
|                                      |
| [!] red alert (initiate error)       | ← conditional (role=alert)
|                                      |
| [    Xác nhận thanh toán      ]      | ← submit (green; "Đang xử lý..." when busy)
+--------------------------------------+

  HoldExpiryModal (overlay, when expired):
  +----------------------------------+
  |              ⏰                   |
  | Chỗ giữ đã hết hạn               |
  | Chỗ ngồi của bạn đã được giải... |
  | [   Tìm chuyến xe mới        ]   | ← → /search
  +----------------------------------+
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------+
|        +------------------------------------------+      | ← max-w-md centered
|        | Xem lại đơn hàng                         |      |
|        | +--------------------------------------+ |      |
|        | | Chi tiết đặt chỗ                     | |      |
|        | | Mã chuyến / Số vé / Tổng cộng        | |      |
|        | +--------------------------------------+ |      |
|        | ⏱ MM:SS còn lại                          |      |
|        | [        Xác nhận thanh toán         ]   |      |
|        +------------------------------------------+      |
+----------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| ReviewClient | `app/booking/review/ReviewClient.tsx` | No (custom) |
| Summary card (`<dl>`) | inline `bg-white border rounded-lg` | Yes — Card primitive MISSING |
| HoldTimer | `components/HoldTimer.tsx` | No (custom) |
| HoldExpiryModal | `components/HoldExpiryModal.tsx` | No (custom; Dialog primitive MISSING) |
| Confirm button | raw `<button>` (green inline) | Yes — should be Button primitive |
| Error alert | inline `bg-red-50` div | Yes — Alert MISSING |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | RSC verifies cookie + getHoldDetails | server-rendered; client mounts timer on hydrate |
| empty | n/a (redirects if no hold) | server `redirect('/search')` before render |
| success | initiate 200 + confirmationToken | `router.push('/booking/confirmation/<token>')` |
| submitting | confirm clicked | Button disabled, "Đang xử lý...", re-entry guarded |
| error (HOLD_EXPIRED 409) | initiate maps code | red alert "Hết thời gian giữ chỗ..." |
| error (TRIP_DEPARTED 409) | initiate maps code | red alert "Chuyến đã khởi hành..." |
| error (NOT_FOUND 404 / FORBIDDEN 403 / INVALID 400 / 429 / 502/503) | initiate map | red alert localized per ERROR_LABEL |
| hold-expired (B1) | HoldTimer countdown == 0 | HoldExpiryModal overlay (non-dismissible) → `/search`; clears bookingStore |
| disabled-action | `submitting` true | confirm Button disabled |

## Interactions
- Tab order: (summary is static) → confirm Button. Modal traps focus when shown.
- Confirm guarded against double-submit (`if (submitting) return`).
- HoldTimer is `aria-live="polite"`; warns visually (red) at ≤2 min.
- HoldExpiryModal: `role="alertdialog"`, `aria-modal`, non-dismissible, single CTA.
- bb_hold cookie travels via `credentials: 'include'`; `X-CSRF-Token` header attached.
- Sticky CTA acceptable on mobile (confirm at bottom).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| holdId/tripId/ticketCount/expiresAt/totalVND | RSC render | `getHoldDetails(holdId)` (in-process lib, NOT self-fetch) | No |
| remaining time | client tick | holdTimerStore (seeded from expiresAt) | n/a |
| booking initiate (cash) | confirm | POST `/api/bookings/initiate` `{holdId, paymentMethod:'cash'}` | No — awaits token |

## Open Questions
- No explicit payment-method selector on this screen — cash is hardcoded in ReviewClient. Where does MoMo branch get chosen? (Flow lists momo as alt; UI selector not present here.)
- Normalize inline `<button>` / card markup onto Button + Card primitives.
- Trip details on the card are sparse (only Mã chuyến) — add route/time for buyer reassurance?

## Out of Scope
- MoMo redirect handoff (covered by result page).
- ZaloPay / card methods (Zod-rejected upstream).
- Editing buyer info (back-nav re-runs buyer step).
