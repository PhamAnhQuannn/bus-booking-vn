"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Menu } from "@base-ui/react/menu"
import { ChevronDownIcon, LogOutIcon, UserCircleIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { readCsrfToken } from "@/lib/auth"
import { cn } from "@/lib/utils"

interface OperatorPillMenuProps {
  /** Display name (operator legal name or operator-user phone fallback). */
  name: string
  role: "admin" | "staff"
}

export function OperatorPillMenu({ name, role }: OperatorPillMenuProps) {
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

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase()

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted"
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials || "OP"}
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
        <Badge variant="neutral" className="hidden sm:inline-flex">
          {role === "admin" ? "Quản trị" : "Nhân viên"}
        </Badge>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end">
          <Menu.Popup
            className={cn(
              "z-50 min-w-44 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-e3 outline-none",
              "transition-[transform,opacity] duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
            )}
          >
            <div className="px-2 py-1.5 text-xs text-muted-foreground sm:hidden">
              {name}
            </div>
            <Menu.Item
              render={
                <Link
                  href="/op/profile"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted data-[highlighted]:bg-muted"
                />
              }
            >
              <UserCircleIcon aria-hidden="true" className="size-4" /> Hồ sơ
            </Menu.Item>
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
