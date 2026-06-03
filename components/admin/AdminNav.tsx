'use client';

/**
 * AdminNav — client nav child for the admin console shell (Issue 064).
 *
 * Reads usePathname() to set aria-current on the active tab (mirrors the operator
 * console's OperatorNav active-state pattern). The shell layout is a server
 * component and passes nothing here — the tab list is static (navConfig) and the
 * only client concern is the active highlight, so this stays a thin client leaf.
 *
 * Renders all 7 tabs for every role; the target pages enforce role (065–070).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from '@/components/admin/navConfig';
import { cn } from '@/lib/utils';

export function AdminNav() {
  const pathname = usePathname() || '';

  return (
    <nav aria-label="Admin console" className="flex flex-col gap-0.5">
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = isAdminNavItemActive(pathname, item);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 items-center gap-2.5 rounded-md px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring',
              active
                ? 'bg-sidebar-accent font-semibold text-sidebar-primary before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-1 before:rounded-r before:bg-sidebar-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
