"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { MenuIcon, XIcon, LogOutIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { readCsrfToken } from "@/lib/auth/csrfClient"

export interface OperatorNavProps {
  /** Operator role — gates the admin-only "Nhân viên" item. */
  role: "admin" | "staff"
  /** Unviewed paid-booking count for the "N mới" badge on the dashboard item. */
  unviewedCount: number
}

interface NavItem {
  label: string
  href: string
  /** When set, item is active if the pathname starts with this prefix. */
  match?: string
  /** Admin-only item. */
  adminOnly?: boolean
  /** Show the "N mới" unviewed-paid badge. */
  badge?: boolean
}

// Canonical order from nav-pattern-pick.md, mapped to routes that exist today.
const NAV_ITEMS: NavItem[] = [
  { label: "Bảng điều khiển", href: "/op/dashboard", badge: true },
  { label: "Chuyến sắp tới", href: "/op/upcoming" },
  { label: "Đội xe", href: "/op/buses" },
  { label: "Tuyến đường", href: "/op/routes" },
  { label: "Chuyến đi", href: "/op/trips", match: "/op/trips" },
  { label: "Mẫu chuyến", href: "/op/trip-templates" },
  { label: "Báo cáo", href: "/op/reports/revenue", match: "/op/reports" },
  { label: "Nhân viên", href: "/op/staff", adminOnly: true },
  { label: "Hồ sơ", href: "/op/profile" },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match) {
    return pathname === item.match || pathname.startsWith(item.match + "/")
  }
  return pathname === item.href || pathname.startsWith(item.href + "/")
}

function NavLinks({
  items,
  pathname,
  unviewedCount,
  onNavigate,
}: {
  items: NavItem[]
  pathname: string
  unviewedCount: number
  onNavigate?: () => void
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 items-center justify-between gap-2 rounded-md py-2.5 pr-3 pl-4 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring",
                active
                  ? "bg-sidebar-accent font-semibold text-sidebar-primary before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-1 before:rounded-r before:bg-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <span>{item.label}</span>
              {item.badge && unviewedCount > 0 && (
                <Badge
                  variant="count"
                  data-testid="nav-unviewed-badge"
                  aria-label={`${unviewedCount} đơn mới chưa xem`}
                >
                  {unviewedCount}
                </Badge>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function LogoutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleLogout() {
    setPending(true)
    try {
      await fetch("/api/op/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": readCsrfToken() },
        credentials: "same-origin",
      })
    } catch {
      // best-effort — clear-cookie is idempotent; navigate regardless
    }
    router.push("/op/login")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-md py-2.5 pr-3 pl-4 text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-sidebar-ring disabled:opacity-50",
        className
      )}
    >
      <LogOutIcon className="size-4" />
      {pending ? "Đang đăng xuất..." : "Đăng xuất"}
    </button>
  )
}

export function OperatorNav({ role, unviewedCount }: OperatorNavProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === "admin")

  // Drawer closes via each link's onNavigate (below), plus Esc/scrim from Dialog —
  // no route-change effect needed (would be a synchronous setState-in-effect).

  return (
    <>
      {/* Desktop persistent sidebar (≥768px) */}
      <nav
        aria-label="Bảng điều khiển"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      >
        <div className="flex h-14 items-center px-4">
          <Link
            href="/op/dashboard"
            className="rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring"
          >
            Bus-Booking
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <NavLinks items={items} pathname={pathname} unviewedCount={unviewedCount} />
        </div>
        <div className="border-t border-sidebar-border px-2 py-2">
          <LogoutButton />
        </div>
      </nav>

      {/* Mobile top bar (≤767px) */}
      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground md:hidden">
          <Dialog.Trigger
            aria-label="Mở menu điều hướng"
            aria-controls="op-nav-drawer"
            className="inline-flex size-10 items-center justify-center rounded-md outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-sidebar-ring"
          >
            <MenuIcon className="size-5" />
          </Dialog.Trigger>
          <Link
            href="/op/dashboard"
            className="rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring"
          >
            Bus-Booking
          </Link>
          {unviewedCount > 0 && (
            <Badge
              variant="count"
              className="ml-auto"
              aria-label={`${unviewedCount} đơn mới chưa xem`}
            >
              {unviewedCount}
            </Badge>
          )}
        </header>

        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:hidden" />
          <Dialog.Popup
            id="op-nav-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-lg transition-transform duration-200 ease-out outline-none data-[ending-style]:-translate-x-full data-[ending-style]:duration-150 data-[starting-style]:-translate-x-full md:hidden"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <Dialog.Title className="font-semibold tracking-tight">
                Bus-Booking
              </Dialog.Title>
              <Dialog.Close
                aria-label="Đóng menu"
                className="inline-flex size-9 items-center justify-center rounded-md outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-sidebar-ring"
              >
                <XIcon className="size-5" />
              </Dialog.Close>
            </div>
            <nav
              aria-label="Bảng điều khiển"
              className="flex-1 overflow-y-auto px-2 py-2"
            >
              <NavLinks
                items={items}
                pathname={pathname}
                unviewedCount={unviewedCount}
                onNavigate={() => setDrawerOpen(false)}
              />
            </nav>
            <div className="border-t border-sidebar-border px-2 py-2">
              <LogoutButton />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
