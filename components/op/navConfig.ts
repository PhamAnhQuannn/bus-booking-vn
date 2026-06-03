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
 */

import {
  BarChart3,
  Bell,
  Bus,
  CalendarClock,
  CopyPlus,
  FileCheck,
  Gauge,
  ShieldCheck,
  LayoutDashboard,
  Route,
  Ticket,
  UserCircle,
  Users,
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

/** Primary navigation — sidebar order. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Bảng điều khiển",
    href: "/op/dashboard",
    icon: LayoutDashboard,
    match: "/op/dashboard",
    keywords: ["home", "trang chu", "tong"],
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
    id: "activity",
    label: "Hoạt động",
    href: "/op/activity",
    icon: Bell,
    match: "/op/activity",
    keywords: ["activity", "alerts", "thong bao"],
  },
  {
    id: "reports-overview",
    label: "Tổng quan",
    href: "/op/reports/overview",
    icon: Gauge,
    match: "/op/reports/overview",
    keywords: ["kpi", "tong quan"],
  },
  {
    id: "upcoming",
    label: "Chuyến sắp tới",
    href: "/op/upcoming",
    icon: CalendarClock,
    keywords: ["upcoming", "sap toi"],
  },
  {
    id: "buses",
    label: "Đội xe",
    href: "/op/buses",
    icon: Bus,
    keywords: ["fleet", "doi xe", "xe"],
  },
  {
    id: "routes",
    label: "Tuyến đường",
    href: "/op/routes",
    icon: Route,
    keywords: ["routes", "tuyen"],
  },
  {
    id: "trips",
    label: "Chuyến đi",
    href: "/op/trips",
    icon: Ticket,
    match: "/op/trips",
    keywords: ["trips", "chuyen di"],
  },
  {
    id: "trip-templates",
    label: "Mẫu chuyến",
    href: "/op/trip-templates",
    icon: CopyPlus,
    keywords: ["templates", "mau"],
  },
  {
    id: "reports-revenue",
    label: "Báo cáo",
    href: "/op/reports/revenue",
    icon: BarChart3,
    match: "/op/reports",
    keywords: ["reports", "bao cao", "doanh thu", "payouts"],
  },
  {
    id: "staff",
    label: "Nhân viên",
    href: "/op/staff",
    icon: Users,
    adminOnly: true,
    keywords: ["staff", "nhan vien"],
  },
  {
    id: "status",
    label: "Trạng thái đăng ký",
    href: "/op/status",
    icon: ShieldCheck,
    match: "/op/status",
    keywords: ["status", "trang thai", "application", "duyet", "approval"],
  },
  {
    id: "kyb",
    label: "Hồ sơ KYB",
    href: "/op/kyb",
    icon: FileCheck,
    adminOnly: true,
    keywords: ["kyb", "ho so doanh nghiep", "giay to", "documents", "verification"],
  },
  {
    id: "profile",
    label: "Hồ sơ",
    href: "/op/profile",
    icon: UserCircle,
    keywords: ["profile", "ho so", "account"],
  },
]

/** Items shown in mobile bottom-nav (max 5 slots — last one is "More"). */
export const BOTTOM_NAV_IDS = ["dashboard", "bookings", "trips", "buses"] as const

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
