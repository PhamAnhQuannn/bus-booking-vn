---
screen: operator-dashboard
route: /op/dashboard
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Dashboard (Booking Queue)

## Purpose
The operator's working home: the booking queue (Issue 014). A server component
reads `listOperatorBookings` + `getUnviewedPaidCount` + `touchLastViewed`
in-process (never self-fetches its own API), shows a "N mới" badge of unviewed
paid bookings (reset on load), and renders a `DashboardClient` island with filter
controls and a paginated booking table. This file also DEFINES the shared
operator nav shell used by dashboard / upcoming / profile / fleet / routes / etc.

## Entry Points
- Post-login (intended home — see Open Question on login landing page).
- Operator nav shell "Dashboard" item from any `/op/*` page.
- Direct navigation to `/op/dashboard`.

## Device Targets
- Mobile (375–767px) — nav collapses to a top bar + drawer; table → stacked cards
- Desktop (≥768px) — primary; persistent left nav shell + data-dense table

---

## Operator Nav Shell (defined ONCE here; referenced by all `/op/*` data screens)

Shared chrome wrapping dashboard, upcoming, fleet, routes, trips, trip-templates,
manifest, reports, staff, profile. RECOMMENDED pattern: **persistent left sidebar
on desktop, collapsible top-bar + drawer on mobile** (operator surfaces are
data-dense and benefit from a wide content column with always-visible nav). The
`sidebar*` design tokens already exist in `globals.css` for exactly this — adopting
them is pending `/nav-pattern-pick` (Open Question in design-system.md).

Nav items (in order), each routes under `/op/*`:
- Dashboard (`/op/dashboard`) — booking queue, carries the "N mới" badge
- Upcoming (`/op/upcoming`) — chuyến sắp khởi hành
- Buses / Fleet (`/op/buses`) — xe + bảo trì
- Routes (`/op/routes`) — tuyến + điểm đón
- Trips (`/op/trips`) — chuyến + lifecycle actions
- Trip-templates (`/op/trips/templates`) — mẫu chuyến
- Manifest (`/op/manifest/[tripId]`) — danh sách hành khách (reached via trip rows)
- Reports → Payouts (`/op/reports/payouts`) + Revenue (`/op/reports/revenue`)
- Staff (`/op/staff`) — nhân viên
- Profile (`/op/profile`) — hồ sơ
- Logout (action → `POST /api/op/auth/logout`, then `/op/login`)

```
DESKTOP shell (≥768px)
+--------------+-------------------------------------------------+
| BUS-BOOKING  |  <page content for the active route>            |
|  (operator)  |                                                 |
| --------     |                                                 |
| > Dashboard●3|  ● = unviewed-paid badge on Dashboard item      |
|   Upcoming   |                                                 |
|   Fleet      |                                                 |
|   Routes     |                                                 |
|   Trips      |                                                 |
|   Templates  |                                                 |
|   Reports v  |   (Payouts / Revenue submenu)                   |
|   Staff      |                                                 |
| --------     |                                                 |
|   Profile    |                                                 |
|   Logout     |                                                 |
+--------------+-------------------------------------------------+
   ↑ sidebar (bg-sidebar tokens, if adopted)

MOBILE shell (≤767px)
+------------------------------------------------+
| [≡]  Bus-Booking (operator)        [Profile ▾] | ← top bar; ≡ opens nav drawer
+------------------------------------------------+
|  <page content>                                |
```

---

## Layout — Mobile (≤767px)
```
+------------------------------------------------+
| [≡] Bus-Booking (operator)        [Profile ▾]  | ← shell top bar
+------------------------------------------------+
|  Hàng đợi đặt vé   [ 3 mới ]                    | ← h1 + badge (data-testid=booking-badge)
|                                                |
|  Filters (stacked):                            |
|  [ ID xe buýt        ]                          | ← filter-bus-id
|  [ Ngày đi  (date)   ]                          | ← filter-service-date
|  [ ID tuyến          ]                          | ← filter-route-id
|  [ Trạng thái liên lạc ▾ ]                      | ← filter-contact-status (Select)
|  [        Lọc        ]                          | ← filter-submit Button
|                                                |
|  Booking cards (table → stacked on mobile):    |
|  +------------------------------------------+  |
|  | BB-2026-xxxx-xxxx          ✏ 💵 ⚠        |  | ← bookingRef link + flags
|  | Hành khách: Nguyễn Văn A                 |  |
|  | SĐT: 09xx · Vé: 2                         |  |
|  | Liên lạc: Chưa gọi                        |  |
|  | Điểm đón: Bến xe Miền Đông               |  |
|  | TT thanh toán: paid · Khởi hành: ...     |  |
|  +------------------------------------------+  |
|  ...                                           |
|  [ Tải thêm ]                                  | ← load-more-btn (if nextCursor)
+------------------------------------------------+
```

## Layout — Desktop (≥768px)
```
+--------------+---------------------------------------------------------------+
|  NAV SHELL   |  Hàng đợi đặt vé   [ 3 mới ]                                   | ← h1 + badge
|  (sidebar)   |                                                               |
|              |  [ID xe buýt] [Ngày đi▦] [ID tuyến] [Liên lạc ▾] [ Llọc ]     | ← filter row (flex-wrap)
|              |                                                               |
|              |  +---------------------------------------------------------+  |
|              |  | Mã đặt | Hành khách | SĐT | Vé | Liên lạc | Điểm đón |...|  | ← thead
|              |  +---------------------------------------------------------+  |
|              |  | BB-..  | Nguyễn A   | 09. | 2  | Chưa gọi | BX Miền Đ|...|  |
|              |  | BB-..  | Trần B     | 09. | 1  | Đã LL    | ...      |...|  | ← escalated row tinted amber
|              |  | ...                                                     |  |
|              |  +---------------------------------------------------------+  |
|              |     cols: Mã đặt · Hành khách · SĐT · Vé · Liên lạc ·         |
|              |           Điểm đón · TT thanh toán · Khởi hành · Cờ          |
|              |  [ Tải thêm ]                                                |  ← cursor pagination
+--------------+---------------------------------------------------------------+
```
Row flags (Cờ col): ✏ manualFlag · 💵 cashFlag · ⚠ escalatedAt (row also tinted).

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell (sidebar/top-bar) | not built | New — shared `/op/*` shell, `sidebar*` tokens pending /nav-pattern-pick |
| Page title (h1) + unviewed badge | `app/op/dashboard/page.tsx` inline | Badge → status/notification chip; use design-system badge convention |
| Filter: bus id Input | `DashboardClient.tsx` inline `<input>` | Migrate to `Input` |
| Filter: service-date Input | inline `<input type=date>` | Migrate to `Input` (date) |
| Filter: route id Input | inline `<input>` | Migrate to `Input` |
| Filter: contact-status Select | inline `<select>` | New — `Select` primitive (missing) |
| Filter submit ("Lọc") Button | inline `<button>` | Migrate to `Button` (default) |
| Booking table | inline `<table>` | New — `Table` primitive (missing; see /data-table-design) |
| bookingRef link → detail | inline `<a href=/op/dashboard/[id]>` | `Button` variant=link |
| Row flag icons (✏ 💵 ⚠) | inline `<span title>` | Keep as titled icons; add aria-labels |
| Load-more Button ("Tải thêm") | inline `<button>` | Migrate to `Button` (outline) |
| Dashboard message banner | inline `<div bg #fff3cd>` | Use amber status palette (booking/result convention) |

## States
| State | Trigger | UI |
|-------|---------|-----|
| Loading (initial) | Server render | RSC awaits lib reads; no client spinner (data arrives with HTML) |
| Loading (filter/append) | `loading=true` during `fetchBookings` | filter-submit + load-more disabled |
| Empty | `rows.length === 0` | "Không có đặt vé nào." (no table) |
| Populated | rows present | Booking table + (conditional) load-more |
| Error | `!res.ok` on fetch | dashboard-message banner "Lỗi tải dữ liệu." (amber) |
| Success (filter applied) | 200 with rows | Table replaced with filtered rows; cursor reset |
| Success (load more) | 200 append | rows appended; nextCursor updated/cleared |
| Disabled | While `loading` | filter-submit + load-more buttons disabled |
| Badge / unviewed | `unviewedCount > 0` | "N mới" chip beside h1; `touchLastViewed` resets it for next load |
| Escalated row | `row.escalatedAt` truthy | row tinted amber + ⚠ flag |
| requiresPasswordChange-redirect | session flag true | server `redirect('/op/first-login')` before render |
| Unauthenticated | no `bb_op_access` | server `redirect('/op/login')` |

## Interactions
- Filter form submits `{ busId, serviceDate, routeId, contactStatus }` (empty values
  stripped) to `GET /api/op/bookings?…` with `credentials:'same-origin'`. GET is a
  safe method → no CSRF token needed.
- Load-more re-issues the same query with `cursor=nextCursor`, appends rows.
- Clicking a `bookingRef` opens `/op/dashboard/[id]` (booking detail — separate surface).
- serviceDate filter window is UTC+7 (`Asia/Ho_Chi_Minh`) — see Issue 014 timezone rule.
- Badge: `getUnviewedPaidCount` read BEFORE `touchLastViewed`, so the count reflects
  what was new on this load; next load shows 0 unless new paid bookings arrived.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Operator session (operatorId, flag) | Server render | `getOperatorSession()` in-process | No |
| operatorUserId (for badge) | Server render | `verifyOperatorAccess(bb_op_access)` | No |
| Unviewed paid count | Server render (before touch) | `getUnviewedPaidCount()` in-process | No |
| Initial booking rows + nextCursor | Server render | `listOperatorBookings(operatorId, {})` in-process | No |
| Filtered / paginated rows | On filter / load-more | `GET /api/op/bookings` (client island) | No |

## Open Questions
- /nav-pattern-pick: adopt `sidebar*` tokens (left sidebar) vs flat top-nav for the
  shared `/op/*` shell. This wireframe assumes sidebar (data-dense recommendation).
- Login lands on `/op/profile` per source vs `/op/dashboard` per flow doc — confirm
  the booking queue is the canonical home so the badge is seen on login.
- Contact-status, manual/cash flags, escalation need a legend; promote `Table` +
  `Select` primitives (`/data-table-design`).
- Mobile: table → stacked cards is assumed; confirm vs horizontal scroll.

## Out of Scope
- Booking detail page `/op/dashboard/[id]` (separate surface).
- Cash-collected / picked-up / no-show manifest actions (operator-manifest wireframe).
- Reports charts (operator-reports wireframe).
