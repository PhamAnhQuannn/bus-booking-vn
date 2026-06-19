---
feature: operator-console
target: WCAG 2.2 AA
last-updated: 2026-05-20
status: draft
inherits: docs/design/a11y-global.md
---

# A11y Design: Operator Console

Surfaces: operator dashboard, fleet (buses), routes (+pickup-points drag-reorder), trips
(+templates, paired-return, cancel), manifest[tripId], reports (revenue + payouts), staff,
profile. Wireframes: `docs/design/wireframes/operator-*.md`. Flow:
`docs/design/flows/operator.md`. Form contracts: `form-operator-bus/route/trip/staff.md`.
Inherits global baseline. This is the table-heavy + Dialog-heavy + drag-reorder surface.

## Console Shell (applies to every /op/* page)

- Persistent left sidebar nav (desktop ≥768px) + drawer (mobile) — pending
  `/nav-pattern-pick`; this file specs the a11y contract the chosen pattern must meet.
- `<nav aria-label="Bảng điều hành">` wrapping the sidebar; current page link
  `aria-current="page"`.
- Mobile drawer: trigger button `aria-expanded` + `aria-controls`; drawer is a
  focus-trapped region while open; Esc closes + restores trigger focus.
- Skip link targets `<main id="main">` (operator layout has its OWN skip link instance).
- One `<main>` per page; sidebar is `<nav>`, NOT inside `<main>`.

## Keyboard Map

| Key | Context | Action |
|-----|---------|--------|
| Tab / Shift+Tab | global | sidebar nav → page actions → table → row actions |
| Enter / Space | nav link / row action / CTA | Activate |
| Enter | create/edit form submit | Submit |
| Arrow Up/Down | Select dropdown (route/bus/template) open | Move option |
| Home / End / type-ahead | Select open | Jump first/last / match |
| Space | Checkbox (daysOfMask) | Toggle day |
| Arrow Up/Down | pickup-point row (reorder mode) | Move row up/down |
| Esc | any Dialog (cancel, disable-staff) / open Select / drawer | Close |
| Enter | confirm Dialog primary | Confirm action |

## Tab Order (representative — trips create panel)

sidebar(current) → page "Tạo chuyến" trigger → [panel] routeId Select → busId Select →
departureAt datetime → price → blockedSeats → "Tạo chuyến" submit. Cancel flow: row
"Hủy" → Dialog reason textarea → "Hủy bỏ" → "Xác nhận hủy" (destructive).

## Focus Management

| Trigger | Focus moves to |
|---------|----------------|
| create/edit panel open | first field of panel |
| panel/form validation error | first errored field (top-to-bottom precedence) |
| server error (BUS_OVERLAP / MAINTENANCE_OVERLAP / PHONE_TAKEN / ALREADY_ASSIGNED / generic) | banner `role="alert"` (or inline for PHONE_TAKEN under phone) |
| create/edit success | toast (polite) + list refresh; focus returns to triggering control |
| cancel Dialog open | reason textarea (focus trap) |
| disable-staff Dialog open | Dialog heading (focus trap) |
| Dialog Esc / cancel | restore trigger focus |
| Select open | active/selected option |
| reorder via keyboard | moved row retains focus; position announced polite |

## Live Regions

| Region | Pattern | Copy |
|--------|---------|------|
| success toast | `role="status" aria-live="polite"` | "Đã tạo chuyến" / "Đã hủy chuyến" / "Đã thêm nhân viên — mật khẩu tạm đã gửi qua SMS" / "Đã vô hiệu hóa" / "Đã phân công" / "Đã lưu tuyến" / "Đã cập nhật thứ tự" |
| conflict/error banner | `role="alert" aria-live="assertive"` | overlap / maintenance / already-assigned / reorder-conflict / generic VN copy |
| field errors | `role="alert"` id `<field>-err` | verbatim from form contract |
| idempotent cancel (already_cancelled:true) | toast polite | "Chuyến đã được hủy trước đó." (treated as success, NOT error) |
| pickup-point reorder position | `aria-live="polite"` | "Đã chuyển '{name}' tới vị trí N trên M" |
| optimistic reorder revert | banner assertive | "Danh sách đã thay đổi. Vui lòng tải lại." |

## Tables (manifest, bookings, fleet, routes, reports)

Real `<table>` (Table primitive MISSING — build):
- `<caption>` naming the table (e.g. "Danh sách hành khách chuyến #..."); may be `sr-only`.
- `<th scope="col">` headers; row-header `<th scope="row">` where a row has a natural key.
- Sortable columns: header button + `aria-sort="ascending|descending|none"`.
- Row actions (mark cash-collected / picked-up / no-show on manifest; view/edit elsewhere)
  are real `<button>`s inside cells, ≥44px hit area via row-height + padding (global
  dense-table caveat allows Button sm/icon-sm here).
- Empty state: a single full-width cell with VN copy, NOT a bare empty `<tbody>`.
- Status shown as Badge (MISSING — build): never color-only — include text label
  (e.g. "Đã thu tiền", "Đã lên xe", "Vắng mặt"). Defer column layout to `/data-table-design`.

## daysOfMask Checkbox Group (recurring template)

`<fieldset><legend>Ngày trong tuần</legend>` wrapping 7 base-ui Checkboxes (Mon=1..Sun=64).
Each `<label>`'d (T2…CN). Group-level error (`role="alert"`) when none selected: "Vui lòng
chọn ít nhất một ngày trong tuần". Arrow/Space per global Checkbox spec.

## salesClosed Toggle (trip edit)

`role="switch" aria-checked` toggle; label "Đóng bán vé"; state change announced polite.

## Screen Reader Script (manifest, VoiceOver vi)

1. "Bảng điều hành, điều hướng" → "Chuyến đi, mục hiện tại"
2. "Danh sách hành khách chuyến Hà Nội–Hải Phòng 07:00, bảng, 12 hàng 5 cột" (caption)
3. "Tên hành khách, cột" / "Số ghế, cột" / "Trạng thái, cột" (th scope=col)
4. "Nguyễn Văn A, 12A, Chờ lên xe" (row) → "Đánh dấu đã lên xe, nút"
5. activate → toast "Đã cập nhật", polite

## Destructive Dialogs (cancel trip, disable staff)

`role="dialog" aria-modal="true"`, focus trap, Esc closes (cancel is dismissible),
`aria-labelledby`+`aria-describedby`. Cancel-trip Dialog holds reason textarea (min 10
chars, error inline `role="alert"`). Confirm buttons Button `destructive` (SOFT) + icon +
text (not color-only). Banner inside Dialog on server error.

## Touch Targets

Sidebar nav links ≥44px. Form submits + Dialog buttons ≥44px. Dense table row actions:
sm/icon-sm visual permitted IF row height + cell padding yield ≥44px hit area (global
caveat). Drag handles (pickup reorder) ≥44px AND keyboard-operable (↑/↓), not pointer-only.

## I7 Note

Operator IS price authority — trip/template price accepted on body (`/api/op/**` I7-exempt).
No a11y impact; noted so build doesn't treat price field as tampering-guarded.

## Out of Scope

- Manifest passenger transition endpoints exist in flow contract; depart/complete trip
  mark actions live on trip-detail/manifest (NOT the create form) — build wires.
- RBAC beyond staff role (role immutable in UI).
- Operator-landing reconciliation (`/op/profile` source vs `/op/dashboard` flow doc) —
  resolve in build; both must meet this shell a11y contract.

## Open Questions

- Inherits global F1 (ring), F2 (muted-on-muted — watch dense table secondary text), F3
  (border-input). Dense operator tables are where F2 bites most (metadata text on zebra/
  muted rows) — keep secondary text on `background`/`card`, not on muted fill.
- Nav pattern (sidebar vs drawer breakpoint) pending `/nav-pattern-pick`; dashboard layout
  pending `/dashboard-layout`.
