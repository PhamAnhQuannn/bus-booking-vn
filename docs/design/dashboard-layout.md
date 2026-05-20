---
feature: operator-dashboard-layouts
decision: card-primitive + three dashboard surface layouts (admin queue / reports / staff single-trip)
last-updated: 2026-05-20
status: draft
inherits: docs/design/design-system.md, docs/design/nav-pattern-pick.md, docs/design/data-table-design.md
resolves: operator-dashboard.md / operator-reports-*.md / operator-staff-dashboard.md "/dashboard-layout pending"
---

# Dashboard Layout: Operator Surfaces

Resolves the "pending `/dashboard-layout`" flag in `a11y-operator-console.md`,
`operator-dashboard.md`, and `operator-staff-dashboard.md`. Scope: the layout grammar
(action bands, filter bands, summary regions) for the three operator dashboard surfaces +
the **Card primitive** they all depend on. Tables themselves are owned by
`data-table-design.md`; this doc owns everything AROUND the tables.

Two surfaces live INSIDE the `<OperatorNav>` shell (`nav-pattern-pick.md`): admin dashboard +
reports. One surface (staff single-trip) has NO shell. No new tokens.

## Card Primitive (MISSING — build `components/ui/card.tsx`)

Shared dependency: `data-table-design.md` mobile-card mode, reports trip/summary cards,
staff empty-state panel, account-settings sections (`a11y-account.md`), customer confirmation
panel all need it. Build ONCE.

Surface: `bg-card text-card-foreground rounded-lg border border-border`. Default padding
`p-4` (md: `p-6`). Shadow `shadow-sm` resting only — no hover elevation (admin console, not
marketing).

Sub-components (composition, all forward `className` via `cn`):

| Component | Element | Classes | Notes |
|-----------|---------|---------|-------|
| `Card` | `<div>` | `bg-card text-card-foreground rounded-lg border border-border shadow-sm` | root; no fixed padding (children own it) |
| `CardHeader` | `<div>` | `flex flex-col gap-1 p-4 md:p-6 pb-0` | |
| `CardTitle` | `<h3>` (configurable `as`) | `text-lg font-semibold` | a11y: caller picks heading level via `as` to keep doc outline correct — NOT hardcoded h3 |
| `CardDescription` | `<p>` | `text-sm text-muted-foreground` | F2 caveat: muted text on `card` fill = OK (card ≈ background) |
| `CardContent` | `<div>` | `p-4 md:p-6` | |
| `CardFooter` | `<div>` | `flex items-center gap-2 p-4 md:p-6 pt-0` | |

Heading level: `CardTitle` MUST accept `as` prop (`'h2'|'h3'|'h4'`) so each surface keeps a
correct heading outline. Account-settings sections are `<h2>`; mobile data-table cards are
`<h3>` under a page `<h2>`. Default `h3`.

a11y: Card is a styling container, NOT a landmark. When a card IS a region
(account-settings section), the CALLER adds `<section aria-labelledby>` around it — Card does
not emit `role`/`aria-*` itself. Staff empty-state Card gets caller `role="status"` (it's an
async-resolved empty result).

## Surface 1 — Admin Dashboard (`/op/dashboard`)

Inside nav shell. RSC reads `listOperatorBookings` + `getUnviewedPaidCount` + `touchLastViewed`
in-process (per `operator-dashboard.md` — never self-fetches). Badge count read BEFORE
`touchLastViewed`.

### Region order (top→bottom of `<main>`)

```
1. Page header band:  <h1>Bảng điều khiển</h1>  [Badge count "N mới"]   (right: nothing — profile menu lives in nav top-bar)
2. Filter band:       busId Input · serviceDate Input · routeId Input · contactStatus Select · [Lọc] Button(default)
3. Queue Table:       9-col (data-table-design.md "dashboard 9-col queue") — escalated rows amber
4. Load-more:         [Tải thêm] Button(outline)  (cursor pagination, appends; aria-live polite)
```

### Layout — Desktop (≥768px)

```
┌─ <main id="main"> ──────────────────────────────────────────────┐
│ Bảng điều khiển   ●3 mới                                  (h1)    │
│                                                                  │
│ ┌ filter band (Card, p-4) ────────────────────────────────────┐ │
│ │ [Biển số ____] [Ngày __/__/____] [Tuyến ▾] [Liên lạc ▾] [Lọc]│ │
│ └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│ ┌ queue Table (9 col) ─────────────────────────────────────────┐│
│ │ Mã đặt│Khách│SĐT│Vé│Tuyến│Giờ│Liên lạc│TT t.toán│Cờ           ││
│ │ …rows (escalated = bg-amber-50 + ⚠)…                          ││
│ └───────────────────────────────────────────────────────────────┘│
│                          [ Tải thêm ]                            │
└──────────────────────────────────────────────────────────────────┘
```

Filter band wrapped in a Card (`p-4`), fields in a `flex flex-wrap gap-3 items-end` row;
each field is Label-over-Input (stacked). "Lọc" Button(default) is the last flex item, aligned
to field baseline (`items-end`). Filter form = real `<form method=get action="/op/dashboard">`
(GET, no CSRF) — submit navigates with searchParams; RSC re-renders. contactStatus Select is
the MISSING Select primitive (build per a11y-operator-console.md Keyboard Map).

### Layout — Mobile (≤767px)

Filter band fields stack full-width (1 per row); "Lọc" full-width Button(default lg) last.
Queue Table → stacked Cards (data-table-design.md mobile-card mode). "Tải thêm" full-width.

### "N mới" badge

Beside h1, `Badge variant=count` (`bg-primary text-primary-foreground rounded-full`), text
"{N} mới" + `aria-label="{N} đơn mới chưa xem"`. Hidden entirely when N=0 (no empty badge).
Resets after `touchLastViewed` (next render shows 0 → hidden). Same badge appears in nav
sidebar item 1 (nav-pattern-pick.md) — same count source, two render sites.

## Surface 2 — Reports (`/op/reports/revenue`, `/op/reports/payouts`)

Inside nav shell. Reports parent `/op/reports` = index with two cards linking to children
(resolves nav-pattern-pick.md Open Q — index page, NOT auto-redirect; both children meet shell
contract, index gives discoverability).

### Reports index (`/op/reports`)

```
<h1>Báo cáo</h1>
┌ Card (link) ──────────┐  ┌ Card (link) ──────────┐
│ Doanh thu             │  │ Chi trả               │
│ Thống kê theo ngày    │  │ Lịch sử thanh toán    │
└───────────────────────┘  └───────────────────────┘
```

Two Cards in `grid grid-cols-1 md:grid-cols-2 gap-4`. Each Card is a link (whole-card click
target via nested `<a>` covering card, or `CardTitle` as link + card `relative` + `a` absolute
inset — pick whole-card-link, ≥44px trivially). Card link a11y: `<a>` wraps `CardTitle`,
`CardDescription` is supplementary text inside.

### Revenue (`/op/reports/revenue`)

```
1. <h1>Doanh thu</h1>
2. Filter band (Card): [Từ ngày <input type=date>] [Đến ngày <input type=date>] [Lọc] · [Tải CSV]
3. Revenue Table + <tfoot> totals row  (data-table-design.md; currency right-align)
4. (charts — DEFERRED, Open Q)
```

Date-range filter = two `<input type="date">` (→ Input + Label "Từ ngày"/"Đến ngày"). "Lọc"
Button(default) → `router.push` with searchParams. "Tải CSV" = `<a href={csvHref}>` rendered as
Button(outline `asChild`) — native browser download (`GET /api/op/reports/revenue.csv`,
Content-Disposition attachment), NOT a JS fetch. Default range from `getDefaultDateRange()`
module-scope helper (last 30d, VN tz) — NEVER `Date.now()` in RSC render body (CLAUDE.md
react-hooks/purity rule). `getRevenueReport` read in-process.

Totals in `<tfoot>` (data-table-design.md): single totals `<tr>`, `<th scope=row>` "Tổng" +
right-aligned summed currency cells. Status cell label map (statusLabels.ts): settled→"Đã
thanh toán", pending→"Chờ xử lý", processing→"Đang xử lý", failed→"Thất bại", null→"—".

Mobile: filter fields stack; Table → trip Cards + one summary Card (totals) at bottom.

### Payouts (`/op/reports/payouts`)

```
1. <h1>Chi trả</h1>
2. (no date filter yet — Open Q)
3. Payout Table (orderBy scheduledAt desc); status = Badge (result palette); "Thử lại" on failed rows only
4. error banner role=alert (retry errors)
```

Status Badge replaces raw-hex `STATUS_COLORS` (PayoutsClient.tsx) — map via statusLabels.ts to
Badge variants: pending→`pending`(amber), processing→`neutral`, settled→`success`(green),
failed→`danger`(red). "Thử lại" Button(destructive SOFT) ONLY on failed rows →
`POST /api/op/reports/payouts/[id]/retry` with `X-CSRF-Token` (readCsrfToken()) +
credentials:same-origin → `router.refresh()`. No optimistic UI. Retry error → banner
`role=alert` (not_failed / not_found / other / network VN copy per wireframe). Mobile →
payout Cards. Empty "Chưa có khoản thanh toán nào.".

## Surface 3 — Staff Single-Trip Dashboard (`/op/staff/dashboard`)

NO nav shell (operator-staff-dashboard.md). Own `<main id="main">` + own skip-link. Admins
redirected to `/op/dashboard`. `getStaffDashboard()` in-process RSC.

### Region order

```
1. <h1>Chuyến của tôi</h1>
2. message banner (amber) — after depart/complete or load error (role=status polite for success, role=alert for error)
3. trip-status line:  "Trạng thái chuyến: {status}"  (status value bold)
4. action band:  [Đánh dấu khởi hành] [Đánh dấu hoàn thành]   (Button default, gated)
5. Tabs strip:   [Hàng đợi] [Manifest]
6. active tab panel:  [Làm mới] + queue Table  OR  [Làm mới] + manifest Table (AC6 no seat col)
```

### Action band gating

- Depart Button disabled if `status ∈ {departed, completed, cancelled}` OR `busy`.
- Complete Button disabled if `status ∈ {completed, cancelled}` OR `busy`.
- Depart → `departTripApi` POST `/api/op/trips/[id]/depart` (sets `salesClosed=true`,
  idempotent `alreadyDeparted`); local status set, no refetch.
- Complete → `completeTripApi` POST `/api/op/trips/[id]/complete` (status `completed`,
  schedules T+3 payout, idempotent `alreadyCompleted`).
- Both wired via `tripsClient` with `X-CSRF-Token` (POST). Disabled state announced
  (`aria-disabled` + visual). Action band = `flex flex-col md:flex-row gap-2`.

### Empty state (no assignment)

`assignedTripId === null` → single Card (`role="status"`), no tabs/actions: "Bạn chưa được
phân công chuyến nào. Vui lòng liên hệ quản trị viên…".

## Tabs Primitive (MISSING — build `components/ui/tabs.tsx`)

Staff dashboard tab strip (Hàng đợi / Manifest) is raw buttons w/ inline active style today.
Promote to a Tabs primitive. Build contract (WAI-ARIA Tabs pattern):

| Part | Element | a11y |
|------|---------|------|
| `Tabs` | `<div>` | client state holder (`'use client'`, `useState` active tab) |
| `TabsList` | `<div role="tablist" aria-label="...">` | `aria-label="Chế độ xem chuyến"` |
| `TabsTrigger` | `<button role="tab">` | `aria-selected`, `aria-controls={panelId}`, `id={tabId}`; **roving tabindex** (active=0, others=-1) |
| `TabsContent` | `<div role="tabpanel">` | `aria-labelledby={tabId}`, `tabIndex=0`, hidden when inactive |

Keyboard (a11y-operator-console.md): Arrow Left/Right move between tabs (roving tabindex,
wraps); Home/End first/last; Enter/Space activate (automatic activation on arrow — selection
follows focus, since tab switch is local useState w/ no fetch, no cost). Tab switch = local
state only, rows already hydrated (no fetch on switch). Active tab visual: `bg-background`
+ bottom border (`border-b-2 border-primary`) + `text-foreground`; inactive
`text-muted-foreground` (on background — F2 OK). ≥44px touch (py padding).

Reports does NOT use Tabs (revenue/payouts are separate routes, reached via nav + index cards).
Tabs is staff-dashboard-only in Phase A.

## Banners (shared pattern, Alert primitive MISSING)

Staff message banner + reports retry error banner + dashboard generic errors all need an
Alert. No Alert primitive yet (data-table-design.md / a11y docs flag it). Phase A inline pattern
until Alert built:

| Kind | Role | Surface |
|------|------|---------|
| success/info (depart/complete done) | `role="status" aria-live="polite"` | amber: `bg-amber-50 text-amber-900 border border-amber-200 rounded-lg p-3` |
| error (load fail, retry fail) | `role="alert" aria-live="assertive"` | red: `bg-red-50 text-red-900 border border-red-200 rounded-lg p-3` |

Result/booking palette raw values (design-system.md — no semantic success/warn token). Build
Alert primitive later to encapsulate; until then inline these classes. Banner text never
color-only — copy carries the meaning.

## Build Notes

- Card primitive FIRST (blocks data-table-design.md mobile mode + all three surfaces +
  account-settings + customer confirmation). One PR.
- Tabs primitive: staff-dashboard-only, build alongside staff surface.
- Filter bands are real `<form method=get>` (dashboard, revenue) — submit = navigation, RSC
  re-render. NO client fetch for filtering.
- "Tải CSV" = `<a>` (Button asChild), native download — never JS fetch (avoids blob/CSRF
  dance; GET is safe-method, no CSRF needed).
- All Button standalone CTAs (Lọc, Tải thêm, depart, complete, Thử lại, Làm mới): size `lg`
  on mobile (full-width, ≥44px); desktop may be `default` IF padded to 44px hit area
  (design-system.md Button-height caveat). Dense table-row actions follow data-table-design.md.

## Out of Scope

- Charts (revenue trend, payout breakdown) — DEFERRED. Open Q: `/chart-type-pick` +
  `/dashboard-layout` follow-up. Phase A reports are table+totals only (source has no charts).
- Payouts date filter (Open Q — source has none).
- Reports parent auto-redirect (resolved: index-with-cards, not redirect).
- Real-time queue refresh / websockets (manual "Tải thêm" / "Làm mới" only).

## Open Questions

- Staff dashboard: auto-refresh active tab after depart (`salesClosed`) so queue isn't stale?
  Deferred to build (operator-staff-dashboard.md Open Q) — Phase A = manual "Làm mới".
- Charts: revenue line chart + payout status breakdown — post-Phase-A.
