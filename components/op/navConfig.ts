/**
 * Single source of truth for operator nav items.
 *
 * Consumed by:
 *   - components/op/OperatorNav.tsx (sidebar + drawer)
 *   - components/op/OperatorBottomNav.tsx (mobile bottom-nav primary slots)
 *   - components/op/CommandPalette.tsx (page-jump commands — PR 7)
 *
 * Keep label/href/icon consistent across all surfaces; route any future nav drift
 * through this file rather than editing the consumers.
 *
 * ── 6-GROUP RESTRUCTURE (Issue 080 / S09) ───────────────────────────────────
 * The console nav is exactly SIX top-level groups:
 *   Overview · Fleet · Trips · Bookings · Money · Settings
 * The extras are FOLDED (S09 "OUT: separate Routes/Buses/Trips top tabs, BI"):
 *   - activity        → surfaced in Overview Alerts box (no top tab).
 *   - upcoming        → reached via Fleet → bus detail (no top tab).
 *   - routes          → a sub-section under Trips (route /op/routes kept reachable
 *                       from Trips; no top-level nav entry).
 *   - trip-templates  → BI/fast-follow, OUT of the main nav (route kept reachable).
 *   - reports-*       → BI is OUT (S09); routes kept reachable off-nav.
 *   - status (079)    → folded into the Approval banner + Settings (route kept).
 *   - kyb (077)       → folded into the Approval banner + Settings (route kept,
 *                       admin-only).
 *   - profile/staff   → folded UNDER Settings (routes kept; staff is adminOnly).
 *
 * Removing an item here removes it from the sidebar, bottom-nav AND the command
 * palette page-list — but every folded ROUTE stays live (the pages still exist),
 * reached via the banner / Settings hub / Fleet+Trips sub-navigation. Consumers
 * that look up a folded id (Breadcrumbs.findNavItem) already fall back gracefully.
 */

import {
  Bus,
  CalendarCheck,
  LayoutDashboard,
  Settings,
  Ticket,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  /** Stable id used for keyboard shortcut + telemetry. */
  id: string
  label: string
  href: string
  icon: LucideIcon
  /** When set, item is active if pathname matches OR starts with this prefix. */
  match?: string
  /** Admin-only — hidden for staff role. */
  adminOnly?: boolean
  /** Show the "N mới" unviewed-paid badge. */
  bookingsBadge?: boolean
  /** Optional search keywords (Vietnamese diacritic-stripped applies at consumer). */
  keywords?: string[]
}

/**
 * Primary navigation — sidebar order. Exactly the SIX S09 groups.
 *
 * NOTE: Overview keeps the existing `/op/dashboard` ROUTE (the operations surface
 * already built there) but `match: "/op/dashboard"` so the active-state highlights
 * correctly. Renaming the route to `/op/overview` would orphan every existing
 * Link/redirect to `/op/dashboard`; the label is what changes, not the path.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Tổng quan",
    href: "/op/dashboard",
    icon: LayoutDashboard,
    match: "/op/dashboard",
    keywords: ["overview", "tong quan", "home", "trang chu", "dashboard", "bang dieu khien"],
  },
  {
    id: "fleet",
    label: "Đội xe",
    href: "/op/buses",
    icon: Bus,
    match: "/op/buses",
    keywords: ["fleet", "doi xe", "xe", "buses", "upcoming", "sap toi"],
  },
  {
    id: "trips",
    label: "Chuyến đi",
    href: "/op/trips",
    icon: Ticket,
    match: "/op/trips",
    keywords: ["trips", "chuyen di", "routes", "tuyen", "tuyen duong"],
  },
  {
    id: "bookings",
    label: "Đặt vé",
    href: "/op/bookings",
    icon: Ticket,
    match: "/op/bookings",
    bookingsBadge: true,
    keywords: ["dat ve", "booking", "queue", "hang doi"],
  },
  {
    id: "money",
    label: "Tài chính",
    href: "/op/money",
    icon: Wallet,
    match: "/op/money",
    keywords: ["money", "tai chinh", "balance", "so du", "payout", "rut tien", "withdraw", "ledger", "statements", "sao ke"],
  },
  // Issue 083: Charter tab — directly-assigned charter leads + accept/decline.
  // A 7th top-level group (documented exception to the S09 6-group restructure):
  // charter is a distinct lead-gen surface, not foldable under any of the six.
  // APPROVED-only (the page itself shows an approval notice for non-APPROVED ops).
  {
    id: "charter",
    label: "Thuê xe",
    href: "/op/charter",
    icon: CalendarCheck,
    match: "/op/charter",
    keywords: ["charter", "thue xe", "thue chuyen", "lead", "yeu cau thue", "hop dong"],
  },
  {
    id: "settings",
    label: "Cài đặt",
    href: "/op/settings",
    icon: Settings,
    match: "/op/settings",
    keywords: ["settings", "cai dat", "profile", "ho so", "staff", "nhan vien", "bank", "tai khoan", "ngan hang", "status", "trang thai", "kyb"],
  },
]

/** Items shown in mobile bottom-nav (max 5 slots — last one is "More"). */
export const BOTTOM_NAV_IDS = ["overview", "trips", "bookings", "money"] as const

export type NavRole = "admin" | "staff"

/** Filter items by role. */
export function visibleNavItems(role: NavRole): NavItem[] {
  return NAV_ITEMS.filter((i) => !i.adminOnly || role === "admin")
}

/** Pathname-based active check. */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.match) {
    return pathname === item.match || pathname.startsWith(item.match + "/")
  }
  return pathname === item.href || pathname.startsWith(item.href + "/")
}

/** Lookup helper. */
export function findNavItem(id: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.id === id)
}
