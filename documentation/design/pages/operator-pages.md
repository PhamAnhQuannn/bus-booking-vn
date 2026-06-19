---
title: Operator page specs
date: 2026-05-27
design-language: v1.0
template: ./_template.md
patterns: ../patterns/_index.md
note: operator console already scores 5/5; specs here lock the pattern mapping +
  target the known fixes (dashboard sparklines/compare; trip-detail bar alignment).
---

# Operator page specs

All operator routes share the operator shell (PTN-01 sidebar variant) + breadcrumbs (PTN-13).

### `/op/login`, `/op/first-login`  —  Operator auth
- **Goal:** operator/staff authenticate; forced password change on first login.
- **OTA precedent:** partner-portal auth.
- **Patterns:** PTN-01 (auth-minimal), PTN-11, PTN-12.
- **Layout:** centered card; first-login = password-change form with policy hints.
- **States:** filling/submitting; OTP; locked; requiresPasswordChange redirect.
- **CTA:** one primary. **A11y:** labels, error summary, password rules announced.

### `/op/(console)/dashboard` (+ `/dashboard/[id]`)  —  Booking queue
- **Goal:** work the paid-booking call queue.
- **OTA precedent:** ops/partner queue console.
- **Patterns:** PTN-01, PTN-09 (queue table, cursor pagination, "N mới" count badge), PTN-12, PTN-13 (on `/[id]`).
- **Layout:** filter band + queue table; `/[id]` = detail (contact tracking, pickup assign, escalation).
- **States:** loading/empty/error; contact-status transitions.
- **CTA:** row actions; primary per detail.
- **A11y:** table sort/keyboard; status badges non-color-only; live count.

### `/op/(console)/reports/overview`  —  KPI dashboard
- **Goal:** at-a-glance operator health.
- **OTA precedent:** analytics overview.
- **Patterns:** PTN-01, PTN-10 (KPI tiles + **sparkline/period-compare** + funnel bars), PTN-12, date-range form.
- **Layout:** date range → KPI tile grid (revenue/seats/occupancy/paid-rate) → status breakdown + conversion funnel.
- **States:** loading/empty-period/data.
- **Fix:** add sparklines + period-compare delta to tiles (scorecard fix #4); teal `info` chart series.
- **A11y:** tiles `<section>`+heading; funnel values as text; inline `style={{width}}` allowed (data-driven).

### `/op/(console)/reports/revenue`, `/reports/payouts`  —  Reports
- **Goal:** revenue/payout reporting + CSV + retry.
- **OTA precedent:** partner finance reports.
- **Patterns:** PTN-01, PTN-09 (tables + tfoot totals), PTN-10 (optional charts), PTN-12, date filter (PTN-11).
- **Layout:** date range form + table + totals; payouts = status badges + retry on failed.
- **States:** loading/empty/data; retry pending.
- **CTA:** CSV download (secondary); retry (per-row).
- **Open:** payout date filter (dashboard-layout.md open item); add revenue chart.

### `/op/(console)/trips`, `/routes`, `/buses`, `/trip-templates`, `/staff`  —  Management tables
- **Goal:** CRUD + lifecycle on operator entities.
- **OTA precedent:** partner inventory management.
- **Patterns:** PTN-01, PTN-09 (table w/ expanders + row actions), PTN-11 (create/edit forms/dialogs), PTN-12, PTN-13.
- **Layout:** table + primary "Tạo mới" + row actions (edit/deactivate; trips: depart/complete/cancel; staff: admin-only).
- **States:** loading/empty/error; action confirmations (Dialog); validation 422 inline.
- **CTA:** one primary create; destructive (deactivate/cancel) soft + confirmed.
- **A11y:** sortable headers `aria-sort`; dialogs focus-trap; status badges non-color-only.

### `/op/(console)/trips/[id]`  —  Trip detail (operator)
- **Goal:** manage one trip (bus assign, block seats, sales toggle, manifest, lifecycle).
- **OTA precedent:** flight/inventory detail.
- **Patterns:** PTN-01, PTN-13, PTN-06 (facts + actions), PTN-09 (manifest link), PTN-12.
- **Layout:** breadcrumb → trip facts → action group (reassign/block/toggle/depart/complete/cancel) → manifest link.
- **Fix:** align the action/summary bar styling with the customer trip-card system (scorecard fix #5).
- **States:** scheduled/departed/completed/cancelled; action confirmations.
- **A11y:** action buttons labelled; status banner.

### `/op/(console)/manifest/[tripId]`  —  Manifest
- **Goal:** boarding checklist + passenger contact/pickup status.
- **OTA precedent:** gate/boarding manifest.
- **Patterns:** PTN-01, PTN-13, PTN-09 (9-col read-ish table + boarding toggles), PTN-12.
- **Layout:** trip header + manifest table (passenger, phone, pickup, contact status, picked-up).
- **States:** loading/empty/data; toggle set-true-only.
- **A11y:** dense-table touch targets ≥44px; column scope.

### `/op/(console)/upcoming`  —  Upcoming trips
- **Patterns:** PTN-01, PTN-09 (filter/sortable), PTN-12. **Layout:** filterable upcoming-trip table. **States:** loading/empty/data.

### `/op/(console)/profile`  —  Operator profile
- **Patterns:** PTN-01, PTN-13, PTN-11. **Layout:** profile form (legal name, contact/notification phone). **States:** saving/success/error. **A11y:** labels; phone validation.

### `/op/staff/dashboard`  —  Staff single-trip dashboard
- **Goal:** staff assigned to one trip work that trip.
- **OTA precedent:** limited-scope ops view.
- **Patterns:** PTN-01 (minimal), PTN-10 (single-trip tiles) / PTN-09 (manifest), PTN-12.
- **Layout:** assigned-trip header + action band + queue/manifest tabs.
- **States:** no-assignment empty; data.
- **A11y:** tab pattern; scoped nav.
