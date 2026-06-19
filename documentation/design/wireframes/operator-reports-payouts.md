---
screen: operator-reports-payouts
route: /op/reports/payouts
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator — Payout History

## Purpose
List every Payout row for the operator (newest `scheduledAt` first): route,
departure, gross revenue, platform fee, net payout, status badge, scheduled
date (T+3 from trip completion), settled date. Failed payouts expose a "Thử lại"
(Retry) action that POSTs a re-process request. Vietnamese title "Lịch sử thanh
toán".

## Entry Points
- Operator nav shell → "Reports" → "Payouts" (`/op/reports/payouts`).
- Linked from trip-complete confirmation (a trip completion schedules its T+3 payout).

## Device Targets
- Mobile (375–767px)
- Desktop (≥768px) — primary (data table, currency columns)

## Layout — Mobile (≤767px)
Table → stacked cards. Currency right-aligned within card. Retry button full-width.
```
┌──────────────────────────────────────┐
│ [Operator nav shell — see            │
│  operator-dashboard.md]              │
├──────────────────────────────────────┤
│ Lịch sử thanh toán            (h1)   │
│ Danh sách các khoản thanh toán cho   │
│ nhà xe. Nhấn "Thử lại" để yêu cầu…   │  ← muted intro
│                                       │
│ ⚠ error banner (role=alert) — on     │  ← only on retry error
│   retry failure                      │
│                                       │
│ ┌── payout card (Card MISSING) ────┐ │
│ │ Mỹ Đình → Sa Pa                  │ │
│ │ Khởi hành: 08:00 18/05/2026      │ │
│ │ Doanh thu:        12.000.000 ₫   │ │
│ │ Phí nền tảng:        720.000 ₫   │ │
│ │ Thanh toán ròng:  11.280.000 ₫   │ │
│ │ Trạng thái: ● Đã thanh toán      │ │  ← status badge
│ │ Ngày dự kiến: 21/05/2026         │ │
│ │ Ngày thanh toán: 21/05/2026      │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Hà Nội → Hải Phòng               │ │
│ │ Trạng thái: ● Thất bại (bank_ref)│ │  ← failureReason inline
│ │ Ngày thanh toán: —               │ │
│ │ [   Thử lại   ]                  │ │  ← Button, only if failed
│ └──────────────────────────────────┘ │
│                                       │
│ (empty) "Chưa có khoản thanh toán    │
│          nào."                       │
└──────────────────────────────────────┘
```

## Layout — Desktop (≥768px)
```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [Operator nav shell — see operator-dashboard.md]                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Lịch sử thanh toán                                                                 (h1)    │
│ Danh sách các khoản thanh toán cho nhà xe. Nhấn "Thử lại" để yêu cầu xử lý lại…  (muted)   │
│                                                                                           │
│ ── error banner (red, role=alert) — only after a failed retry ──                          │
│                                                                                           │
│ ┌────────────┬───────────┬────────────┬───────────┬────────────┬──────────┬─────────┬────────┬────────┐
│ │ Tuyến      │ Khởi hành │ Doanh thu  │ Phí n.tảng│ T.toán ròng│ T.thái   │ Ngày dự │ Ngày   │ Thao   │
│ │            │           │            │           │            │          │ kiến    │ t.toán │ tác    │
│ ├────────────┼───────────┼────────────┼───────────┼────────────┼──────────┼─────────┼────────┼────────┤
│ │Mỹ Đình→Sa..│08:00 18/05│12.000.000₫ │ 720.000₫  │11.280.000₫ │●Đã t.toán│21/05    │21/05   │        │
│ │HN→Hải Phòng│06:30 19/05│ 8.000.000₫ │ 480.000₫  │ 7.520.000₫ │●Thất bại │22/05    │ —      │[Thử lại]│ ← retry only when failed
│ │            │           │            │           │            │ (bank_ref)│        │        │        │
│ │Đà Nẵng→Huế │14:00 20/05│ 5.000.000₫ │ 300.000₫  │ 4.700.000₫ │●Đang xử lý│23/05   │ —      │        │
│ └────────────┴───────────┴────────────┴───────────┴────────────┴──────────┴─────────┴────────┴────────┘
│  (table scrolls-x on narrow desktop — overflow-x:auto wrapper)                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Operator nav shell | `operator-dashboard.md` | reference |
| Page title + muted intro | inline `<h1>` + `<p>` | existing markup |
| Payouts Table | raw `<table>` (`PayoutsClient.tsx`) | New? — **Table primitive MISSING** (`/data-table-design`) |
| Payout Card (mobile) | inline | New? — **Card primitive MISSING** |
| Status badge | inline `<span>` colored by `STATUS_COLORS` | New? — promote to Badge (status palette) |
| Retry Button "Thử lại" | raw `<button>` (red bg) → `Button` variant=destructive | New? (primitive exists; markup raw; note destructive renders SOFT) |
| Error banner (role=alert) | red banner (result-page red palette) | New? (no Alert primitive) |
| VND formatter | `formatVnd` (`toLocaleString('vi-VN') + ' ₫'`) | util (existing) |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (initial) | RSC in-process `getPayoutReport` | server-rendered table (SSR, no spinner) |
| Empty | `initialRows.length === 0` | "Chưa có khoản thanh toán nào." |
| Error | retry `!res.ok` | red banner; message keyed by `error` code |
| Success (retry) | retry `res.ok` | `router.refresh()` → RSC re-renders with new status |
| Disabled | `retrying === payoutId` | that row's Retry Button disabled, label "Đang xử lý…" |
| Badge — pending | `status='pending'` | "Chờ xử lý" (amber `#f9a825`) |
| Badge — processing | `status='processing'` | "Đang xử lý" (blue `#1a73e8`) |
| Badge — settled | `status='settled'` | "Đã thanh toán" (green `#34a853`) |
| Badge — failed | `status='failed'` | "Thất bại" (red `#d93025`) + `(failureReason)` muted suffix |
| Retry visibility | only `status==='failed'` rows | "Thao tác" cell empty for non-failed rows |
| Retry error: not_failed | API `error='not_failed'` | "Không thể thử lại: khoản thanh toán không ở trạng thái thất bại." |
| Retry error: not_found | API `error='not_found'` | "Không tìm thấy khoản thanh toán." |
| Retry error: other | any other | "Đã xảy ra lỗi. Vui lòng thử lại." |
| Retry error: network | fetch throws | "Lỗi kết nối. Vui lòng thử lại." |

## Interactions
- Click "Thử lại" on a failed row → `POST /api/op/reports/payouts/[id]/retry`
  with `X-CSRF-Token` header (`readCsrfToken()`), `credentials: same-origin`.
  - ok → `router.refresh()` (full RSC re-render; status flips to processing/settled).
  - non-ok → set error banner from `data.error`.
- No optimistic UI: the row keeps its `failed` badge until the refresh lands.

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Payout rows | RSC render | `getPayoutReport({operatorId})` in-process, `orderBy scheduledAt desc` | n/a (SSR) |
| Retry result | "Thử lại" | `POST /api/op/reports/payouts/[id]/retry` | No — refresh after success |
| Re-rendered rows | post-retry success | `router.refresh()` → RSC | No |

## Open Questions
- PayoutStatus badges currently use raw hex (`STATUS_COLORS`) — design-system
  has NO `success`/`warning` token. Resolve via `/a11y-design` (promote to
  semantic tokens) before build; until then reuse result-page amber/green/red.
- Auto-chain `/data-table-design` (Table primitive, sticky header, currency
  right-align, mobile→card) and `/dashboard-layout` (reports within shell).
- No date-range filter on payouts (unlike revenue) — confirm whether payouts
  should also gain a filter / pagination for operators with long history.
- T+3 scheduled date is shown but not labeled as "T+3" — surface the rule in UI?

## Out of Scope
- Payout settlement execution (S19 cron reads `scheduledFor`; not operator-triggered).
- Bank-account / disbursement config (separate surface).
- CSV export of payouts (revenue report has CSV; payouts does not in source).
