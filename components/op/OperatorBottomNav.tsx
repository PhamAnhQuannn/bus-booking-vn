"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"

import {
  BOTTOM_NAV_IDS,
  isNavItemActive,
  visibleNavItems,
  type NavRole,
} from "@/components/op/navConfig"
import { useOperatorNav } from "@/components/op/OperatorNavContext"
import { cn } from "@/lib/utils"

interface OperatorBottomNavProps {
  role: NavRole
  /** Unviewed-paid count for the bookings slot badge. */
  unviewedCount?: number
}

/**
 * Mobile-only bottom navigation. 5 slots: 4 primary nav items + a "Thêm" slot
 * that opens the full sidebar drawer.
 *
 * Sits above viewport bottom; the layout's <main> adds `pb-16` reserve to avoid
 * content occlusion.
 */
export function OperatorBottomNav({ role, unviewedCount = 0 }: OperatorBottomNavProps) {
  const pathname = usePathname() || ""
  const { setDrawerOpen } = useOperatorNav()

  const all = visibleNavItems(role)
  const primary = BOTTOM_NAV_IDS.map((id) => all.find((i) => i.id === id)).filter(
    (i): i is NonNullable<typeof i> => Boolean(i)
  )

  return (
    <nav
      aria-label="Điều hướng chính"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border bg-background pb-[env(safe-area-inset-bottom)] shadow-e3 md:hidden"
      )}
    >
      {primary.map((item) => {
        const active = isNavItemActive(pathname, item)
        const showBadge = item.bookingsBadge && unviewedCount > 0
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:bg-muted",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon aria-hidden="true" className="size-5" />
            <span className="truncate px-1">{item.label}</span>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-primary"
              />
            ) : null}
            {showBadge ? (
              <span
                aria-hidden="true"
                className="absolute top-1 right-1/4 inline-flex h-2 w-2 rounded-full bg-primary"
              />
            ) : null}
          </Link>
        )
      })}
      <button
        type="button"
        aria-label="Mở menu điều hướng"
        onClick={() => setDrawerOpen(true)}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:bg-muted"
        )}
      >
        <MenuIcon aria-hidden="true" className="size-5" />
        <span>Thêm</span>
      </button>
    </nav>
  )
}
