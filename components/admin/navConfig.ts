/**
 * Single source of truth for the admin console nav (Issue 064).
 *
 * The 7 console tabs. Other tabs' target pages (Approvals 065 … System 070) do
 * not exist yet and 404 until built — the links render regardless; each target
 * page enforces its own role gate when it lands. The nav shows all 7 tabs to
 * every admin role (simple, per Issue 064 §B) — role-aware HIDING happens on the
 * Overview page sections, not here.
 */

import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  Building2,
  Wallet,
  ShieldAlert,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'overview', label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { id: 'approvals', label: 'Approvals', href: '/admin/approvals', icon: ClipboardCheck },
  { id: 'users', label: 'Users', href: '/admin/users', icon: Users },
  { id: 'operators', label: 'Operators', href: '/admin/operators', icon: Building2 },
  { id: 'finance', label: 'Finance', href: '/admin/finance', icon: Wallet },
  { id: 'moderation', label: 'Moderation', href: '/admin/moderation', icon: ShieldAlert },
  { id: 'system', label: 'System', href: '/admin/system', icon: Settings },
];

/**
 * Active-tab check. Overview (`/admin`) is active ONLY on the exact path — a
 * prefix match would light Overview on every /admin/* sub-route. Every other tab
 * is active on its path or any deeper segment (e.g. /admin/finance/payouts).
 */
export function isAdminNavItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.href === '/admin') {
    return pathname === '/admin';
  }
  return pathname === item.href || pathname.startsWith(item.href + '/');
}
