"use client"

/**
 * AdminAccountMenu — identity + logout menu for the admin console sidebar footer.
 *
 * Mirrors components/op/OperatorPillMenu.tsx (same @base-ui Menu primitive + CSRF
 * double-submit logout). Client component: deep-imports the client-safe
 * readCsrfToken from @/lib/auth/csrfClient — NEVER the @/lib/auth barrel, which
 * pulls server-only siblings into the client bundle (CLAUDE.md client-barrel rule).
 *
 * The console layout reads the admin identity centrally (one prisma read) and
 * passes email + role here, so no per-page wiring is needed.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Menu } from "@base-ui/react/menu"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { readCsrfToken } from "@/lib/auth/csrfClient"
import { cn } from "@/lib/utils"

type AdminRole = "SUPER_ADMIN" | "FINANCE" | "SUPPORT"

const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: "Quản trị tối cao",
  FINANCE: "Tài chính",
  SUPPORT: "Hỗ trợ",
}

interface AdminAccountMenuProps {
  email: string
  role: AdminRole
}

export function AdminAccountMenu({ email, role }: AdminAccountMenuProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleLogout() {
    setPending(true)
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": readCsrfToken() },
        credentials: "same-origin",
      })
    } catch {
      // best-effort
    }
    router.push("/admin/login")
    router.refresh()
  }

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "inline-flex w-full items-center gap-2 rounded-full border border-sidebar-border bg-sidebar px-2 py-1 text-sm font-medium outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring aria-expanded:bg-sidebar-accent"
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials || "AD"}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{email}</span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start">
          <Menu.Popup
            className={cn(
              "z-50 min-w-52 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-e3 outline-none",
              "transition-[transform,opacity] duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
            )}
          >
            <div className="flex flex-col gap-1 px-2 py-1.5">
              <span className="truncate text-xs text-muted-foreground">{email}</span>
              <Badge variant="neutral" className="w-fit">
                {ROLE_LABEL[role]}
              </Badge>
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              onClick={handleLogout}
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 data-[highlighted]:bg-destructive/10 disabled:opacity-50"
            >
              <LogOutIcon aria-hidden="true" className="size-4" />
              {pending ? "Đang đăng xuất…" : "Đăng xuất"}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
