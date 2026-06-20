# DS-019 Navigation Pattern

## Portal Structure

| Portal | Prefix | Nav Components |
|--------|--------|----------------|
| Customer | `/` | `SiteHeader` + `SiteFooter` |
| Operator | `/op/*` | `OperatorNav` + `OperatorBottomNav` + `ConsoleHeader` + `CommandPalette` |
| Admin | `/admin/*` | `AdminNav` |

## Customer Portal

### SiteHeader (`components/layout/SiteHeader.tsx`)

Static nav bar. Hidden on `/op/*`, `/dev/*`, `/auth/*`.

Links: Trang chu → `/` · Lien he dat xe → `/lien-he-dat-xe` · Tro thanh doi tac → `/op/register` · Dang nhap → `/op/login`

Active state: `text-primary font-semibold`. Logo links to `/`.

### SiteFooter (`components/layout/SiteFooter.tsx`)

Static footer with site links.

## Operator Portal

### Config Source: `components/op/navConfig.ts`

Single file drives sidebar, bottom nav, command palette, and breadcrumbs.

| # | Label | Route | Notes |
|---|-------|-------|-------|
| 1 | Tong quan | `/op/dashboard` | — |
| 2 | Doi xe | `/op/buses` | — |
| 3 | Chuyen di | `/op/trips` | — |
| 4 | Dat ve | `/op/bookings` | Unviewed count badge |
| 5 | Tai chinh | `/op/money` | — |
| 6 | Thue xe | `/op/charter` | APPROVED operators only |
| 7 | Cai dat | `/op/settings` | Admin-only features nested |

Role filtering: `adminOnly` flag hides items for staff role via `visibleNavItems()`.

### Desktop Sidebar (`components/op/OperatorNav.tsx`)

- Visible `md:` (768px+)
- Collapsible: `w-60` expanded → `w-14` icon-only
- Active indicator: left orange bar (`w-1`) + `bg-sidebar-accent`
- Booking badge: "N moi" unviewed count
- State: `useOperatorNav` Zustand store

### Mobile Navigation

- **Bottom Nav** (`components/op/OperatorBottomNav.tsx`): `fixed inset-x-0 bottom-0 md:hidden`, 5 slots
- **Drawer**: slide-out nav (`w-72`) triggered from icon bar

### Console Header (`components/op/ConsoleHeader.tsx`)

Top bar: breadcrumbs (desktop) · Cmd+K trigger (desktop) · activity bell with unread badge · profile pill menu.

### Command Palette (`components/op/CommandPalette.tsx`)

`Cmd+K` / `Ctrl+K` → page-jump commands from navConfig. Fuzzy search.

### Sidebar Tokens

`--sidebar` (bg) · `--sidebar-foreground` · `--sidebar-primary` (orange) · `--sidebar-accent` (hover).

## Admin Portal

### Config: `components/admin/navConfig.ts` + `AdminNav.tsx`

Seven top-level tabs. All visible to all roles — page-level auth enforced. Client-side active highlighting.
