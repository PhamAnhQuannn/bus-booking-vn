---
screen: operator-reports-revenue
route: /op/reports/revenue
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator — Revenue Report

## Purpose
Per-trip revenue report over a date range (default last 30 days, VN tz):
trip id, departure, route, seats sold, gross revenue, platform fee, net payout,
payout status — with a totals footer (sum of gross / fee / net). Date-range
filter (`Từ ngày` / `Đến ngày`) re-navigates with new searchParams; a "Tải CSV"
anchor downloads the same range via `Content-Disposition: attachment`.
Vietnamese title "Báo cáo doanh thu".

NOTE: the actual source renders a **table + totals footer only — no charts**.
The chart-1..5 grayscale tokens exist in the design system and the task brief
flags charts; charts are captured as a planned enhancement in Open Questions,
not as shipped UI.

## Entry Points
- Operator nav shell → "Reports" → "Revenue" (`/op/reports/revenue`).
- Deep-link with `?dateFrom=&dateTo=&routeId=` searchParams (e.g. bookmarked range).

## Device Targets
- Mobile (375–767px)
- Desktop (≥768px) — primary (data table / future charts)

## Layout — Mobile (≤767px)
Filter stacks; table → cards; totals → a summary card pinned below.
```
┌──────────────────────────────────────┐
│ [Operator nav shell — see            │
│  operator-dashboard.md]              │
├──────────────────────────────────────┤
│ Báo cáo doanh thu             (h1)   │
│ Doanh thu từ vé đã thanh toán…(muted)│
│                                       │
│ Từ ngày  [ 2026-04-20 ▾ ] (date)     │  ← Input type=date, stacked
│ Đến ngày [ 2026-05-20 ▾ ]            │
│ [   Lọc   ]   [  Tải CSV ↓ ]         │  ← submit Button + CSV anchor
│                                       │
│ ┌── trip card (Card MISSING) ──────┐ │
│ │ a1b2c3d4…                        │ │
│ │ 08:00 18/05/2026 · Mỹ Đình→Sa Pa │ │
│ │ Số ghế: 28                       │ │
│ │ Doanh thu:        12.000.000 ₫   │ │
│ │ Phí nền tảng:        720.000 ₫   │ │
│ │ T.toán ròng:      11.280.000 ₫   │ │
│ │ Trạng thái: Đã thanh toán        │ │
│ └──────────────────────────────────┘ │
│ ┌── TỔNG CỘNG (summary card) ──────┐ │
│ │ Doanh thu:        38.500.000 ₫   │ │
│ │ Phí nền tảng:      2.310.000 ₫   │ │
│ │ T.toán ròng:      36.190.000 ₫   │ │
│ └──────────────────────────────────┘ │
│                                       │
│ (empty) "Không có dữ liệu trong       │
│          khoảng thời gian này."      │
└──────────────────────────────────────┘
```

## Layout — Desktop (≥768px)
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [Operator nav shell — see operator-dashboard.md]                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Báo cáo doanh thu                                                                  (h1)    │
│ Doanh thu từ vé đã thanh toán của các chuyến xe trong khoảng thời gian đã chọn.  (muted)   │
│                                                                                           │
│ Từ ngày [2026-04-20 ▾]   Đến ngày [2026-05-20 ▾]   [ Lọc ]      [ Tải CSV ↓ ]            │
│   (date Input)             (date Input)            (submit)      (anchor → .csv)          │
│                                                                                           │
│ ┌── (FUTURE) chart band — fill-chart-1..5 grayscale — see Open Questions ──┐              │
│ │  ▁▃▅▇▅▃   net-by-day bar / route share — NOT in current source           │              │
│ └──────────────────────────────────────────────────────────────────────────┘              │
│                                                                                           │
│ ┌──────────┬───────────┬────────────┬───────┬─────────────┬─────────────┬─────────────┬────────┐
│ │ Mã chuyến│ Khởi hành │ Tuyến      │ Số ghế│ Doanh thu   │ Phí n.tảng  │ T.toán ròng │ T.thái │
│ ├──────────┼───────────┼────────────┼───────┼─────────────┼─────────────┼─────────────┼────────┤
│ │a1b2c3d4… │08:00 18/05│Mỹ Đình→Sa..│  28   │12.000.000 ₫ │  720.000 ₫  │11.280.000 ₫ │Đã t.toán│
│ │e5f6g7h8… │06:30 19/05│HN→Hải Phòng│  16   │ 8.000.000 ₫ │  480.000 ₫  │ 7.520.000 ₫ │Đang xử lý│
│ ├──────────┴───────────┴────────────┴───────┼─────────────┼─────────────┼─────────────┼────────┤
│ │ Tổng cộng                                  │38.500.000 ₫ │2.310.000 ₫  │36.190.000 ₫ │        │ ← tfoot, bold
│ └────────────────────────────────────────────┴─────────────┴─────────────┴─────────────┴────────┘
│  (overflow-x:auto wrapper; currency cols right-align)                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Operator nav shell | `operator-dashboard.md` | reference |
| Page title + muted intro | inline `<h1>` + `<p>` | existing markup |
| Date-range filter form | inline `<form>` w/ two `<input type=date>` | promote inputs → `Input`; add `Label` |
| `Từ ngày` / `Đến ngày` Inputs | raw `<input type=date>` | New? (Input exists; date variant + Label MISSING) |
| "Lọc" submit Button | raw `<button>` (blue) → `Button` variant=default | New? (primitive exists; markup raw) |
| "Tải CSV" download | `<a href={csvHref}>` (green) → `Button` variant=outline asChild | existing anchor; restyle |
| Revenue Table + tfoot totals | raw `<table>` w/ `<tfoot>` | New? — **Table primitive MISSING** (`/data-table-design`) |
| Trip Card + summary Card (mobile) | inline | New? — **Card primitive MISSING** |
| Revenue chart band (future) | not in source | New? — uses `fill-chart-1..5`; `/dashboard-layout` |
| VND formatter | `formatVnd` | util (existing) |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (initial / refilter) | RSC in-process `getRevenueReport` | server-rendered table; navigation spinner on filter submit |
| Empty range | `initialRows.length === 0` | "Không có dữ liệu trong khoảng thời gian này." (no table, no totals) |
| Error | (no client error path in source) | RSC error boundary handles; surface generic message |
| Success | rows present | table + tfoot totals render |
| Disabled | `from`/`to` empty | both date Inputs `required`; submit blocked by native validation |
| Status cell — settled | `payoutStatus='settled'` | "Đã thanh toán" |
| Status cell — pending/processing/failed | resp. status | "Chờ xử lý" / "Đang xử lý" / "Thất bại" |
| Status cell — none yet | `payoutStatus` null/'' | "—" |
| Totals footer | always (when rows>0) | bold row: Σ gross, Σ fee, Σ net (`reduce` client-side) |

## Interactions
- Edit `Từ ngày` / `Đến ngày` (`useState` from/to) → "Lọc" submit → `e.preventDefault()`
  → `router.push('/op/reports/revenue?dateFrom=&dateTo=')` → RSC re-renders with new range.
- "Tải CSV" anchor → `GET /api/op/reports/revenue.csv?dateFrom=&dateTo=` →
  browser downloads via `Content-Disposition: attachment` (no JS fetch).
- `routeId` param is read server-side but the client form does NOT expose a route
  picker yet (default = all routes). See Open Questions.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Revenue rows (per-trip) | RSC render | `getRevenueReport({operatorId, dateFrom, dateTo, routeId})` in-process | n/a (SSR) |
| Default date range | RSC render (no param) | `getDefaultDateRange()` — last 30d, VN tz, module-scope helper | n/a |
| Totals | client | `reduce` over `initialRows` | n/a (derived) |
| CSV file | "Tải CSV" | `GET /api/op/reports/revenue.csv` anchor | n/a |

## Open Questions
- **Charts**: design-system provides `fill-chart-1..5` for "report charts
  (payouts/revenue)" but source ships table-only. Add a net-revenue-by-day bar
  and/or route-share breakdown? Decide via `/dashboard-layout` + `/chart-type-pick`.
- Auto-chain `/data-table-design` (Table primitive, tfoot totals, currency
  right-align, mobile→card) and `/dashboard-layout` (filter + chart + table layout).
- Route filter UI: `routeId` searchParam is honored server-side but no client
  picker exists — add a route `<Select>` (Select primitive MISSING)?
- CSV export auth parity with HTML report route (flagged in flow Open Questions).
- VN-tz date derivation must match the filter's tz (Issue 014 Mistake Log:
  `.toISOString().slice(0,10)` is a UTC/local collision) — note for the build agent.

## Out of Scope
- Net-of-refunds reconciliation (separate finance surface).
- Multi-operator / platform-wide revenue (operator sees own `operatorId` only).
- Scheduled email of the report.
