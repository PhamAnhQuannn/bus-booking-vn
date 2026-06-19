---
screen: operator-trip-templates
route: /op/trip-templates
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator Trip Templates (Lịch chạy cố định)

## Purpose
Create and manage recurring trip templates that auto-generate trips on a
day-of-week bitmask within a validity window. Source:
`app/op/trip-templates/page.tsx` (RSC loads `listTemplates(operatorId)`) +
`TemplatesClient.tsx`. Mutations hit `/api/op/trip-templates*` with CSRF.
`daysOfMask` bitmask: T2=1, T3=2, T4=4, T5=8, T6=16, T7=32, CN=64 (range 1–127).
Currently inline-style; max-width ~1000px.

## Entry Points
- From `operator-trips.md` toolbar → "Quản lý lịch cố định".
- Operator nav shell (`operator-dashboard.md`) if linked.
- Direct nav `/op/trip-templates` (RSC redirects: no session → `/op/login`;
  `requiresPasswordChange` → `/op/first-login`).

## Device Targets
- Mobile (375–767px) — form stacked; table → cards
- Desktop (≥768px) — primary (create form + data table); max-width ~1000px

## Layout — Mobile (≤767px)
```
+--------------------------------------+
| [≡] Nav shell                        |
+--------------------------------------+
| H1 Lịch chạy cố định                 |
| Tạo lịch tự động sinh chuyến hàng    |
| ngày theo mặt nạ ngày trong tuần.    |
+--------------------------------------+
| [ templates-message banner ]         |
+--------------------------------------+
| ┌─ Tạo lịch mới ─────────────────┐   |
| | ID tuyến  [______________]     |   |
| | ID xe     [______________]     |   |
| | Giá (VND) [_______]            |   |
| | Giờ KH    [ 08:00 ] (time)     |   |
| | ┌ Ngày trong tuần ───────────┐ |   |
| | |[x]T2 [x]T3 [x]T4 [x]T5     | |   |  ← checkboxes (bitmask)
| | |[x]T6 [ ]T7 [ ]CN           | |   |
| | └────────────────────────────┘ |   |
| | Hiệu lực từ  [ date ]          |   |
| | Hiệu lực đến [ date ]          |   |
| | [ Tạo lịch ]                  |   |
| └────────────────────────────────┘   |
+--------------------------------------+
| Danh sách lịch (N)                   |
| ┌─ card (per template) ──────────┐   |
| | ID:   8c12ff03…                |   |
| | Tuyến: <routeId>               |   |
| | Xe:    <busId>                 |   |
| | Giờ:   08:00                   |   |
| | Ngày:  T2, T3, T4, T5, T6      |   |  ← maskToLabel
| | Hiệu lực: 01/06 → 31/12        |   |
| |           (vô hiệu)            |   |  ← if deactivatedAt
| | [ Vô hiệu hoá ]               |   |  ← hidden if already deactivated
| └────────────────────────────────┘   |
+--------------------------------------+
```

## Layout — Desktop (≥768px)
```
+----------------------------------------------------------------------+
| Nav shell                                                            |
+----------------------------------------------------------------------+
| H1 Lịch chạy cố định                                                |
+----------------------------------------------------------------------+
| [ templates-message banner ]                        templates-message|
+----------------------------------------------------------------------+
| ┌─ Tạo lịch mới ─────────────────────────────────────────────────┐  |
| | ID tuyến [__________]   ID xe [__________]   Giá [_______]      |  |
| | Giờ KH [08:00]                                                  |  |
| | Ngày: [x]T2 [x]T3 [x]T4 [x]T5 [x]T6 [ ]T7 [ ]CN                |  |
| | Hiệu lực từ [date]   Hiệu lực đến [date]        [ Tạo lịch ]    |  |
| └────────────────────────────────────────────────────────────────┘  |
+----------------------------------------------------------------------+
| Danh sách lịch (N)                                                   |
| ┌────────┬────────┬───────┬───────┬───────────────┬──────────┬─────┐ |
| | ID     | Tuyến  | Xe    | Giờ   | Ngày          | Hiệu lực | H.đ.| |
| ├────────┼────────┼───────┼───────┼───────────────┼──────────┼─────┤ |
| | 8c12ff…| route1 | bus1  | 08:00 | T2,T3,T4,T5,T6| 01/06→   |[Vô  | |
| |        |        |       |       |               | 31/12    | hiệu]| |
| ├────────┼────────┼───────┼───────┼───────────────┼──────────┼─────┤ |
| | a93b00…| route2 | bus2  | 14:00 | T7, CN        | 01/06→   | (—) | |
| |        |        |       |       |               | 31/12    |     | |
| |        |        |       |       |               | (vô hiệu)|     | |
| └────────┴────────┴───────┴───────┴───────────────┴──────────┴─────┘ |
+----------------------------------------------------------------------+
  ID = monospace, 8-char prefix + …
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Nav shell | `operator-dashboard.md` (reference) | — |
| Message banner | inline `div` → status banner | New? (Banner/Alert) |
| Create form (route/bus/price/time/dates) | inline `form` | Input ✓; **Label New?** |
| Day-of-week checkbox group | inline `<fieldset>` + native checkboxes | **Checkbox New?**; fieldset/legend keep |
| Time input | native `<input type=time>` | Input ✓ (time variant) |
| Date inputs (validFrom/validUntil) | native `<input type=date>` | Input ✓ (date variant) |
| Templates table | inline `<table>` | **Table New?** (data-table-design) |
| Day-mask display (maskToLabel) | inline text | — |
| Deactivate button | Button(destructive soft) | — |
| Confirm deactivate | native `confirm()` | **Dialog New?** |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading | RSC server-render | server-rendered list |
| Empty | `templates.length === 0` | "Chưa có lịch nào." |
| Busy | mutation in-flight (`busy`) | submit "Đang xử lý..."; buttons disabled |
| Success: create | createTemplateApi ok | banner "Đã tạo lịch cố định."; form reset (defaults: 08:00, mask 31 = T2–T6); refresh |
| Success: deactivate | patchTemplateApi ok | banner "Đã vô hiệu hoá lịch."; refresh |
| Deactivated template | `template.deactivatedAt !== null` | Hiệu lực cell shows " (vô hiệu)"; **Vô hiệu hoá button hidden** |
| Validation: no day selected | `daysMask < 1 || > 127` (client guard) | banner "Chọn ít nhất một ngày trong tuần."; no request |
| Confirm deactivate declined | `confirm()` → false | no-op |
| not_found | stale template id | banner "Không tìm thấy" |
| invalid_input | bad body (server) | banner "Dữ liệu không hợp lệ" |
| Generic error | unmapped code | "Đã xảy ra lỗi" |

## Interactions
- Create: fill route/bus/price/time, toggle day checkboxes (bitmask), set
  validFrom/validUntil → "Tạo lịch" → `createTemplateApi` → 201 resets form +
  refresh. Client guards mask ∈ [1,127] before request.
- Toggle day: checkbox flips the corresponding bit (`m & bit ? m & ~bit : m | bit`).
- Deactivate: "Vô hiệu hoá" → `confirm()` → `patchTemplateApi(id,
  {deactivatedAt: now})` → refresh. No reactivation.
- All non-GET requests carry `X-CSRF-Token`.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Initial template list | page load (RSC) | `listTemplates(operatorId)` | No (server) |
| Template list refresh | after each mutation | GET `/api/op/trip-templates` | No (refetch) |
| Create | user action | `createTemplateApi` → POST | No (await + refresh) |
| Deactivate | user action | `patchTemplateApi` → PATCH | No (await + refresh) |

## Open Questions
- **Table primitive missing** — auto-chain `/data-table-design`.
- **Checkbox primitive missing** — day-of-week group is native checkboxes;
  promote to Checkbox + keep `fieldset`/`legend` for a11y grouping.
- Route/bus are **raw ID text inputs** (no picker) — promote to Selects of the
  operator's active routes/buses (Select primitive missing); raw IDs are
  error-prone.
- Templates have create + deactivate only (no edit) — confirm no PATCH-edit needed.
- No preview of which dates the mask + validity window will generate — consider a
  "next N generated trips" preview before save.
- Generated-trip visibility / link from a template row to its trips — not present.

## Out of Scope
- The trip-generation cron itself (server-side; reads templates).
- Editing an existing template's schedule (only create / deactivate).
- One-off trip creation (`/op/trips/new`).
