---
screen: operator-upcoming
route: /op/upcoming
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Upcoming Trips

## Purpose
List the operator's upcoming (not-yet-departed) trips so staff can see departure
times, price, status, remaining seats, and jump to each trip's manifest. Server
component reads `listUpcomingForOperator` in-process (never self-fetches its own
API).

## Entry Points
- Operator nav shell "Upcoming" item.
- Direct navigation to `/op/upcoming`.

## Device Targets
- Mobile (375–767px) — table degrades to stacked rows/cards
- Desktop (≥768px) — primary; data-dense table inside the shared nav shell

## Layout — Mobile (≤767px)
```
+------------------------------------------------+
| [≡] Bus-Booking (operator)        [Profile ▾]  | ← shared shell top bar
+------------------------------------------------+
|  Chuyến xe sắp khởi hành                        | ← h1
|                                                |
|  Trip cards (table → stacked):                 |
|  +------------------------------------------+  |
|  | Khởi hành: 21/05 08:00                    |  |
|  | Giá: 250.000đ   ·   Ghế còn: 12           |  |
|  | Trạng thái: scheduled                     |  |
|  | [ Xem manifest ]                          |  | ← manifest-link
|  +------------------------------------------+  |
|  ...                                           |
+------------------------------------------------+
```

## Layout — Desktop (≥768px)
```
+--------------+------------------------------------------------------+
|  NAV SHELL   |  Chuyến xe sắp khởi hành                              | ← h1
|  (sidebar —  |                                                      |
|   see        |  +------------------------------------------------+  |
|   dashboard) |  | Khởi hành | Giá | Trạng thái | Ghế còn | Manifest|  | ← thead
|              |  +------------------------------------------------+  |
|              |  | 21/05 08:00 | 250.000đ | scheduled | 12 | Xem.. |  |
|              |  | 21/05 14:00 | 250.000đ | scheduled |  3 | Xem.. |  |
|              |  | 22/05 06:00 | 300.000đ | departed  |  0 | Xem.. |  |
|              |  +------------------------------------------------+  |
+--------------+------------------------------------------------------+
   cols: Khởi hành · Giá · Trạng thái · Ghế còn · Manifest
```
Status values from TripStatus enum: scheduled · departed · completed · cancelled.

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell | see operator-dashboard.md | New (shared) |
| Page title (h1) | `app/op/upcoming/page.tsx` inline | existing markup |
| Upcoming trips table | inline `<table>` | New — `Table` primitive (missing) |
| Departure cell (vi-VN datetime) | `new Date(departureAt).toLocaleString('vi-VN')` | formatting helper |
| Price cell (`…đ`) | `trip.price?.toLocaleString('vi-VN')` | formatting helper |
| Status cell | `trip.status` raw enum | New — status badge/chip (map enum → label + color) |
| Available-seats cell | `trip.availableSeats` | plain text |
| Manifest link ("Xem manifest") | inline `<a href=/op/manifest/[id]>` | `Button` variant=link |

## States
| State | Trigger | UI |
|-------|---------|-----|
| Loading | Server render | RSC awaits lib read; data arrives with HTML (no client spinner) |
| Empty | `trips.length === 0` | "Không có chuyến nào trong thời gian tới." (no table) |
| Populated | trips present | Trips table |
| Success | listUpcomingForOperator resolves | Rendered table |
| Error | lib throws during render | Next.js error boundary (no inline handler in source) — Open Question |
| Disabled (n/a) | — | No interactive controls beyond manifest links |
| requiresPasswordChange-redirect | session flag true | server `redirect('/op/first-login')` before render |
| Unauthenticated | no `bb_op_access` | server `redirect('/op/login')` |

## Interactions
- "Xem manifest" navigates to `/op/manifest/[tripId]` (separate manifest surface).
- No filters / pagination in current source (unlike dashboard) — full upcoming list
  rendered in one pass.
- Status enum is rendered raw today; lifecycle ACTIONS (depart/complete/cancel) live
  on the trips surface, NOT here — this screen is read-only.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Operator session (operatorId, flag) | Server render | `getOperatorSession()` in-process | No |
| Upcoming trip DTOs `{ id, departureAt, price, status, availableSeats }` | Server render | `listUpcomingForOperator(operatorId, {})` in-process | No |

## Open Questions
- No filters/pagination — does the upcoming list need a date-range or status filter
  + cursor like the dashboard once an operator has many trips?
- Status enum rendered raw (`scheduled`/`departed`/…) — add Vietnamese labels +
  status-color chips for consistency with the rest of the operator UI.
- No explicit error UI in source; relies on Next.js error boundary. Add an inline
  empty/error distinction?
- `availableSeats=0` rows still appear — should sold-out / departed trips visually
  differ (dimmed) from bookable scheduled trips?

## Out of Scope
- Trip lifecycle actions (depart/complete/cancel) — operator-trips wireframe.
- Manifest passenger list + cash collection — operator-manifest wireframe.
- Trip creation / paired-return — operator-trips wireframe.
