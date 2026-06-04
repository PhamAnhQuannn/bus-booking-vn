"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import {
  ChevronsLeftIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import {
  isNavItemActive,
  visibleNavItems,
  type NavItem,
  type NavRole,
} from "@/components/op/navConfig"
import { useOperatorNav } from "@/components/op/OperatorNavContext"
import { Badge } from "@/components/ui/badge"
import { Logo } from "@/components/brand/Logo"
import { readCsrfToken } from "@/lib/auth"
import { cn } from "@/lib/utils"

export interface OperatorNavProps {
  role: NavRole
  /** Unviewed paid-booking count for the "N mới" badge on the bookings item. */
  unviewedCount: number
}

interface NavLinksProps {
  items: NavItem[]
  pathname: string
  unviewedCount: number
  collapsed?: boolean
  onNavigate?: () => void
}

function NavLinks({
  items,
  pathname,
  unviewedCount,
  collapsed = false,
  onNavigate,
}: NavLinksProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item)
        const showBadge = item.bookingsBadge && unviewedCount > 0
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex min-h-11 items-center gap-2.5 rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring",
                collapsed ? "justify-center px-2" : "justify-between py-2.5 pr-3 pl-4",
                active
                  ? "bg-sidebar-accent font-semibold text-sidebar-primary before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-1 before:rounded-r before:bg-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              <span
                className={cn(
                  "flex items-center",
                  collapsed ? "" : "gap-2.5"
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {collapsed ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  item.label
                )}
              </span>
              {showBadge && !collapsed ? (
                <Badge
                  variant="count"
                  data-testid="nav-unviewed-badge"
                  aria-label={`${unviewedCount} đơn mới chưa xem`}
                >
                  {unviewedCount}
                </Badge>
              ) : null}
              {showBadge && collapsed ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 inline-flex size-2 rounded-full bg-primary"
                />
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
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
      // best-effort
    }
    router.push("/op/login")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      title={collapsed ? "Đăng xuất" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-md text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-sidebar-ring disabled:opacity-50",
        collapsed ? "justify-center px-2" : "py-2.5 pr-3 pl-4"
      )}
    >
      <LogOutIcon aria-hidden="true" className="size-4" />
      {collapsed ? (
        <span className="sr-only">Đăng xuất</span>
      ) : pending ? (
        "Đang đăng xuất..."
      ) : (
        "Đăng xuất"
      )}
    </button>
  )
}

export function OperatorNav({ role, unviewedCount }: OperatorNavProps) {
  const pathname = usePathname() || ""
  const { drawerOpen, setDrawerOpen, collapsed, toggleCollapsed, onOpenCommand } =
    useOperatorNav()

  const items = visibleNavItems(role)

  return (
    <>
      {/* Desktop persistent sidebar (≥768px) */}
      <nav
        aria-label="Bảng điều khiển"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-60"
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center",
            collapsed ? "justify-center px-1" : "justify-between px-4"
          )}
        >
          <Link
            href="/op/dashboard"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring"
            aria-label="Bảng điều khiển"
          >
            <Logo variant={collapsed ? "glyph" : "combo"} />
          </Link>
          {!collapsed ? (
            <button
              type="button"
              aria-label="Thu gọn thanh điều hướng"
              onClick={toggleCollapsed}
              className="inline-flex size-7 items-center justify-center rounded-md outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-sidebar-ring"
            >
              <ChevronsLeftIcon aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>

        {/* Cmd-K search slot — visible on collapsed bar too. Always rendered to
            keep the SSR + hydration tree identical; CommandPalette registers
            `onOpenCommand` in an effect so calling via optional-chain is the
            stable no-op until the palette is ready. */}
        <div className={cn("px-2 pb-2", collapsed && "px-1")}>
            <button
              type="button"
              onClick={() => onOpenCommand?.()}
              aria-label="Mở bảng lệnh"
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                "flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background/40 text-xs text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-sidebar-ring",
                collapsed ? "size-10 justify-center" : "px-2 py-1.5"
              )}
            >
              <SearchIcon aria-hidden="true" className="size-3.5" />
              {collapsed ? (
                <span className="sr-only">Tìm lệnh</span>
              ) : (
                <>
                  <span>Tìm lệnh…</span>
                  <kbd className="ml-auto rounded border border-border bg-muted px-1 font-mono text-[10px]">
                    ⌘K
                  </kbd>
                </>
              )}
            </button>
          </div>

        <div className={cn("flex-1 overflow-y-auto py-2", collapsed ? "px-1" : "px-2")}>
          <NavLinks
            items={items}
            pathname={pathname}
            unviewedCount={unviewedCount}
            collapsed={collapsed}
          />
        </div>
        <div
          className={cn(
            "border-t border-sidebar-border py-2",
            collapsed ? "px-1" : "px-2"
          )}
        >
          {collapsed ? (
            <button
              type="button"
              aria-label="Mở rộng thanh điều hướng"
              onClick={toggleCollapsed}
              className="mb-1 inline-flex size-10 w-full items-center justify-center rounded-md outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-sidebar-ring"
            >
              <PanelLeftIcon aria-hidden="true" className="size-4" />
            </button>
          ) : null}
          <LogoutButton collapsed={collapsed} />
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
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring"
          >
            <Logo variant="combo" />
          </Link>
          {unviewedCount > 0 ? (
            <Badge
              variant="count"
              className="ml-auto"
              aria-label={`${unviewedCount} đơn mới chưa xem`}
            >
              {unviewedCount}
            </Badge>
          ) : null}
        </header>

        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:hidden" />
          <Dialog.Popup
            id="op-nav-drawer"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-lg transition-transform duration-200 ease-out outline-none data-[ending-style]:-translate-x-full data-[ending-style]:duration-150 data-[starting-style]:-translate-x-full md:hidden"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <Dialog.Title>
                <Logo variant="combo" />
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
