---
feature: operator-data-table
decision: one shared operator Table primitive + Badge primitive; mobile→stacked-card at 768px
last-updated: 2026-05-20
status: draft
inherits: docs/design/design-system.md
resolves: data-table "MISSING — build via /data-table-design" flags in a11y-operator-console.md, operator-{fleet,routes,trips,manifest,dashboard}.md
---

# Data-Table Design: Operator Console Tables + Badge

Resolves every "Table primitive MISSING — build" / "Badge MISSING — build" flag across the
operator console. Scope: the 5 table-bearing operator surfaces ONLY. Customer flow uses no
table (results = `<ul>` of cards per `a11y-customer-booking.md`). Account-bookings list MAY
reuse this Table if it ships as a table (deferred — a11y-account.md leaves table-vs-card open).

## Decision

**One shared `<Table>` primitive (semantic `<table>`) + one `<Badge>` primitive**, both new
under `components/ui/`. Every operator table renders the SAME component with column config
passed in — NOT five hand-rolled `<table>`s. Mobile (≤767px) the SAME data renders as
stacked `<Card>` rows (Card itself MISSING — built per `/dashboard-layout`). Single 768px
breakpoint, matches the global `md` and the nav shell breakpoint (`nav-pattern-pick.md`).

No new tokens. Badge lifecycle palette reuses the raw `booking/result` amber/green/red values
already in `globals.css` (design-system.md has NO semantic success/warning token).

## The 5 Consumers (canonical column specs)

Columns are sourced VERBATIM from each wireframe — build uses these, does not re-derive.

### 1. Fleet — `/op/buses` (operator-fleet.md)

| # | Header (VN) | Cell | Sort? |
|---|-------------|------|-------|
| 1 | Biển số | plate (text) | yes |
| 2 | Sức chứa | capacity (number); inline-edit = Input(number) + Button sm | no |
| 3 | Loại | busType Badge (coach/sleeper/limousine) | yes |
| 4 | Hành động | row actions (edit, expand maintenance, deactivate) | no |

Expander row: `colSpan=4`, holds maintenance-windows panel. Statuses surfaced as error banner
(role=alert), NOT a column: plate_in_use(422), capacity_reduction_blocked(422),
future_trips_assigned(422), maintenance_overlap(409).

### 2. Routes — `/op/routes` (operator-routes.md)

| # | Header (VN) | Cell | Sort? |
|---|-------------|------|-------|
| 1 | Điểm đi | originName | yes |
| 2 | Điểm đến | destinationName | yes |
| 3 | Thời gian (ph) | durationMinutes (number) | yes |
| 4 | Trạng thái | Badge (green Hoạt động / red Vô hiệu hóa) | no |
| 5 | Hành động | edit (→RouteEditDialog), expand pickup-points, toggle active | no |

Expander row: `colSpan=5`, holds PickupPointsPanel (reorder ↑/↓ Button icon-sm, disabled at
list bounds; PATCH sends the FULL ordered array, not a delta).

### 3. Trips — `/op/trips` (operator-trips.md)

| # | Header (VN) | Cell | Sort? |
|---|-------------|------|-------|
| 1 | ID | tripId monospace 8-char prefix + "…", links `/op/trips/[id]` | no |
| 2 | Khởi hành | departureAt (VN-local datetime) | yes |
| 3 | Giá | price (VND, `đồng`) | yes |
| 4 | Trạng thái | lifecycle Badge; salesClosed appends " (đóng bán)" | no |
| 5 | Ghế | blockedSeats / capacity | no |
| 6 | Hành động | cancel (→Dialog), salesClosed toggle "Mở bán" / depart / complete | no |

Cancel: reason ≥10 chars in Dialog (replaces native `prompt()`). Idempotent cancel → 200
`{already_cancelled:true}` treated as success toast, NOT error. Depart/complete endpoints
exist (Issue 014) but are NOT yet wired in `TripsClient.tsx` — build wires them here.

### 4. Manifest — `/op/manifest/[tripId]` (operator-manifest.md) — READ-ONLY

| # | Header (VN) | Cell |
|---|-------------|------|
| 1 | Mã đặt | bookingRef monospace |
| 2 | Hành khách | buyerName |
| 3 | SĐT | buyerPhone (raw digits) |
| 4 | Vé | ticketCount |
| 5 | Điểm đón | pickupPointName |
| 6 | Liên lạc | contactStatus |
| 7 | TT thanh toán | payment-status Badge |
| 8 | Lên | picked-up ✓ / — |
| 9 | Cờ | flag chips: ✏ manualFlag, 💵 cashFlag, ⚠ escalatedAt |

**AC6: NO "Ghế"/seat column** (MVP has no per-seat UI — ticketCount only). Read-only: view +
"Làm mới" (refresh, Button outline sm → `GET /api/op/manifest/[tripId]`) only. Booking
transitions happen on booking-detail `/op/dashboard/[bookingId]`, manifest just reflects state.
Row amber-tinted when `escalatedAt != null`. Filters to `MANIFEST_PAYMENT_STATUSES`
(paid_operator_notified, pending_cash_payment, completed); `no_show` rows drop off (not
rendered). Trip-not-found → "Không tìm thấy chuyến xe." GET = safe, no CSRF token.

### 5. Dashboard queue — `/op/dashboard` (operator-dashboard.md)

| # | Header (VN) | Cell |
|---|-------------|------|
| 1 | Mã đặt | bookingRef → `/op/dashboard/[id]` (Button variant=link) |
| 2 | Hành khách | buyerName |
| 3 | SĐT | buyerPhone |
| 4 | Vé | ticketCount |
| 5 | Liên lạc | contactStatus |
| 6 | Điểm đón | pickupPointName |
| 7 | TT thanh toán | payment-status Badge |
| 8 | Khởi hành | trip.departureAt (VN-local) |
| 9 | Cờ | flags ✏ / 💵 / ⚠ |

Filters above table (NOT table-internal): busId Input, serviceDate Input(date, UTC+7
Asia/Ho_Chi_Minh window), routeId Input, contactStatus Select (MISSING primitive), "Lọc"
Button. Cursor pagination "Tải thêm" appends (re-issues query with cursor). Escalated row amber
+ ⚠. RSC reads `listOperatorBookings` + `getUnviewedPaidCount` + `touchLastViewed` in-process
(never self-fetches); "N mới" badge read BEFORE touch.

## Shared `<Table>` Primitive Contract

Build under `components/ui/table.tsx`. Semantic `<table>` (NOT div-grid). Sub-components mirror
shadcn/base-ui convention: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`
(`<th>`), `TableCell` (`<td>`), `TableCaption`.

### Structure + a11y (mirrors a11y-operator-console.md "Tables")

- `<caption>` names each table (e.g. "Danh sách hành khách chuyến #..."); MAY be `sr-only`.
- `<th scope="col">` for every column header. Row-header `<th scope="row">` where a row has a
  natural key (bookingRef on manifest/dashboard, plate on fleet).
- Sortable column = header `<button>` + `aria-sort="ascending|descending|none"` on the `<th>`.
  Only fleet/routes/trips have sortable columns (manifest/dashboard sort server-side, header
  static for MVP — `aria-sort` omitted, not `="none"`, when not sortable).
- Empty state: a single full-width `<td colSpan={N}>` with VN copy, NEVER a bare empty
  `<tbody>`. Copy per surface ("Chưa có xe", "Không có chuyến", "Không tìm thấy hành khách").
- Sticky header: `<thead>` `sticky top-0 bg-background z-10` so long lists keep headers
  visible. Header text on `background` (NOT muted fill) — global F2 caveat (muted-on-muted
  ≈4.45:1; keep secondary text on background/card).

### Row actions (dense 44px caveat)

Row-action buttons are real `<button>`s inside `<td>`. Button primitives are all <44px tall
(largest = lg/36px), so dense table rows use Button `sm`/`icon-sm` visually IF row height +
cell padding yields a ≥44px hit area (global dense-table caveat from a11y-operator-console.md
"Touch Targets"). Standalone non-table CTAs still use lg padded to 44px.

### Expander / disclosure rows

Fleet (maintenance, colSpan=4) + routes (pickup-points, colSpan=5) need disclosure rows. The
expanded panel is a `<tr><td colSpan={N}>`. Trigger = a Button icon-sm in the row's action
cell, `aria-expanded` + `aria-controls` pointing at the panel `<tr>` id. Panel id unique per
row. Collapsed by default. Keyboard: Enter/Space toggles; focus stays on trigger.

### Mobile → stacked card (≤767px)

Below 768px the `<table>` is replaced (NOT reflowed) by a list of `<Card>` rows — one Card per
record, label/value pairs stacked. This is a render-mode swap on the breakpoint, same data
source, NOT two trees. Flags become a chip strip inside the card. Card primitive is MISSING —
built per `/dashboard-layout`. Manifest mobile: passenger cards; dashboard mobile: booking
cards. Expander content (fleet maintenance / routes pickup) renders inline-expanded inside the
card on mobile (no separate disclosure row — the card grows).

## `<Badge>` Primitive Contract

Build under `components/ui/badge.tsx`. cva variants. Text label ALWAYS present — status is
NEVER color-only (a11y-operator-console.md: "include text label"; WCAG 1.4.1). Number badges
("N mới") show the count as text + `aria-label`.

### Variants

| Variant | Surface | bg / text |
|---------|---------|-----------|
| `neutral` | busType (coach/sleeper/limousine), default | `bg-secondary text-secondary-foreground` |
| `success` | route active, paid/completed states | `bg-green-50 text-green-900` (raw `booking/result` palette) |
| `danger` | route disabled, cancelled/failed states | `bg-red-50 text-red-900` |
| `pending` | awaiting/pending states | `bg-amber-50 text-amber-900` |
| `count` | "N mới" unviewed badge | `bg-primary text-primary-foreground`, rounded-full |

No semantic success/warning token exists (design-system.md) — these use the raw amber/green/red
`booking/result` values verbatim. Radius `rounded-sm` (6px) for status badges per design-system
radius scale; `rounded-full` only for the count badge.

### Lifecycle palette mapping (status → variant)

**BookingStatus:**
| status | variant | label (VN) |
|--------|---------|------------|
| awaiting_payment | pending | Chờ thanh toán |
| pending_cash_payment | pending | Chờ thu tiền mặt |
| paid_operator_notified | success | Đã thanh toán |
| completed | success | Hoàn tất |
| cancelled | danger | Đã hủy |
| trip_cancelled | danger | Chuyến đã hủy |
| no_show | danger | Vắng mặt |
| payment_failed_expired | danger | Thanh toán thất bại |

**TripStatus:**
| status | variant | label (VN) |
|--------|---------|------------|
| scheduled | neutral | Đã lên lịch |
| departed | pending | Đã khởi hành |
| completed | success | Hoàn tất |
| cancelled | danger | Đã hủy |

salesClosed (boolean, orthogonal) appends " (đóng bán)" to the trip status label — NOT a
separate badge.

**Route active (boolean):** true → success "Hoạt động"; false → danger "Vô hiệu hóa".

Label maps live in a single `lib/op/statusLabels.ts` (one source) — build does NOT inline VN
strings per component. Enum values sourced verbatim from Prisma schema (BookingStatus,
TripStatus) — no superset (Mistake Log: enum constants from AC verbatim).

## Cursor Pagination ("Tải thêm")

Dashboard queue only (others are bounded per-operator lists, no pagination MVP). Pattern:
"Tải thêm" Button (outline) below the table; click re-issues the list query with the last
row's cursor; new rows APPENDED to existing (not replace). Button hidden when no `nextCursor`.
On mobile, same button below the card list. `aria-live="polite"` region announces "Đã tải thêm
N kết quả" after append (so SR users know rows arrived). Loading state: Button label →
"Đang tải…", disabled.

## Flag Glyphs → accessible chips

The ✏ / 💵 / ⚠ flag glyphs (manifest + dashboard "Cờ" column) are NOT bare emoji. Each is a
small chip: glyph + `sr-only` text or `aria-label`:
- ✏ manualFlag → "Gắn cờ thủ công"
- 💵 cashFlag (paymentMethod==='cash') → "Thanh toán tiền mặt"
- ⚠ escalatedAt → "Đã chuyển cấp"

Chips sit in the cell as an inline strip; on mobile they move to the card's chip strip. Glyph
alone never conveys meaning (1.4.1 / 1.1.1).

## Tokens

| Element | Token / class |
|---------|---------------|
| table surface | `bg-background` (header + body on background, not muted — F2) |
| zebra row (optional) | `even:bg-muted/30` — but keep TEXT on background tone |
| sticky header | `sticky top-0 bg-background z-10` |
| row hover (desktop) | `hover:bg-accent/50` |
| escalated row tint | `bg-amber-50` (raw `booking/result`) |
| cell border | `border-b border-border` |
| sort header focus | `focus-visible:ring-3 ring-ring` (global F1 ring caveat) |
| badge (status) | per variant table above, `rounded-sm` |
| badge (count) | `bg-primary text-primary-foreground rounded-full` |
| row-action button | Button `sm` / `icon-sm` (dense 44px-hit-area caveat) |

## Build Notes

- `Table` + sub-components in `components/ui/table.tsx`; `Badge` in `components/ui/badge.tsx`;
  status→variant+label maps in `lib/op/statusLabels.ts`.
- The mobile card-mode swap is CSS `md:` (table hidden <768px, card-list hidden ≥768px) OR a
  `useMediaQuery` client swap — prefer CSS-only so server-rendered rows work without JS.
  Expander disclosure rows are client state (`'use client'` on the row-group that owns expand).
- Sortable header click is client state; the SORT itself is server-side for manifest/dashboard
  (re-query), client-side array sort acceptable for the bounded fleet/routes/trips lists.
- Reuse Dialog (MISSING — own primitive, built separately) for cancel-trip + route-edit; do
  NOT couple Dialog into Table.

## Out of Scope

- Column show/hide, column reorder, CSV export (post-MVP).
- Multi-row select / bulk actions (no MVP flow needs it).
- Virtualized rows (operator lists are bounded; revisit if a trip exceeds ~200 passengers).
- Account-bookings table styling — deferred until a11y-account.md resolves table-vs-card.

## Open Questions

- Dashboard/manifest server-side sort: which columns get sortable headers in Phase A, or is
  sort fully filter-driven (no clickable headers)? Defer to build; `aria-sort` omitted until a
  sortable header actually ships.
