---
screen: account-booking-detail
route: /account/bookings/[id]
last-updated: 2026-05-20
status: draft
---

# Wireframe: Chi tiết vé (Booking Detail)

## Purpose
Single authenticated booking detail (Issue 009, PRD story 16). Shows route,
departure, ticket count, total, bus plate, buyer name/phone, operator name +
contact phone, a status badge, and a "Tải vé PDF" download (only for ticketable
statuses). Mirrors `app/account/bookings/[id]/page.tsx`.

## Entry Points
- Tap a booking card in `/account/bookings`.
- Direct nav to `/account/bookings/[id]` (uuid/cuid in path).
- Missing/expired token (401) → redirect `/auth/login?returnTo=/account/bookings/[id]`.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px) — same single column, container capped (~560px)

## Layout — Mobile (≤767px)
```
+------------------------------------------------+
|  ← Lịch sử đặt vé           ← back Link         |
+------------------------------------------------+
|  Hà Nội → Sa Pa        [ Đã thanh toán ]       | ← h1 (route) + status Badge(NEW)
|  BB-2026-ab12-cd34         ← bookingRef (mono) |
+------------------------------------------------+
| ┌── Card (detail panel) ────────────────────┐ | ← Card (NEW), Field rows
| |  KHỞI HÀNH                ← Field label     | |   (label uppercase muted +
| |  Thứ Tư, 20/05/2026 08:30   value           | |    value below)
| |  SỐ VÉ                                       | |
| |  2                                          | |
| |  TỔNG TIỀN                                  | |
| |  480.000 ₫                                  | |
| |  BIỂN SỐ XE                                 | |
| |  29B-123.45                                 | |
| |  ────────────────────────  ← divider        | |
| |  NGƯỜI ĐẶT                                  | |
| |  Nguyễn Văn A                               | |
| |  SỐ ĐIỆN THOẠI                              | |
| |  09xxxxxxxx                                 | |
| |  ────────────────────────  ← divider        | |
| |  NHÀ XE                                     | |
| |  Sao Việt Express                           | |
| |  LIÊN HỆ NHÀ XE                             | |
| |  09xxxxxxxx                                 | |
| └─────────────────────────────────────────────┘ |
|                                                 |
|  [ Tải vé PDF ]            ← Button (ticketable  |
|                              statuses only)     |
+------------------------------------------------+
```

## Layout — Desktop (≥768px)
```
       +----------------------------------------------+
       |  ← Lịch sử đặt vé                            |
       |  Hà Nội → Sa Pa            [ Đã thanh toán ] |
       |  BB-2026-ab12-cd34                           |
       |  [ Card: detail panel (Field rows, dividers)]|  container max-w ~560,
       |  [ Tải vé PDF ]                              |  centered single column
       +----------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Back Link | next/link | No |
| Status Badge | inline `<span>` w/ STATUS_COLOR | Yes — MISSING (inline today) |
| Card (detail panel) | components/ui/card.tsx (to build) | Yes — MISSING |
| Field (label + value row) | inline component in page | promote → Card subcomponent |
| Button ("Tải vé PDF") | components/ui/button.tsx | No |
| status label/color map | ../bookingStatus.ts (STATUS_LABEL / STATUS_COLOR) | No |
| date format | Intl vi-VN, weekday long, Asia/Ho_Chi_Minh | No |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | initial fetch | "Đang tải..." text only (no panel) |
| **success / populated** | GET /api/bookings/[id] 200 | full panel rendered |
| **empty** (not-found) | 404 | red "Không tìm thấy vé." (no panel) |
| error (load) | non-401/404 fail | red "Không thể tải chi tiết vé." / "Lỗi kết nối. Vui lòng thử lại." |
| 401 / no token | missing/expired Bearer | redirect `/auth/login?returnTo=/account/bookings/[id]` |
| download in flight | PDF fetch | Button disabled, label "Đang tải...", opacity reduced |
| download error | ticket fetch fail | red "Không thể tải vé PDF." |
| disabled | downloading | "Tải vé PDF" Button disabled |
| **ticket hidden** | status NOT in TICKETABLE | no download Button at all |

### Per-BookingStatus banner / badge (verbatim from bookingStatus.ts)
| Status | Label (vi) | Badge color | PDF button shown? |
|--------|------------|-------------|-------------------|
| awaiting_payment | Chờ thanh toán | amber `#b8860b` | No |
| pending_cash_payment | Chờ thu tiền mặt | amber `#b8860b` | **Yes** (TICKETABLE) |
| paid_operator_notified | Đã thanh toán | green `#2e7d32` | **Yes** |
| completed | Hoàn thành | green `#2e7d32` | **Yes** |
| no_show | Không có mặt | red `#c62828` | **Yes** |
| cancelled | Đã huỷ | grey `#999` | No |
| trip_cancelled | Chuyến bị huỷ | red `#c62828` | No |
| payment_failed_expired | Thanh toán thất bại | red `#c62828` | No |

TICKETABLE = { pending_cash_payment, paid_operator_notified, completed, no_show }.
(Normalization target: map amber/green/red onto status-banner palette; grey
`#999` for cancelled has no banner analogue — Open Question.)

## Interactions
- Back Link returns to `/account/bookings`.
- "Tải vé PDF": cannot use a plain `<a href>` — must `fetch` the ticket route
  with the Bearer header, receive a blob, build an object URL, and trigger a
  synthetic `<a download>` (`ticket-{bookingRef}.pdf`), then revoke the URL.
- All loads send `Authorization: Bearer` only (read-only GET, no CSRF).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| booking detail | mount | GET /api/bookings/[id] → `{booking}` | No |
| PDF blob | download click | GET /api/bookings/[id]/ticket (Bearer) | No |
| status label/color | render | ../bookingStatus.ts | n/a |
| access token | each fetch | in-memory store | n/a |

Detail fields (CustomerBookingDetail): route.origin/destination, departureAt,
ticketCount, totalVnd, busLicensePlate, buyerName, buyerPhone,
operator.legalName, operator.contactPhone, status, bookingRef.

## Open Questions
- `cancelled` grey badge (#999) has no status-banner palette analogue.
- Should a non-ticketable status show *why* there's no PDF (e.g. "Vé bị huỷ")
  instead of just hiding the button? Not in source.
- Buyer phone shown in full — confirm PII display policy for own bookings.

## Out of Scope
- Cancel / refund / reschedule actions (not present on this surface).
- Live status polling (status is fetched once at mount).
- Map / seat-layout view.
