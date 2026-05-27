---
screen: operator-manifest
route: /op/manifest/[tripId]
last-updated: 2026-05-20
status: draft
---

# Wireframe: Operator — Boarding Manifest

## Purpose
Read-only boarding manifest for one trip: who is on this trip, their contact
phone, pickup point, contact-status, payment status, picked-up flag, and
attention flags (manual / cash / escalated). Used by operator/staff at the
gate. AC6: NO seat-number column. AC7: manual "Làm mới" (refresh) + a "Cập nhật
lần cuối" (last-updated) timestamp.

Per source (`ManifestRefresh.tsx`) this screen is **view + refresh only** — the
booking status transitions (cash-collected / picked-up / no-show) are NOT
mutated from this page; they occur on the booking-detail surface
(`/op/dashboard/[bookingId]`). Manifest only *reflects* the resulting state
(`paymentStatus`, `pickedUpAt`, flags). See Open Questions.

## Entry Points
- Operator trips list → a trip row → "Manifest" link → `/op/manifest/[tripId]`.
- Staff dashboard `Manifest` tab embeds the same table (see `operator-staff-dashboard.md`).
- Direct deep-link (tenant-isolated via `Trip.operatorId`; foreign trip → "Không tìm thấy chuyến xe").

## Device Targets
- Mobile (375–767px)
- Desktop (≥768px) — primary (data table)

## Layout — Mobile (≤767px)
Table → stacked cards (one card per passenger row). Flags become a chip strip.
```
┌──────────────────────────────────────┐
│ [Operator nav shell — see            │
│  operator-dashboard.md]              │
├──────────────────────────────────────┤
│ Manifest chuyến a1b2c3d4…   (h1)     │
│                                       │
│ [ Làm mới ]   Cập nhật lần cuối:      │
│               20:14 20/05/2026        │
│  (← Button refresh + last-updated)    │
│                                       │
│ ── error banner (if refresh fails) ── │
│  ⚠ Lỗi tải manifest. Thử lại.        │  ← only on error
│                                       │
│ ┌── passenger card (Card MISSING) ──┐ │
│ │ BB-2026-x4y2-9z01      ⚠ (escal.) │ │  ← amber bg if escalatedAt
│ │ Nguyễn Văn A   · 2 vé             │ │
│ │ +8490xxxx12                       │ │
│ │ Điểm đón: Bến xe Mỹ Đình          │ │
│ │ Liên lạc: Đã liên lạc             │ │
│ │ TT thanh toán: pending_cash_…     │ │
│ │ Lên xe: —                         │ │
│ │ Cờ: ✏ thủ công  💵 tiền mặt  ⚠   │ │
│ └───────────────────────────────────┘ │
│ ┌───────────────────────────────────┐ │
│ │ BB-2026-q7w8-1a2b                 │ │
│ │ Trần Thị B   · 1 vé               │ │
│ │ Lên xe: ✓                         │ │
│ │ TT thanh toán: paid_operator_…    │ │
│ └───────────────────────────────────┘ │
│                                       │
│ (empty) "Không có hành khách nào."    │
└──────────────────────────────────────┘
```

## Layout — Desktop (≥768px)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ [Operator nav shell — see operator-dashboard.md]                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Manifest chuyến a1b2c3d4…                                            (h1)     │
│                                                                              │
│ [ Làm mới ]   Cập nhật lần cuối: 20:14 20/05/2026                            │
│                                                                              │
│ ── error banner (red, role=alert) — only on refresh failure ──              │
│                                                                              │
│ ┌──────────┬───────────┬──────────┬────┬───────────┬─────────┬──────────┬────┬──────┐
│ │ Mã đặt   │ Hành khách│ SĐT      │ Vé │ Điểm đón  │ Liên lạc│ TT t.toán│Lên │ Cờ   │
│ ├──────────┼───────────┼──────────┼────┼───────────┼─────────┼──────────┼────┼──────┤
│ │BB-..9z01 │Nguyễn V.A │+8490xx12 │ 2  │Mỹ Đình    │Đã l.lạc │pending_… │ —  │✏💵⚠ │ ← row amber if escalated
│ │BB-..1a2b │Trần Thị B │+8490xx08 │ 1  │—          │Chưa gọi │paid_op_… │ ✓  │      │
│ └──────────┴───────────┴──────────┴────┴───────────┴─────────┴──────────┴────┴──────┘
│  (AC6: NO "Ghế"/seat column)                                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

## Components
| Component | Source | New? |
|-----------|--------|------|
| Operator nav shell | `operator-dashboard.md` | reference (not redefined) |
| Page title `h1` | inline `<h1>` | existing markup |
| Refresh Button "Làm mới" | promote raw `<button>` → `Button` (variant=outline, size=sm) | New? (primitive exists; markup is raw `<button>`) |
| Last-updated label | `<span>` `text-muted-foreground text-sm` | existing markup |
| Error banner (role=alert) | red status banner (result-page red palette) | New? (no Toast/Alert primitive) |
| Manifest Table | raw `<table>` | New? — **Table primitive MISSING** (`/data-table-design`) |
| Passenger Card (mobile) | inline | New? — **Card primitive MISSING** |
| Status flag chips (✏/💵/⚠) | inline `<span title>` | existing; promote to Badge later |
| Picked-up indicator (✓/—) | inline `<span>` | existing |

## States
| State | Trigger | UI |
|-------|---------|----|
| Loading (initial) | RSC fetch in-process | server-rendered table; no spinner (SSR) |
| Loading (refresh) | "Làm mới" pressed | Button label → "Đang tải…", `disabled` |
| Empty | `rows.length === 0` | "Không có hành khách nào." |
| Error | refresh `res.ok === false` | red banner "Lỗi tải manifest. Vui lòng thử lại." |
| Success | refresh ok | table re-renders; last-updated timestamp bumps |
| Disabled | `loading === true` | refresh Button disabled |
| Trip not found | `getManifest` → null | "Không tìm thấy chuyến xe." (no table) |
| Row — escalated | `row.escalatedAt != null` | amber row/card background + ⚠ flag |
| Row — manual booking | `row.manualFlag` | ✏ "Thủ công" flag |
| Row — cash booking | `row.cashFlag` (`paymentMethod==='cash'`) | 💵 "Tiền mặt" flag |
| Row — cash-collected / paid | `paymentStatus = paid_operator_notified` | shown in "TT thanh toán" column verbatim |
| Row — pending cash | `paymentStatus = pending_cash_payment` | shown in "TT thanh toán" column verbatim |
| Row — picked-up | `row.pickedUpAt != null` | "Lên xe" column shows ✓ (else —) |
| Row — no-show | (no `no_show` status surfaces here) | excluded — manifest only lists `paid_operator_notified` / `pending_cash_payment` / `completed` |

Note on cash-collected / picked-up / no-show transitions: these are **reflected,
not actuated** here. Manifest filters to `MANIFEST_PAYMENT_STATUSES`
(`paid_operator_notified`, `pending_cash_payment`, `completed`); a `no_show`
booking drops off the list rather than rendering a "no-show" row. The mark-action
buttons live on the booking-detail surface.

## Interactions
- Press "Làm mới" → `GET /api/op/manifest/[tripId]` (`credentials: same-origin`)
  → on ok, replace rows + bump `generatedAt`; on non-ok, show red banner.
- Phone column is plain text (no tel: link in source) — could become `tel:` (Open Q).
- No row-level click target in current source (manifest is non-interactive per row).

## Data Needs
| What | When | Source | Optimistic? |
|------|------|--------|-------------|
| Initial rows + generatedAt | RSC render | `getManifest(operatorId, tripId)` in-process | n/a (SSR) |
| Refreshed rows | "Làm mới" | `GET /api/op/manifest/[tripId]` | No (server is source of truth) |
| Trip ownership check | RSC render | `Trip.findFirst({id, operatorId})` | n/a |

## Open Questions
- Manifest is read-only in source, but the task brief expects per-row
  cash-collected / picked-up / no-show actions. Confirm whether to add row-action
  Buttons here (POST `/api/op/bookings/[id]/{cash-collected|picked-up}`) or keep
  the mutate-on-detail-page model. If added, gate each Button by `paymentStatus`.
- Auto-chain `/data-table-design` (Table primitive + mobile→card breakpoint rules)
  and `/dashboard-layout` (manifest within operator shell) before build.
- Promote flag glyphs (✏/💵/⚠) to a Badge primitive with text labels for a11y
  (title attr alone is not announced reliably).
- `tel:` link on phone column for one-tap call at the gate?

## Out of Scope
- Booking status mutation (lives on `/op/dashboard/[bookingId]`).
- Seat numbers (AC6 explicitly excludes a seat column).
- Real-time push updates (manual refresh only).
