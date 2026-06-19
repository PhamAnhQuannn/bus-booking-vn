---
screen: operator-staff-dashboard
route: /op/staff/dashboard
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator — Staff Single-Trip Dashboard

## Purpose
Staff-only working view of the **one trip** assigned to the logged-in staff
member (Issue 018). Shows trip status + depart/complete actions, and a tab switch
between the **booking queue** (`Hàng đợi`) and the **boarding manifest**
(`Manifest`) for that single trip. Staff see only their assigned trip — no admin
nav (Fleet/Routes/Trips/Reports/Staff). Vietnamese title "Chuyến của tôi".

Admins landing here are redirected to the full `/op/dashboard`. No assignment →
empty state.

## Entry Points
- Staff login → (staff-scope) lands on `/op/staff/dashboard`.
- Redirects: no session → `/op/login`; `requiresPasswordChange` → `/op/first-login`;
  admin → `/op/dashboard`.

## Device Targets
- Mobile (375–767px) — staff at the gate, phone-first
- Desktop (≥768px) — primary (queue / manifest tables)

## Layout — Mobile (≤767px)
Action buttons stack/wrap; tab strip full-width; tables → cards.
```
┌──────────────────────────────────────┐
│ Chuyến của tôi                (h1)   │  ← NO admin nav shell
│                                       │
│ ┌── message banner (amber) ────────┐ │  ← after depart/complete or load error
│ │ Đã đánh dấu khởi hành.            │ │
│ └──────────────────────────────────┘ │
│ Trạng thái chuyến: scheduled         │  ← trip-status (bold value)
│                                       │
│ [ Đánh dấu khởi hành ]               │  ← depart Button (gated)
│ [ Đánh dấu hoàn thành ]              │  ← complete Button (gated)
│                                       │
│ ┌ Hàng đợi ┐┌ Manifest ┐             │  ← tab strip
│ └──────────┘└──────────┘             │
│                                       │
│ ── QUEUE tab ──                       │
│ [ Làm mới ]                          │
│ ┌── booking card ──────────────────┐ │
│ │ BB-2026-x4y2-9z01 (→ detail link)│ │  ← link to /op/dashboard/[id]
│ │ Nguyễn Văn A · 2 vé              │ │
│ │ +8490xxxx12                      │ │
│ │ Liên lạc: Đã liên lạc            │ │
│ │ Điểm đón: Mỹ Đình                │ │
│ │ TT thanh toán: pending_cash_…    │ │
│ │ Cờ: ✏ 💵 ⚠                       │ │  ← amber card bg if escalated
│ └──────────────────────────────────┘ │
│ (empty) "Không có đặt vé nào."        │
│                                       │
│ ── MANIFEST tab ──                    │
│ [ Làm mới ] Cập nhật lần cuối: …     │
│ ┌── passenger card ────────────────┐ │
│ │ BB-… · Trần Thị B · 1 vé         │ │
│ │ Lên xe: ✓   (AC6: no seat col)   │ │
│ └──────────────────────────────────┘ │
│ (empty) "Không có hành khách nào."    │
└──────────────────────────────────────┘
```

### Empty state (no assigned trip)
```
┌──────────────────────────────────────┐
│ Chuyến của tôi                (h1)   │
│ ┌──────────────────────────────────┐ │
│ │ Bạn chưa được phân công chuyến    │ │  ← staff-empty-state
│ │ nào.                              │ │
│ │ Vui lòng liên hệ quản trị viên…   │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

## Layout — Desktop (≥768px)
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Chuyến của tôi                                                                 (h1)    │  ← NO admin nav
│                                                                                       │
│ ── message banner (amber) — after depart/complete / load error ──                     │
│ Trạng thái chuyến: scheduled                                                          │
│                                                                                       │
│ [ Đánh dấu khởi hành ]   [ Đánh dấu hoàn thành ]                                       │
│                                                                                       │
│ ┌ Hàng đợi ┐┌ Manifest ┐  (tab strip — queue active = white + bottom border)          │
│ └──────────┘└──────────┘                                                              │
│                                                                                       │
│ QUEUE: [ Làm mới ]                                                                    │
│ ┌──────────┬───────────┬──────────┬────┬─────────┬──────────┬──────────┬──────┐       │
│ │ Mã đặt   │ Hành khách│ SĐT      │ Vé │ Liên lạc│ Điểm đón │ TT t.toán│ Cờ   │       │
│ ├──────────┼───────────┼──────────┼────┼─────────┼──────────┼──────────┼──────┤       │
│ │BB-..9z01↗│Nguyễn V.A │+8490xx12 │ 2  │Đã l.lạc │Mỹ Đình   │pending_… │✏💵⚠ │ ← amber row if escalated
│ └──────────┴───────────┴──────────┴────┴─────────┴──────────┴──────────┴──────┘       │
│  (Mã đặt links to /op/dashboard/[id])                                                 │
│                                                                                       │
│ MANIFEST: [ Làm mới ]  Cập nhật lần cuối: 20:14 20/05/2026                             │
│ ┌──────────┬───────────┬──────────┬────┬──────────┬─────────┬──────────┬────┬──────┐  │
│ │ Mã đặt   │ Hành khách│ SĐT      │ Vé │ Điểm đón │ Liên lạc│ TT t.toán│Lên │ Cờ   │  │
│ ├──────────┼───────────┼──────────┼────┼──────────┼─────────┼──────────┼────┼──────┤  │
│ │BB-..1a2b │Trần Thị B │+8490xx08 │ 1  │—         │Chưa gọi │paid_op_… │ ✓  │      │  │
│ └──────────┴───────────┴──────────┴────┴──────────┴─────────┴──────────┴────┴──────┘  │
│  (AC6: NO seat column)                                                                │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Page title `h1` "Chuyến của tôi" | inline `<h1>` | existing markup |
| Empty-state panel | inline `<div data-testid=staff-empty-state>` | New? — **Card primitive MISSING** |
| Message banner | inline `<div data-testid=staff-message>` (amber fill) | New? (no Toast/Alert primitive) |
| Trip-status line | inline `<div data-testid=trip-status>` | existing markup |
| Depart Button "Đánh dấu khởi hành" | raw `<button>` → `Button` variant=default | New? (markup raw) |
| Complete Button "Đánh dấu hoàn thành" | raw `<button>` → `Button` variant=default | New? (markup raw) |
| Tab strip (Hàng đợi / Manifest) | raw `<button>`s w/ inline active style | New? — **Tabs primitive MISSING** |
| Refresh Button "Làm mới" (×2) | raw `<button>` → `Button` variant=outline size=sm | New? (markup raw) |
| Queue Table | raw `<table data-testid=staff-queue-table>` | New? — **Table primitive MISSING** |
| Manifest Table | raw `<table data-testid=staff-manifest-table>` (no seat col) | New? — **Table primitive MISSING** |
| Booking-ref link | `<a href=/op/dashboard/[id]>` | existing markup |
| Flag chips (✏/💵/⚠) | inline `<span title>` | promote → Badge |
| Last-updated label | `<span data-testid=manifest-last-updated>` | existing markup |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (initial) | RSC `getStaffDashboard()` | server-hydrated queue + manifest (SSR) |
| Loading (refresh) | "Làm mới" (queue or manifest) | `loading` → that Button label "Đang tải…", disabled |
| Empty — no assignment | `assignedTripId === null` | staff-empty-state panel (no tabs/actions) |
| Empty — queue | `queueRows.length === 0` | "Không có đặt vé nào." |
| Empty — manifest | `manifestRows.length === 0` | "Không có hành khách nào." |
| Error — queue load | queue `!res.ok` | message banner "Lỗi tải hàng đợi." |
| Error — manifest load | manifest `!res.ok` | message banner "Lỗi tải manifest." |
| Busy (depart/complete) | `busy === true` | both action Buttons disabled |
| Success — depart | `departTripApi` ok | status → `departed`; banner "Đã đánh dấu khởi hành." |
| Idempotent depart | `alreadyDeparted` | banner "Chuyến đã được đánh dấu khởi hành." |
| Success — complete | `completeTripApi` ok | status → `completed`; banner "Đã đánh dấu hoàn thành." (triggers T+3 payout schedule) |
| Idempotent complete | `alreadyCompleted` | banner "Chuyến đã được đánh dấu hoàn thành." |
| Depart disabled | status ∈ {departed, completed, cancelled} OR busy | depart Button disabled |
| Complete disabled | status ∈ {completed, cancelled} OR busy | complete Button disabled |
| Action error | API throws | banner "Không thể đánh dấu khởi hành." / "…hoàn thành." |
| Tab — queue active | `tab='queue'` | queue-panel shown; tab styled active |
| Tab — manifest active | `tab='manifest'` | manifest-panel shown; tab styled active |
| Row — escalated | `escalatedAt != null` | amber row/card background + ⚠ |
| Row — cash/manual | `cashFlag` / `manualFlag` | 💵 / ✏ chips |
| Row — picked-up (manifest) | `pickedUpAt != null` | "Lên xe" ✓ (else —) |

## Interactions
- Depart: "Đánh dấu khởi hành" → `departTripApi(tripId)` (POST via `tripsClient`,
  `X-CSRF-Token`) → updates local status; idempotent (`alreadyDeparted`). Sets
  `salesClosed=true` server-side (blocks further bookings).
- Complete: "Đánh dấu hoàn thành" → `completeTripApi(tripId)` → status `completed`;
  server schedules T+3 payout (NotificationLog `payout_scheduled`). Idempotent.
- Tab switch: local `useState` only — no fetch on switch (rows already hydrated).
- Refresh (per tab): queue → `GET /api/op/bookings?tripId=`; manifest →
  `GET /api/op/manifest/[tripId]` (staff-scope guard constrains both to assigned trip).
- Booking-ref link → `/op/dashboard/[bookingId]` (booking detail; where row-level
  cash-collected / picked-up / no-show actions are performed).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| trip + queueRows + manifestRows + generatedAt | RSC render | `getStaffDashboard()` in-process | n/a (SSR) |
| Depart result | "Đánh dấu khởi hành" | `departTripApi` → POST `/api/op/trips/[id]/depart` | local status set (no full refetch) |
| Complete result | "Đánh dấu hoàn thành" | `completeTripApi` → POST `/api/op/trips/[id]/complete` | local status set |
| Refreshed queue | "Làm mới" (queue) | `GET /api/op/bookings?tripId=` | No |
| Refreshed manifest | "Làm mới" (manifest) | `GET /api/op/manifest/[tripId]` | No |

## Open Questions
- Tabs primitive MISSING — current tabs are raw buttons with inline active styling;
  promote to a Tabs primitive (roving-tabindex, `aria-selected`) via `/data-table-design`
  sibling work or a dedicated Tabs build.
- Depart/complete set local status optimistically but do NOT refetch queue/manifest
  — after depart (`salesClosed`) the queue may be stale until manual refresh. Auto-refresh
  the active tab after a lifecycle action?
- Staff cannot mark cash-collected / picked-up / no-show from this dashboard —
  those happen on the linked booking detail. Confirm staff-scope permits those POSTs.
- Auto-chain `/data-table-design` (two Table layouts, mobile→card) and
  `/dashboard-layout` (action band + tabs composition).

## Out of Scope
- Admin nav / multi-trip view (admins use full `/op/dashboard`).
- Trip cancel (admin-only; not on staff dashboard).
- Seat-number column (AC6 excludes it from the manifest).
