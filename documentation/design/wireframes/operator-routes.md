---
screen: operator-routes
route: /op/routes
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Routes (Quản lý tuyến đường)

## Purpose
Manage the operator's routes (origin/destination/duration) and per-route pickup
points (add / reorder / deactivate). Source: `app/op/routes/page.tsx` (RSC loads
`listRoutes({operatorId})`) + `RoutesClient.tsx` + `RouteEditDialog.tsx`
(create/edit modal) + `PickupPointsPanel.tsx` (inline subview). Mutations hit
`/api/op/routes**` with CSRF double-submit. Currently inline-style.

## Entry Points
- Operator nav shell (`operator-dashboard.md`) → "Tuyến đường".
- Direct nav `/op/routes` (RSC redirects: no session → `/op/login`;
  `requiresPasswordChange` → `/op/first-login`).

## Device Targets
- Mobile (375–767px) — table → stacked cards; dialog full-screen sheet
- Desktop (≥768px) — primary (data table + centered modal dialog); max-width ~900px

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| [≡] Nav shell                        |
+--------------------------------------+
| H1 Quản lý tuyến đường               |
| Danh sách tuyến đường. Mỗi nhà xe    |
| chỉ thấy tuyến của riêng mình.       |
+--------------------------------------+
| [ message banner ]                   |  ← routes-message
+--------------------------------------+
| [ Thêm tuyến mới ]                   |  ← opens RouteEditDialog (create)
+--------------------------------------+
| Danh sách tuyến (N)                  |
| ┌─ card (per route) ─────────────┐   |
| | Điểm đi:   Hà Nội              |   |
| | Điểm đến:  Hải Phòng           |   |
| | Thời gian: 120 phút            |   |
| | Trạng thái: ● Hoạt động        |   |  ← green active / red disabled
| | [Sửa] [Điểm đón] [Vô hiệu hoá] |   |  ← actions hidden if deactivated
| | ── expanded: PickupPointsPanel ─|   |
| |  Điểm đón (N)                  |   |
| |  #1 Bến xe Mỹ Đình  [↑][↓][Xoá]|   |
| |  Tên     [____________]        |   |
| |  Địa chỉ [____________]        |   |
| |  [ Thêm điểm đón ]             |   |
| └────────────────────────────────┘   |
+--------------------------------------+
| ┌─ RouteEditDialog (sheet) ──────┐   |  ← full-screen on mobile
| | Thêm tuyến mới / Sửa tuyến     |   |
| | Điểm đi   [____________]       |   |
| | Điểm đến  [____________]       |   |
| | Thời gian [__60__] phút        |   |
| | [ Huỷ ]            [ Tạo/Lưu ] |   |
| └────────────────────────────────┘   |
+--------------------------------------+
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------------------+
| Nav shell                                                            |
+----------------------------------------------------------------------+
| H1 Quản lý tuyến đường                                              |
+----------------------------------------------------------------------+
| [ message banner ]                                  routes-message   |
+----------------------------------------------------------------------+
| [ Thêm tuyến mới ]                                                   |
+----------------------------------------------------------------------+
| Danh sách tuyến (N)                                                  |
| ┌──────────┬───────────┬──────────────┬───────────┬───────────────┐ |
| | Điểm đi  | Điểm đến  | Thời gian(ph) | Trạng thái| Hành động     | |
| ├──────────┼───────────┼──────────────┼───────────┼───────────────┤ |
| | Hà Nội   | Hải Phòng | 120          | ●Hoạt động| [Sửa][Điểm đón]| |
| |          |           |              |           | [Vô hiệu hoá] | |
| ├──────────┴───────────┴──────────────┴───────────┴───────────────┤ |
| | ▼ PickupPointsPanel (expanded, colSpan=5)                       | |
| |   Điểm đón (N)                                                  | |
| |   #  Tên              Địa chỉ            Hành động               | |
| |   1  Bến xe Mỹ Đình   123 Phạm Hùng     [↑][↓][Xoá]            | |
| |   Tên [____]  Địa chỉ [________]        [Thêm điểm đón]         | |
| └────────────────────────────────────────────────────────────────┘ |
+----------------------------------------------------------------------+
|         ┌─ RouteEditDialog (modal, role=dialog, aria-modal) ─┐       |
|         | Thêm tuyến mới / Sửa tuyến                          |       |
|         | Điểm đi   [____________]                            |       |
|         | Điểm đến  [____________]                            |       |
|         | Thời gian [__60__]                                  |       |
|         |                          [ Huỷ ]  [ Tạo / Lưu ]     |       |
|         └─────────────────────────────────────────────────────┘     |
+----------------------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell | `operator-dashboard.md` (reference) | — |
| Message banner | inline `div` → status banner | New? (Banner/Alert) |
| "Thêm tuyến mới" trigger | Button(default) | — |
| Routes table | inline `<table>` | **Table New?** (data-table-design) |
| Status pill (Hoạt động / Vô hiệu hoá) | inline colored `span` | **Badge New?** (green/red) |
| Row actions (Sửa / Điểm đón / Vô hiệu hoá) | Button(ghost / destructive) | — |
| RouteEditDialog | `RouteEditDialog.tsx` (custom modal) | **Dialog New?** (primitive missing) |
| Route form inputs (origin/dest/duration) | Input | Input ✓; **Label New?** |
| PickupPointsPanel | `PickupPointsPanel.tsx` | — |
| Pickup table + reorder arrows | inline `<table>` + ChevronUp/Down (lucide) | **Table New?**; Button(icon-sm) |
| Add-pickup form (Tên / Địa chỉ) | inline `form` | Input ✓; **Label New?** |
| Confirm dialogs (deactivate route/pickup) | native `confirm()` | **Dialog New?** |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (routes) | RSC server-render | server-rendered list |
| Loading (pickup panel) | on expand, before fetch | "Đang tải..." |
| Empty (routes) | `routes.length === 0` | "Chưa có tuyến nào." |
| Empty (pickup) | no active points | "Chưa có điểm đón nào." |
| Busy | mutation in-flight | "Đang xử lý..."; buttons disabled |
| Success: create | POST 201 | banner "Đã tạo tuyến mới."; dialog closes; refresh |
| Success: edit | PATCH 200 | banner "Đã cập nhật tuyến."; dialog closes; refresh |
| Success: deactivate | POST 200 | banner "Đã vô hiệu hoá tuyến."; status → red |
| Deactivated route | `route.deactivatedAt !== null` | status pill "Vô hiệu hoá" (red); **all actions hidden** |
| Success: pickup add | POST 201 | banner "Đã thêm điểm đón."; form reset; reload |
| Success: pickup reorder | PATCH 200 | silent reload (no banner) |
| Success: pickup deactivate | POST 200 | banner "Đã vô hiệu hoá điểm đón."; reload |
| Disabled: reorder arrows | first row ↑ / last row ↓ | arrow disabled at list bounds |
| Disabled: dialog save | empty origin/destination | Save disabled |
| reactivation_not_supported | reactivate disabled route | banner "Không hỗ trợ kích hoạt lại tuyến đã bị vô hiệu hoá" |
| already_deactivated | double-deactivate | banner "Tuyến đã bị vô hiệu hoá trước đó" |
| too_many_pickup_points | >50 pickup points | banner "Đã đạt tối đa 50 điểm đón" |
| unknown / incomplete_reorder | bad orderedIds payload | banner "Danh sách thứ tự chứa điểm đón không xác định" / "…không đầy đủ" |
| not_found / invalid_input / bad_request | stale id / bad body | mapped Vietnamese banner |
| Generic error | unmapped code | "Đã xảy ra lỗi" |

## Interactions
- Create: "Thêm tuyến mới" → RouteEditDialog (create) → submit → POST
  `/api/op/routes` → 201 closes dialog + refresh.
- Edit: "Sửa" → RouteEditDialog (edit, pre-filled) → PATCH `/api/op/routes/[id]`.
- Deactivate route: "Vô hiệu hoá" → `confirm()` → POST `…/deactivate`.
- Pickup points: "Điểm đón" toggles inline panel; panel mounts → GET
  `…/pickup-points`. Add → POST. Reorder ↑/↓ recomputes `orderedIds`,
  PATCH full array. Deactivate → `confirm()` → POST `…/[ppId]/deactivate`.
- Dialog: backdrop click or "Huỷ" closes; `aria-modal="true"`.
- All non-GET requests carry `X-CSRF-Token`.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Initial route list | page load (RSC) | `listRoutes({operatorId})` | No (server) |
| Route list refresh | after route mutation | GET `/api/op/routes` | No (refetch) |
| Pickup points | on panel mount | GET `/api/op/routes/[id]/pickup-points` | No (lazy) |
| Create / edit / deactivate route | user action | POST/PATCH `/api/op/routes*` | No |
| Pickup add / reorder / deactivate | user action | POST/PATCH/`deactivate` | No (await + reload) |

## Open Questions
- **Table primitive missing** — routes + pickup both raw `<table>`. Auto-chain
  `/data-table-design` (shared operator Table; reorder affordance for pickup).
- **Dialog primitive missing** — `RouteEditDialog` is a custom inline modal;
  promote to Dialog (focus trap, Esc-close per a11y minimums).
- Pickup reorder is arrow-button only (no drag-drop) — confirm acceptable for
  ≤50 points; drag-drop would need a new primitive.
- Status pill color uses raw red/green inline — pending semantic
  `success`/`warning` token decision (design-system Open Question).
- Reorder PATCH sends the full ordered array on every single move (no debounce)
  — fine at small N; flag if pickup count grows.

## Out of Scope
- Route reactivation (`reactivation_not_supported`).
- Pickup-point editing (only add / reorder / deactivate; no name/address PATCH).
- Cross-route pickup sharing (each pickup belongs to one route).
