---
screen: operator-trip-detail
route: /op/trips/[id]
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Trip Detail (Chi tiết chuyến xe)

## Purpose
Single-trip detail + per-trip actions: block seats, reassign bus, sales-toggle,
create paired return, assign service staff (admin only), and cancel (idempotent).
Source: `app/op/trips/[id]/page.tsx` (RSC loads `getTrip(operatorId, id)`,
`getOperatorStaff()`) + `TripDetailClient.tsx`. Mutations hit `/api/op/trips/[id]*`
and `/api/op/staff*` with CSRF. Currently inline-style; max-width ~800px.

> Lifecycle (flow `operator.md`): scheduled → departed → completed/cancelled.
> Like the list view, `depart`/`complete` endpoints exist but are **not yet
> surfaced** in `TripDetailClient.tsx` — wireframed below in the lifecycle
> section so they gate correctly when wired.

## Entry Points
- From `operator-trips.md` row ID link → `/op/trips/[id]`.
- Direct nav (RSC redirects: no session → `/op/login`; `requiresPasswordChange`
  → `/op/first-login`; trip not found / cross-operator → **404 notFound**).

## Device Targets
- Mobile (375–767px) — single-column stacked sections
- Desktop (≥768px) — single column, ~800px centered (already narrow; not a table)

## Layout — Mobile (≤767px) and Desktop (≥768px)
```
+--------------------------------------+
| [≡] Nav shell                        |
+--------------------------------------+
| H1 Chi tiết chuyến xe                |
+--------------------------------------+
| [ trip-detail-message banner ]       |
+--------------------------------------+
| ┌─ Thông tin chuyến ─────────────┐   |  ← summary (definition list)
| | ID:        3f8a91c2-…          |   |  ← monospace
| | Tuyến:     <routeId>           |   |
| | Xe:        <busId>             |   |
| | Khởi hành: 12/06/2026 08:00    |   |
| | Giá:       250.000đ            |   |
| | Trạng thái: scheduled          |   |  ← trip-status
| | Đóng bán:  Không               |   |
| | Ghế còn:   28                  |   |
| | Ghế chặn:  2                   |   |
| └────────────────────────────────┘   |
|                                      |
|  --- below sections hidden if cancelled ---
|                                      |
| ┌─ Chặn ghế ─────────────────────┐   |
| | Số ghế chặn [_2_] [ Cập nhật ] |   |
| └────────────────────────────────┘   |
| ┌─ Đổi xe ───────────────────────┐   |
| | [ ID xe mới ___________ ][Đổi xe]|  |
| └────────────────────────────────┘   |
| ┌─ Bán vé ───────────────────────┐   |
| | [ Đóng bán vé / Mở bán vé ]    |   |
| └────────────────────────────────┘   |
| ┌─ Tạo chuyến về ────────────────┐   |
| | Giờ KH chuyến về [datetime]    |   |
| | Giá (trống = giá đi) [_______] |   |
| | [ Tạo chuyến về ]              |   |
| └────────────────────────────────┘   |
| ┌─ Gán nhân viên phục vụ (admin) ┐   |  ← only if isAdmin
| | Hiện tại: Nguyễn Văn A         |   |
| | [ — Chọn nhân viên — ▾ ]       |   |
| | [ Gán nhân viên ]              |   |
| └────────────────────────────────┘   |
| ┌─ Huỷ chuyến (destructive) ─────┐   |  ← red-bordered section
| | [ Huỷ chuyến ]                 |   |
| └────────────────────────────────┘   |
|                                      |
|  (future, gated by status)           |
| ┌─ Vòng đời chuyến ───────────────┐  |
| | [Đánh dấu khởi hành]* scheduled |  |  ← only if status===scheduled
| | [Đánh dấu hoàn tất]*  departed  |  |  ← only if status===departed
| └─────────────────────────────────┘  |
+--------------------------------------+
  * = depart/complete not yet wired (see Open Questions)
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell | `operator-dashboard.md` (reference) | — |
| Message banner | inline `div` → status banner | New? (Banner/Alert) |
| Trip summary | inline `<dl>` grid | **Card New?** (key/value summary) |
| Section cards | inline bordered `<section>` | **Card New?** |
| Block-seats input + Cập nhật | Input(number) + Button | Input ✓; **Label New?** |
| Reassign-bus input + Đổi xe | Input(text, placeholder ID) + Button | Input ✓ |
| Sales-toggle button | Button(outline) | — |
| Paired-return form (datetime + price) | Input | Input ✓; **Label New?** |
| Assign-staff select + Gán | native `<select>` + Button | **Select New?** |
| Cancel section + button | Button(destructive) in red Card | destructive is **soft** (design-system) |
| Depart / Complete (future) | not built | New? (lifecycle buttons, status-gated) |
| Cancel reason prompt / confirm | native `prompt()` / `confirm()` | **Dialog New?** |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading | RSC server-render | server-rendered detail |
| 404 | trip missing / cross-operator | Next `notFound()` page |
| Busy | mutation in-flight (`busy`) | action buttons disabled |
| Status: scheduled | `trip.status === 'scheduled'` | all action sections shown; (future) Depart available |
| Status: departed | `trip.status === 'departed'` | edit sections still shown; (future) Complete available |
| Status: completed | `trip.status === 'completed'` | edit sections shown (no completed-guard in client today) — flag Open Q |
| **Status: cancelled** | `trip.status === 'cancelled'` | **all action sections hidden**; only summary renders |
| Success: block seats | blockSeatsApi ok | banner "Đã cập nhật ghế chặn."; summary updates |
| Success: reassign bus | reassignBusApi ok | banner "Đã đổi xe."; input clears; summary updates |
| Success: sales toggle | salesToggleApi ok | banner "Đã đóng/mở bán vé."; summary updates |
| Success: paired return | pairedReturnApi ok | banner "Đã tạo chuyến về: <id8>…" |
| Success: assign staff | assignServiceApi ok | banner "Đã gán <name> cho chuyến này."; current-staff line updates |
| **Idempotent cancel** | 2nd cancel → 200 `{already_cancelled:true}` (B3) | success banner; sections hide (status→cancelled) |
| Cancel reason too short | reason `< 10` chars | banner "Lý do phải có ít nhất 10 ký tự."; no request |
| Empty reassign-bus id | blank input | banner "Nhập ID xe mới."; no request |
| Empty paired-return time | blank datetime | banner "Chọn giờ khởi hành chuyến về."; no request |
| Empty assign-staff | no selection | banner "Chọn nhân viên để gán."; no request |
| block_exceeds_available | block count > available | banner "Số ghế chặn vượt số ghế còn" |
| capacity_too_small | new bus too small | banner "Xe mới không đủ chỗ: cần N, xe có M." (uses required/provided) |
| **bus_overlap_with_outbound (422 here)** | paired-return bus busy (B4 — 422 per AC6) | banner "Xe bận chuyến khác cùng giờ" — **422** (reassign-bus path returns 409 for same code; B4 SPEC CONFLICT) |
| no_reverse_route | no reverse route exists | banner "Không tìm thấy tuyến ngược chiều" |
| bus_deactivated / bus_in_maintenance | bus state guards | mapped Vietnamese banner |
| trip_not_assignable | trip cancelled/departed/completed for staff assign | banner "Chuyến không thể gán (đã huỷ/khởi hành/hoàn tất)" |
| trip_not_found / not_found / invalid_input | stale id / bad body | mapped Vietnamese banner |
| Generic error | unmapped code | "Đã xảy ra lỗi" |

## Interactions
- Block seats: set count → "Cập nhật" → `blockSeatsApi` → updates summary.
- Reassign bus: enter bus id → "Đổi xe" → `reassignBusApi`
  (POST `…/reassign-bus`). `bus_overlap_with_outbound` here → **409**.
- Sales toggle: "Đóng/Mở bán vé" → `salesToggleApi`.
- Paired return: pick return datetime (+ optional price) → "Tạo chuyến về" →
  `pairedReturnApi`. `bus_overlap_with_outbound` here → **422** (B4 conflict).
- Assign staff (admin only): pick staff → "Gán nhân viên" → `assignServiceApi`
  (single-trip exclusivity: prior assignee cleared in local state).
- Cancel (idempotent): "Huỷ chuyến" → `prompt()` reason (≥10) → `confirm()` →
  `cancelTripApi` → status→cancelled; B3 idempotent 200 on 2nd cancel.
- All non-GET requests carry `X-CSRF-Token`.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Trip detail | page load (RSC) | `getTrip(operatorId, id)` | No (server) |
| Staff list + isAdmin | page load (RSC) | `getOperatorStaff()` | No (server) |
| Block seats | user action | `blockSeatsApi` → returns updated trip | No (await, set from response) |
| Reassign bus | user action | `reassignBusApi` → updated trip | No |
| Sales toggle | user action | `salesToggleApi` → updated trip | No |
| Paired return | user action | `pairedReturnApi` → new return trip | No |
| Assign staff | user action | `assignServiceApi` → updated staff | No (local merge) |
| Cancel | user action | `cancelTripApi` → counts | No (local status set) |

## Open Questions
- **B4 SPEC CONFLICT** — `bus_overlap_with_outbound` returns **422** in
  paired-return (AC6) but **409** in reassign-bus (I3). Same error code, two
  status codes across two actions on this one screen. UI maps both to the same
  Vietnamese string ("Xe bận chuyến khác cùng giờ"), so user sees identical
  copy — acceptable, but flag for the deferred canonicalization issue.
- **Depart / Complete not wired** — no lifecycle buttons in `TripDetailClient`.
  Decide placement (here vs list) and status-gating before building.
- **No completed-status guard** — client hides actions only when `cancelled`;
  a `completed` trip still renders edit sections. Should completed lock edits?
- Reassign-bus takes a **raw bus ID text input** — no bus picker. Promote to a
  Select of the operator's active buses (Select primitive missing).
- Replace `prompt()`/`confirm()` cancel flow with a Dialog (reason ≥10 chars).
- Summary uses raw `<dl>` — promote to Card primitive.

## Out of Scope
- Trip creation (`/op/trips/new`).
- Manifest / passenger cash collection (`operator-manifest.md`).
- Payout settlement (S19 cron; not operator-triggered).
