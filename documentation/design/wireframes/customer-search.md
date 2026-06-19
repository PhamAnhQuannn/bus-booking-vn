---
screen: customer-search
route: /search
last-updated: 2026-05-20
status: draft
---

# Wireframe: Search Results

## Purpose
RSC trip-results page. Reads URL searchParams, validates via Zod, queries `searchTrips()`, and renders trip cards with a "Đặt vé" CTA per trip plus ±1-day navigation chips. Falls back to the search form when params are invalid.

## Entry Points
- From: `/` (form submit) or ±1-day chips, or direct deep link with query string.
- Redirects to: `/booking/customer` when a trip's "Đặt vé" is clicked (BookButton sets bookingStore tripId+ticketCount then `router.push`). Note: hold is NOT created here — it is created on the buyer-info step.

## Device Targets
- Mobile (375–767px) — primary
- Desktop (≥768px)

## Layout — Mobile (≤767px) — results present
```
+--------------------------------------+
| ← Tìm lại   Hà Nội → TP.HCM   (h1)   | ← Link back to "/" + route title
|                                      |
| [← Ngày trước]  Thứ ... 20/5  [Ngày sau →] | ← ±1-day chips (prev hidden if date==today VN)
|                                      |
| +----------------------------------+ |
| | Hà Nội → TP.HCM   Nhà xe ABC     | | ← TripCard (article, rounded-xl border bg-card)
| | Khởi hành: 08:30  Chỗ trống: 12  | |
| | 250.000 ₫            [ Đặt vé ]   | | ← price (text-primary) + BookButton
| +----------------------------------+ |
| +----------------------------------+ |
| | ... next trip ...                | |
| +----------------------------------+ |
+--------------------------------------+
```

## Layout — Mobile — empty (no trips)
```
+--------------------------------------+
| ← Tìm lại   Hà Nội → TP.HCM          |
|                                      |
|     Không tìm thấy chuyến xe         | ← EmptyState (centered)
|         cho ngày này.                |
|        Thử ngày khác:                |
|  [← Thứ.. 19/5]   [Thứ.. 21/5 →]     | ← prev/next full-date chips
+--------------------------------------+
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------+
|        +------------------------------------------+      | ← still max-w-md
|        | ← Tìm lại   Hà Nội → TP.HCM              |      |   single column
|        | [← Ngày trước]  Thứ.. 20/5  [Ngày sau →] |      |
|        | +--------------------------------------+ |      |
|        | | TripCard ...                         | |      |
|        | +--------------------------------------+ |      |
|        | | TripCard ...                         | |      |
|        | +--------------------------------------+ |      |
|        +------------------------------------------+      |
+----------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| TripCard (`<article>`) | `app/search/page.tsx` inline | Yes — Card primitive MISSING |
| BookButton (default Button) | `components/search/BookButton.tsx` | No |
| ±1-day chips / back link | `next/link` styled as button | Yes — could promote to Button asChild |
| EmptyState | `app/search/page.tsx` inline | Yes — no Empty primitive |
| SearchFormWrapper (invalid-params fallback) | `components/search/SearchFormWrapper.tsx` | No |
| SearchStoreHydrator | `components/search/SearchStoreHydrator.tsx` | No |

## States
| State | Trigger | UI |
|-------|---------|----|
| loading | RSC fetch in flight | server-rendered; no client spinner (streamed) |
| empty | `trips.length === 0` | EmptyState + prev/next date chips |
| invalid params | Zod `safeParse` fails | renders SearchForm (re-entry) at `/search` |
| success | trips returned | ResultsList with date chips + TripCards |
| disabled-action | n/a | BookButton always enabled per card |
| error | DB query throws | Next error boundary (not custom-designed here) |
| today edge | searched date == today (VN) | prev-day chip suppressed (`showPrev=false`) |

## Interactions
- Tab order: back link → prev chip → next chip → TripCard 1 BookButton → TripCard 2 …
- All Links/Buttons ≥44px (`min-h-11`).
- "Đặt vé" sets bookingStore then navigates; no network call on this screen.
- TripCard has `aria-label` route; list has `aria-label` count.
- No sticky CTA — per-card CTA inline.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| trip results (7 contract fields) | RSC render | `searchTrips()` (DB) | No |
| price/time formatting | render | `toLocaleString` VN locale, TZ Asia/Ho_Chi_Minh | n/a |
| todayVN (chip suppression) | render | `Intl.DateTimeFormat('en-CA', TZ=VN)` | n/a |
| tripId + ticketCount | on "Đặt vé" | bookingStore (client) | n/a |

## Open Questions
- Promote TripCard to a Card primitive (design-system flags Card MISSING).
- No "results count" header text — add for screen readers / UX?
- Sold-out / low-seat visual treatment not differentiated on the card.

## Out of Scope
- Filtering/sorting (price, time, operator).
- Pagination (assumes small result sets).
- Seat-map selection.
