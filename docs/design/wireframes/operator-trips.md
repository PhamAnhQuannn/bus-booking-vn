---
screen: operator-trips
route: /op/trips
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Trips (Quản lý chuyến xe)

## Purpose
List the operator's trips with status, price, available seats, and per-row
lifecycle actions. Source: `app/op/trips/page.tsx` (RSC loads
`listTrips(operatorId)`) + `TripsClient.tsx`. The list view exposes
**sales-toggle** and **cancel** (idempotent) only; per-trip detail actions
(block seats, reassign bus, paired return, assign staff) live on
`operator-trip-detail.md`. Mutations hit `/api/op/trips*` with CSRF.

> Lifecycle note (flow `operator.md`): scheduled → departed → completed/cancelled.
> `depart` (POST `/trips/[id]/depart`) and `complete` (POST `/trips/[id]/complete`,
> → T+3 payout schedule) are defined endpoints but **not yet surfaced** in
> `TripsClient.tsx` — see Open Questions. This wireframe specifies where they
> belong so lifecycle buttons gate correctly when wired.

## Entry Points
- Operator nav shell (`operator-dashboard.md`) → "Chuyến xe".
- Direct nav `/op/trips` (RSC redirects: no session → `/op/login`;
  `requiresPasswordChange` → `/op/first-login`).
- Outbound: "Tạo chuyến mới" → `/op/trips/new`; "Quản lý lịch cố định" →
  `/op/trip-templates`; row ID link → `/op/trips/[id]` (detail).

## Device Targets
- Mobile (375–767px) — table → stacked cards
- Desktop (≥768px) — primary (data table); max-width ~1000px

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| [≡] Nav shell                        |
+--------------------------------------+
| H1 Quản lý chuyến xe                 |
| Danh sách chuyến xe. Mỗi nhà xe chỉ  |
| thấy chuyến của riêng mình.          |
+--------------------------------------+
| [ message banner ]                   |  ← trips-message
+--------------------------------------+
| [ Tạo chuyến mới ]                   |
| [ Quản lý lịch cố định ]             |
+--------------------------------------+
| Danh sách chuyến (N)                 |
| ┌─ card (per trip) ──────────────┐   |
| | ID: 3f8a91c2…  → (detail link) |   |
| | Khởi hành: 12/06/2026 08:00    |   |
| | Giá:  250.000đ                 |   |
| | Trạng thái: ● scheduled        |   |  ← status badge
| |             (đóng bán)         |   |  ← if salesClosed
| | Ghế còn: 28                    |   |
| | [Đóng/Mở bán]  [Huỷ]           |   |  ← hidden if cancelled
| | [Đánh dấu khởi hành]*          |   |  ← *future: only if scheduled
| | [Đánh dấu hoàn tất]*           |   |  ← *future: only if departed
| └────────────────────────────────┘   |
+--------------------------------------+
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------------------+
| Nav shell                                                            |
+----------------------------------------------------------------------+
| H1 Quản lý chuyến xe                                                |
+----------------------------------------------------------------------+
| [ message banner ]                                  trips-message    |
+----------------------------------------------------------------------+
| [ Tạo chuyến mới ]  [ Quản lý lịch cố định ]                        |
+----------------------------------------------------------------------+
| Danh sách chuyến (N)                                                 |
| ┌─────────┬──────────────────┬─────────┬────────────┬───────┬──────┐ |
| | ID      | Khởi hành        | Giá     | Trạng thái | Ghế   | H.động| |
| ├─────────┼──────────────────┼─────────┼────────────┼───────┼──────┤ |
| | 3f8a91…→| 12/06 08:00      |250.000đ | ●scheduled | 28    |[Đóng | |
| |         |                  |         | (đóng bán) |       | bán] | |
| |         |                  |         |            |       |[Huỷ] | |
| ├─────────┼──────────────────┼─────────┼────────────┼───────┼──────┤ |
| | a17c02…→| 12/06 14:00      |250.000đ | ●departed  | 0     |[Hoàn | |
| |         |                  |         |            |       | tất]*| |
| ├─────────┼──────────────────┼─────────┼────────────┼───────┼──────┤ |
| | b9e441…→| 11/06 06:00      |250.000đ | ●cancelled | —     | (—)  | |
| └─────────┴──────────────────┴─────────┴────────────┴───────┴──────┘ |
+----------------------------------------------------------------------+
  ID = monospace, 8-char prefix + … , links to /op/trips/[id]
  * = depart/complete buttons not yet wired (see Open Questions)
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell | `operator-dashboard.md` (reference) | — |
| Message banner | inline `div` → status banner | New? (Banner/Alert) |
| Toolbar buttons (Tạo chuyến / lịch cố định) | Button(default) | — |
| Trips table | inline `<table>` | **Table New?** (data-table-design) |
| Trip ID link | inline `<a>` monospace | Link/Button(link); `font-mono` token |
| Status badge (scheduled/departed/completed/cancelled) | inline text | **Badge New?** (lifecycle palette) |
| Sales-toggle button (Đóng bán / Mở bán) | Button(outline) | — |
| Cancel button (Huỷ) | Button(destructive soft) | — |
| Depart / Complete buttons (future) | not yet built | New? (lifecycle action buttons) |
| Cancel reason prompt | native `prompt()` (min 10 chars) | **Dialog New?** (replace prompt) |
| Confirm cancel | native `confirm()` | **Dialog New?** |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (initial) | RSC server-render | server-rendered list |
| Empty | `trips.length === 0` | "Chưa có chuyến nào." |
| Busy | mutation in-flight (`busy`) | row action buttons disabled |
| Status: scheduled | `trip.status === 'scheduled'` | badge scheduled; sales-toggle + Huỷ available; (future) Depart available |
| Status: departed | `trip.status === 'departed'` | badge departed; (future) Complete available; Huỷ still available |
| Status: completed | `trip.status === 'completed'` | badge completed; **no actions** |
| Status: cancelled | `trip.status === 'cancelled'` | badge cancelled; **action cell empty** (all actions hidden) |
| salesClosed flag | `trip.salesClosed === true` | status cell appends " (đóng bán)"; toggle reads "Mở bán" |
| Success: sales toggle | salesToggleApi ok | banner "Đã đóng bán vé." / "Đã mở bán vé."; refresh |
| Success: cancel | cancelTripApi ok | banner "Đã huỷ chuyến. Đặt vé bị huỷ: N. Giữ chỗ bị huỷ: N. SMS: N."; refresh |
| **Idempotent cancel — already cancelled** | 2nd cancel → 200 `{already_cancelled:true}` (B3) | **no error**; success banner (server returns 200, discriminated result; UI treats as success) — cancelled trip shows no Huỷ button so reachable only via stale state |
| Cancel reason too short | reason `< 10` chars (client guard) | banner "Lý do phải có ít nhất 10 ký tự."; no request sent |
| Cancel confirm declined | `confirm()` → false | no-op |
| bus_deactivated | sales-toggle on deactivated bus | banner "Xe đã bị vô hiệu hoá" |
| bus_in_maintenance | sales-toggle while bus in maintenance | banner "Xe đang bảo trì" |
| already_cancelled (error path) | cancel mapped error | banner "Chuyến đã bị huỷ" |
| not_found / invalid_input | stale id / bad body | mapped Vietnamese banner |
| Generic error | unmapped code | "Đã xảy ra lỗi" |

## Interactions
- Sales toggle: "Đóng bán"/"Mở bán" → `salesToggleApi(tripId, !salesClosed)` →
  refresh. Hidden when cancelled.
- Cancel (idempotent): "Huỷ" → `prompt()` reason (≥10 chars) → `confirm()` →
  `cancelTripApi(tripId, reason)` → POST `/api/op/trips/[id]/cancel`. 2nd cancel
  returns 200 `{already_cancelled:true}` (B3 discriminated result, not a thrown
  sentinel) — UI shows success.
- (Future) Depart: only when `status === 'scheduled'`; POST `…/depart`
  (status→departed, salesClosed=true).
- (Future) Complete: only when `status === 'departed'`; POST `…/complete`
  (status→completed, schedules T+3 payout).
- All non-GET requests carry `X-CSRF-Token`.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Initial trip list | page load (RSC) | `listTrips(operatorId)` | No (server) |
| Trip list refresh | after each mutation | GET `/api/op/trips` | No (refetch) |
| Sales toggle | user action | `salesToggleApi` → PATCH | No (await + refresh) |
| Cancel | user action | `cancelTripApi` → POST `…/cancel` | No (await + refresh) |
| Depart / Complete (future) | user action | POST `…/depart` / `…/complete` | No |

## Open Questions
- **Depart / Complete actions not wired** — endpoints exist (flow `operator.md`,
  Issue 014) but `TripsClient.tsx` only ships sales-toggle + cancel. Decide:
  surface lifecycle buttons here (gated by status) or only on trip detail.
  This wireframe places them here; confirm.
- **Table primitive missing** — auto-chain `/data-table-design` (status filter,
  date sort, pagination for long lists).
- **Dialog primitive missing** — replace `prompt()`/`confirm()` cancel flow with
  a Dialog capturing the reason (≥10 chars) inline.
- Status badge palette — map scheduled/departed/completed/cancelled to colors;
  pending semantic `success`/`warning` token decision.
- No list filters today (status, date range) — likely needed at scale.

## Out of Scope
- Trip creation form (`/op/trips/new` — separate screen).
- Recurring templates (`operator-trip-templates.md`).
- Per-trip seat/bus/staff edits (`operator-trip-detail.md`).
- Manifest / cash collection (`operator-manifest.md`).
