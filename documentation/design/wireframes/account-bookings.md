---
screen: account-bookings
route: /account/bookings
last-updated: 2026-05-20
status: draft
---

# Wireframe: Lịch sử đặt vé (Bookings History)

## Purpose
Authenticated customer's booking history (Issue 009, PRD story 15). Two tabs —
Sắp tới (upcoming) / Đã qua (past) — listing booking cards with route, departure
datetime, ticket count, total, booking ref, and a status badge. Cursor-based
"Tải thêm" (load more). Mirrors `app/account/bookings/page.tsx`.

## Entry Points
- Account menu / "Lịch sử đặt vé" link.
- Direct nav to `/account/bookings`.
- Booking detail back-link returns here.
- Missing/expired token (401) → redirect `/auth/login?returnTo=/account/bookings`.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px) — same single column, container capped (~640px)

## Layout — Mobile (≤767px)
```
+------------------------------------------------+
|  Lịch sử đặt vé                  ← h1          |
+------------------------------------------------+
|  [ Sắp tới ]  [ Đã qua ]         ← Tab row      |
|  ──────────                       (active = bold
|                                    + 2px underline)
+------------------------------------------------+
| ┌── booking card (link → /[id]) ───────────┐  | ← Card (NEW) wrapping <li><a>
| |  Hà Nội → Sa Pa        [ Đã thanh toán ]  |  |   route (strong) + Badge(NEW)
| |  20/05/2026 08:30      ← departure (vi-VN) |  |
| |  2 vé · 480.000 ₫ · BB-2026-ab12-cd34     |  |   tickets · total · ref(mono)
| └────────────────────────────────────────────┘  |
| ┌── booking card ───────────────────────────┐  |
| |  Đà Nẵng → Huế         [ Chờ thu tiền mặt ]|  |
| |  18/05/2026 14:00                          |  |
| |  1 vé · 150.000 ₫ · BB-2026-ef56-gh78      |  |
| └────────────────────────────────────────────┘  |
|                                                 |
|  [ Tải thêm ]               ← Button (if cursor)|
+------------------------------------------------+
```

## Layout — Desktop (≥768px)
```
        +--------------------------------------------+
        |  Lịch sử đặt vé                            |
        |  [ Sắp tới ]  [ Đã qua ]                   |
        |  --------------------------------------    |
        |  [ booking card (full-width row) .......]  |  single column, container
        |  [ booking card .......................]   |  max-w ~640, centered
        |  [ booking card .......................]   |  (matches 640px source)
        |  [ Tải thêm ]                              |
        +--------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Tab row (upcoming/past) | inline buttons → ToggleGroup/Tabs | Yes — MISSING primitive |
| Booking card (`<li><a>`) | components/ui/card.tsx (to build) | Yes — MISSING (inline today) |
| Badge (status) | inline `<span>` w/ STATUS_COLOR | Yes — MISSING (inline today) |
| Button ("Tải thêm") | components/ui/button.tsx | No |
| status label/color map | app/account/bookings/bookingStatus.ts (STATUS_LABEL / STATUS_COLOR) | No |
| date format | Intl vi-VN, Asia/Ho_Chi_Minh | No |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | initial / tab switch / load-more | "Đang tải..." text; existing rows stay visible during load-more |
| **empty** | `!loading && rows.length===0 && !error` | "Chưa có vé nào." (no cards, no Tải thêm) |
| populated | rows returned | list of booking cards, each linking to `/account/bookings/[id]` |
| has-more | `nextCursor && !loading` | "Tải thêm" Button shown below list |
| end-of-list | `nextCursor === null` | no Tải thêm button |
| error | non-401 fetch fail | red "Không thể tải lịch sử đặt vé." / "Lỗi kết nối. Vui lòng thử lại." |
| success | data render | cards visible (success == populated) |
| disabled | during fetch | implicit (no double-load; Tải thêm hidden while loading) |
| 401 / no token | missing/expired Bearer | redirect `/auth/login?returnTo=/account/bookings` (no inline UI) |

### Status badge palette (BookingStatus enum, verbatim from bookingStatus.ts)
| Status | Label (vi) | Badge color |
|--------|------------|-------------|
| awaiting_payment | Chờ thanh toán | amber `#b8860b` |
| pending_cash_payment | Chờ thu tiền mặt | amber `#b8860b` |
| paid_operator_notified | Đã thanh toán | green `#2e7d32` |
| completed | Hoàn thành | green `#2e7d32` |
| cancelled | Đã huỷ | grey `#999` |
| trip_cancelled | Chuyến bị huỷ | red `#c62828` |
| no_show | Không có mặt | red `#c62828` |
| payment_failed_expired | Thanh toán thất bại | red `#c62828` |

(Normalization target: map amber/green/red onto the design-system status-banner
palette; grey `#999` for `cancelled` has no banner equivalent — Open Question.)

## Interactions
- Tab switch (`Sắp tới` / `Đã qua`) resets list and reloads from cursor null
  (`tab` query param: upcoming|past).
- Entire card is a link to `/account/bookings/[id]`.
- "Tải thêm" appends next page using `nextCursor` (cursor pagination, not
  offset); rows accumulate (`[...prev, ...next]`).
- All loads send `Authorization: Bearer` only (read-only GET, no CSRF needed).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| booking rows | tab load / load-more | GET /api/bookings?tab=&cursor= | No |
| nextCursor | each page | response `{rows, nextCursor}` | n/a |
| status label/color | render | bookingStatus.ts maps | n/a |
| access token | each fetch | in-memory store | n/a |

Row fields (CustomerBookingRow): id, route.origin, route.destination,
departureAt, status, ticketCount, totalVnd, bookingRef.

## Open Questions
- `cancelled` grey badge (#999) has no status-banner palette analogue — invent a
  neutral/muted banner token or keep grey convention?
- Token lives in client memory only — a hard reload loses it and bounces to
  login; persist (httpOnly refresh) later?
- Pull-to-refresh / auto-poll for status changes? Not in source.

## Out of Scope
- Server-side rendering of the list (currently client-fetch after mount).
- Filtering/search within bookings beyond the two tabs.
- Cancel-booking action from the list (detail-only / not present).
