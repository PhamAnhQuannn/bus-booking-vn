---
screen: operator-fleet
route: /op/buses
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Fleet (Quản lý phương tiện)

## Purpose
Manage the operator's own buses (CRUD) and per-bus maintenance windows. One
operator sees only its own fleet. Source: `app/op/buses/page.tsx` (RSC loads
`getOperatorFleet({activeOnly:true})`) + `BusesClient.tsx` (mutations against
`/api/op/buses*` with CSRF double-submit). Currently inline-style; this doc
targets the normalized token/component surface.

## Entry Points
- Operator nav shell (see `operator-dashboard.md`) → "Phương tiện".
- Direct nav `/op/buses` (RSC redirects: no session → `/op/login`;
  `requiresPasswordChange` → `/op/first-login`).

## Device Targets
- Mobile (375–767px) — table collapses to stacked cards
- Desktop (≥768px) — primary (data table); page max-width ~900px

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| [≡] Nav shell (operator-dashboard)   |
+--------------------------------------+
| H1 Quản lý phương tiện               |
| Danh sách xe đang hoạt động. Mỗi nhà |
| xe chỉ thấy phương tiện của riêng    |
| mình.                                |
+--------------------------------------+
| [ message banner (if any) ]          |  ← data-testid=fleet-message
+--------------------------------------+
| ┌─ Thêm xe mới ──────────────────┐   |
| | Biển số      [____________]    |   |
| | Sức chứa     [__30__]          |   |
| | Loại xe      [ Coach      ▾]   |   |  ← coach/sleeper/limousine
| | [ Thêm xe ]                    |   |
| └────────────────────────────────┘   |
+--------------------------------------+
| Danh sách xe (N)                     |
| ┌─ card (per bus) ───────────────┐   |  ← table row → card
| | Biển số:  51B-123.45           |   |
| | Sức chứa: [_30_] [ Lưu ]       |   |  ← Lưu disabled until changed
| | Loại:     coach                |   |
| | [ Bảo trì ]  [ Vô hiệu hoá ]   |   |  ← Vô hiệu hoá = destructive
| | ── expanded: Khung bảo trì ──  |   |
| |  • 10/06 08:00 → 10/06 12:00   |   |
| |    — Thay lốp   [ Xoá ]        |   |
| |  Bắt đầu  [ datetime-local ]   |   |
| |  Kết thúc [ datetime-local ]   |   |
| |  Lý do    [______________]     |   |
| |  [ Thêm khung ]                |   |
| └────────────────────────────────┘   |
+--------------------------------------+
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------------------+
| Nav shell (operator-dashboard.md)                                    |
+----------------------------------------------------------------------+
| H1 Quản lý phương tiện                                               |
| Danh sách xe đang hoạt động. Mỗi nhà xe chỉ thấy xe của riêng mình.  |
+----------------------------------------------------------------------+
| [ message banner ]                                  fleet-message    |
+----------------------------------------------------------------------+
| ┌─ Thêm xe mới ──────────────────────────────────────────────────┐  |
| | Biển số [__________]  Sức chứa [_30_]  Loại [Coach ▾]  [Thêm xe]|  |
| └────────────────────────────────────────────────────────────────┘  |
+----------------------------------------------------------------------+
| Danh sách xe (N)                                                     |
| ┌────────────┬──────────────────┬────────┬──────────────────────┐   |
| | Biển số    | Sức chứa         | Loại   | Hành động            |   |
| ├────────────┼──────────────────┼────────┼──────────────────────┤   |
| | 51B-123.45 | [_30_] [Lưu]     | coach  | [Bảo trì][Vô hiệu hoá]|  |
| ├────────────┴──────────────────┴────────┴──────────────────────┤   |
| | ▼ Khung bảo trì (expanded row, colSpan=4)                      |   |
| |   • 10/06 08:00 → 10/06 12:00 — Thay lốp        [Xoá]          |   |
| |   Bắt đầu [datetime]  Kết thúc [datetime]  Lý do [____] [Thêm] |   |
| └────────────────────────────────────────────────────────────────┘  |
+----------------------------------------------------------------------+
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell | `operator-dashboard.md` (reference) | — |
| Page title / subtitle | inline `h1`/`p` → typography tokens | — |
| Message banner | inline `div` → status banner (result-page palette) | New? (Banner/Alert) |
| Add-bus form (Biển số, Sức chứa, Loại) | inline `form` | Input ✓ exists; **Label New?**; **Select New?** (busType) |
| Buses table | inline `<table>` | **Table New?** (data-table-design) |
| Inline capacity edit + Lưu | Input + Button(sm) | — |
| Row action buttons (Bảo trì, Vô hiệu hoá) | Button(ghost) / Button(destructive soft) | — |
| Maintenance expander panel | inline expanded `<tr>` | **Disclosure/Accordion New?** |
| Maintenance window list + Xoá | inline `ul`/`li` + Button | **Table New?** for parity |
| datetime-local inputs | native `<input type=datetime-local>` | Input ✓ (date variant) |
| Confirm dialogs (deactivate, delete maint.) | native `confirm()` | **Dialog New?** (replace `confirm()`) |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (initial) | RSC server-render | server-rendered list; no client spinner |
| Empty | `buses.length === 0` | "Chưa có xe nào." |
| Busy | any mutation in-flight (`busy`) | submit shows "Đang xử lý..."; row buttons disabled |
| Success: add | POST 201 | banner "Đã thêm xe."; form reset; list refreshes |
| Success: capacity edit | PATCH 200 | banner "Đã cập nhật."; list refreshes |
| Success: deactivate | POST 200 | banner "Đã vô hiệu hoá xe."; row drops (activeOnly) |
| Disabled: Lưu | `editCapacity === bus.capacity` | Lưu disabled until value changes |
| Disabled: Thêm khung | empty start/end | disabled until both set |
| **plate_in_use (422)** | duplicate license plate on add/edit | banner "Biển số đã tồn tại" |
| **capacity_reduction_blocked (422)** | reduce capacity below paid occupancy | banner "Không thể giảm sức chứa: {tripId} ({occupancy} chỗ), …" (lists violatingTrips) |
| **future_trips_assigned (422)** | deactivate bus with future trips | banner "Còn chuyến tương lai gắn xe này: {tripIds…}" |
| **maintenance_overlap (409)** | overlapping maintenance window add | banner "Khung bảo trì trùng lặp" |
| Maintenance add w/ trip conflict (201 + warning) | window overlaps existing trips but allowed | banner "Đã thêm khung bảo trì. Cảnh báo: N chuyến chồng lấn (…)." |
| reactivation_not_supported | attempt to reactivate | banner "Không hỗ trợ kích hoạt lại" |
| not_found / invalid_input | stale id / bad body | banner "Không tìm thấy" / "Dữ liệu không hợp lệ" |
| Generic error | unmapped code | banner "Đã xảy ra lỗi" |

## Interactions
- Add bus: fill form → "Thêm xe" → POST `/api/op/buses` → 201 resets + refreshes.
- Edit capacity inline: change number → "Lưu" → PATCH `/api/op/buses/[id]`.
- Deactivate: "Vô hiệu hoá" → `confirm()` → POST `/api/op/buses/[id]/deactivate`.
- Maintenance: "Bảo trì" toggles expander; first open lazy-loads
  GET `/api/op/buses/[id]`; add → POST `…/maintenance`; delete → `confirm()` →
  DELETE `…/maintenance/[mid]`.
- All non-GET requests carry `X-CSRF-Token` (from `bb_csrf` cookie).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Initial bus list | page load (RSC) | `getOperatorFleet({activeOnly:true})` | No (server) |
| Bus list refresh | after each mutation | GET `/api/op/buses?activeOnly=1` | No (refetch) |
| Maintenance windows | on row expand | GET `/api/op/buses/[id]` | No (lazy) |
| Add / edit / deactivate | user action | POST/PATCH `/api/op/buses*` | No (await + refresh) |
| Maintenance add/delete | user action | POST/DELETE `…/maintenance` | No (await + reload) |

## Open Questions
- **Table primitive missing** — fleet + maintenance both use raw `<table>`.
  Auto-chain `/data-table-design` for a shared operator Table (sort, sticky
  header, mobile card collapse, expander row).
- Replace native `confirm()` with `Dialog` primitive (Dialog also missing).
- `busType` Select is native `<select>` — promote to Select primitive (missing).
- Maintenance datetime inputs: timezone display (UTC+7) — currently
  `toLocaleString()` (browser locale), confirm VN display contract.
- Capacity edit has no per-row pending/error indicator — global banner only;
  consider inline row error for `capacity_reduction_blocked`.

## Out of Scope
- Bus reactivation (`reactivation_not_supported` — not supported by API).
- Trip reassignment on deactivate (operator must clear future trips first).
- Maintenance-window editing (only add/delete; no PATCH).
