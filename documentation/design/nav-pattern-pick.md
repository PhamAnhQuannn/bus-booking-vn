---
feature: operator-console-nav
decision: persistent-sidebar (desktop) + top-bar-drawer (mobile)
last-updated: 2026-05-20
status: ready-to-build
inherits: docs/design/design-system.md
resolves: operator-dashboard.md / a11y-operator-console.md / design-system.md "nav pattern pending"
---

# Nav Pattern Pick: Operator Console Shell

Resolves the "pending `/nav-pattern-pick`" flag referenced by `a11y-operator-console.md`,
`wireframes/operator-dashboard.md`, and `design-system.md`. Scope: the `/op/*` console shell
ONLY. Staff dashboard (`/op/staff/dashboard`) is single-trip, NO admin shell (see
`operator-staff-dashboard.md`).

> **Customer-side update (2026-05-26):** the customer flow now uses a **minimal persistent
> top header** (`components/layout/SiteHeader.tsx` — brand logo + 3 links: Trang chủ / Tìm
> chuyến xe / Tài khoản) **and a footer** (`SiteFooter.tsx` — brand, link groups, legal,
> copyright), both hidden on `/op/*` + `/dev/*`. This supersedes the original
> "brand link only, no persistent nav" line below for the customer side; the product-ready
> pass added them for brand presence + wayfinding. Active link uses `aria-current="page"`
> + weight (not color-only); links carry a visible focus ring + ≥44px target.

## Decision

**Persistent left sidebar on desktop (≥768px) + collapsible top-bar with off-canvas drawer
on mobile (≤767px).** Single breakpoint at the global 768px (`md`). One nav component, two
render modes driven by the breakpoint — NOT two separate trees.

Uses the `sidebar*` tokens already present in `globals.css` (`--sidebar`,
`--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`,
`--sidebar-ring`). No new tokens.

## Options Considered

| Option | Verdict | Why |
|--------|---------|-----|
| A. Persistent left sidebar + mobile drawer | **CHOSEN** | Console is table-heavy + multi-section (Dashboard/Fleet/Routes/Trips/Reports/Staff). Sidebar keeps all sections one click away; standard admin-console muscle memory. |
| B. Top horizontal nav bar (all viewports) | rejected | 9+ nav items + "N mới" badge overflow a mobile top bar; horizontal scroll-nav is a known a11y/discoverability anti-pattern. |
| C. Bottom tab bar (mobile) + sidebar (desktop) | rejected | Bottom tabs cap at ~5 items; console has 9+. Two divergent IA models = double the test surface. |
| D. Flat (no shell) — each page standalone | rejected | Forces back-button navigation between sections; loses the persistent "N mới" unviewed-paid signal that drives operator response time. |

## Nav Items (canonical order)

From `operator-dashboard.md`. Order is the sidebar vertical order AND the mobile drawer order.

| # | Label (VN) | Route | Notes |
|---|-----------|-------|-------|
| 1 | Bảng điều khiển | `/op/dashboard` | **canonical landing** (resolves the `/op/profile` vs `/op/dashboard` conflict — see below). Carries "N mới" badge = unviewed paid count. |
| 2 | Chuyến sắp tới | `/op/trips?filter=upcoming` | upcoming trips shortcut |
| 3 | Đội xe | `/op/buses` | fleet |
| 4 | Tuyến đường | `/op/routes` | routes (+pickup-point reorder) |
| 5 | Chuyến đi | `/op/trips` | trips list (+templates, paired-return, cancel) |
| 6 | Mẫu chuyến | `/op/trips/templates` | recurring templates |
| 7 | Báo cáo | `/op/reports` | parent → {Doanh thu `/revenue`, Chi trả `/payouts`} |
| 8 | Nhân viên | `/op/staff` | staff CRUD (admin only) |
| 9 | Hồ sơ | `/op/profile` | operator profile/settings |
| — | Đăng xuất | logout action | bottom-pinned, separated by divider |

Manifest (`/op/manifest/[tripId]`) is NOT a top-level nav item — reached via trip rows
(per `operator-manifest.md`). Booking-detail (`/op/dashboard/[bookingId]`) reached via queue rows.

## Landing Reconciliation (resolves operator-dashboard.md open question)

**Canonical post-login landing = `/op/dashboard`.** The `/op/profile` reference in source is
a carry-forward defect. Operator login (forced-change cleared) → `/op/dashboard`. First-login
forced change → `/op/first-login` → on success → `/op/dashboard`. Build wires the redirect
target to `/op/dashboard` in `operatorLogin` success + `POST /api/op/auth/password/change`
204 path. (Staff role login → `/op/staff/dashboard` per role gate, NOT this shell.)

## Layout — Desktop (≥768px)

```
┌────────────┬─────────────────────────────────────────────┐
│ [Brand]    │  [page heading h1]            [profile menu] │ ← top of <main>
│            ├─────────────────────────────────────────────┤
│ ▸ Bảng đk ●3│                                             │
│   Chuyến..  │   page content (tables, forms, panels)      │
│   Đội xe    │                                             │
│   Tuyến..   │                                             │
│   Chuyến đi │                                             │
│   Mẫu..     │                                             │
│   Báo cáo   │                                             │
│   Nhân viên │                                             │
│   Hồ sơ     │                                             │
│ ─────────── │                                             │
│   Đăng xuất │                                             │
└────────────┴─────────────────────────────────────────────┘
  sidebar: w-60 (240px), bg-sidebar, sticky full-height, scrolls independently
```

## Layout — Mobile (≤767px)

```
┌─────────────────────────────────────┐
│ [☰] Brand            [profile] [●3]  │ ← sticky top bar, h-14
├─────────────────────────────────────┤
│  [page heading h1]                  │
│  page content (tables→stacked cards)│
└─────────────────────────────────────┘

[☰] tap → off-canvas drawer slides in from left:
┌──────────────────┐╳ (scrim covers rest)
│ Brand        [✕] │
│ ▸ Bảng đk    ●3  │
│   Chuyến sắp tới │
│   … (full list)  │
│ ──────────────── │
│   Đăng xuất      │
└──────────────────┘
  drawer: w-72, bg-sidebar, focus-trapped, scrim bg-black/50
```

## A11y Contract (mirrors a11y-operator-console.md "Console Shell")

- `<nav aria-label="Bảng điều khiển">` wraps the sidebar/drawer list. Current page link
  `aria-current="page"`.
- Desktop sidebar: always in DOM + visible; no expand/collapse toggle in Phase A (defer
  collapse-to-icons to post-MVP). Sidebar is a sibling of `<main>`, NOT inside it.
- Mobile drawer trigger `[☰]`: `<button aria-expanded={open} aria-controls="op-nav-drawer">`,
  accessible name "Mở menu điều hướng". Drawer is `aria-modal="true"` focus-trapped region
  while open; Esc closes + restores focus to `[☰]`; scrim click closes.
- Each `/op/*` page owns ONE `<main id="main">` + its OWN skip-link instance targeting it
  (operator layout skip-link distinct from customer root layout skip-link).
- "N mới" badge: visible count + `aria-label` "{N} đơn mới chưa xem"; resets on dashboard
  load (per Issue 014 touchLastViewed). Badge is text+number, never color-only.
- Nav links ≥44px touch target (py padding on each link row).

## Tokens

| Element | Token / class |
|---------|---------------|
| sidebar/drawer surface | `bg-sidebar text-sidebar-foreground` |
| active link | `bg-sidebar-accent text-sidebar-primary` + left accent bar |
| active marker | `aria-current="page"` (not color-only) |
| divider above logout | `border-sidebar-border` |
| focus ring | `focus-visible:ring-3 ring-sidebar-ring` (global F1 caveat: ring contrast ≈2.6:1 — mandated visible ring is current mitigation) |
| scrim (mobile) | `bg-black/50` |
| "N mới" badge | Badge primitive (MISSING — build via `/data-table-design` Badge spec) |

## Build Notes

- Sidebar + drawer = ONE `<OperatorNav>` component; CSS `md:` breakpoint toggles
  sidebar-mode vs drawer-mode. Drawer open-state is client state (`'use client'`); the nav
  item list + active-route detection can be server-derived (pathname).
- Drawer focus-trap + Esc + scrim: no base-ui Dialog dependency required, but MAY reuse the
  Dialog primitive once built (`/data-table-design` does not own Dialog; Dialog is its own
  missing primitive). Simpler: a focus-trap util + `inert` on `<main>` while open.
- Operator layout file: `app/op/layout.tsx` renders `<OperatorNav>` + `<main id="main">`;
  skip-link first child.

## Out of Scope

- Collapse-sidebar-to-icon-rail toggle (post-MVP).
- Breadcrumbs (flat IA, ≤2 levels deep — not needed Phase A).
- Per-section sub-nav (Reports uses an in-page tab/segment, not nested sidebar).

## Open Questions

- Reports parent (`/op/reports`) — index page with two cards, or auto-redirect to
  `/op/reports/revenue`? Defer to build; both children meet shell contract.
