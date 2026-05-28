"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BellIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Breadcrumbs } from "@/components/op/Breadcrumbs"
import { EnvBadge } from "@/components/op/EnvBadge"
import { OperatorPillMenu } from "@/components/op/OperatorPillMenu"
import { useOperatorNav } from "@/components/op/OperatorNavContext"
import { cn } from "@/lib/utils"

interface ConsoleHeaderProps {
  operatorName: string
  role: "admin" | "staff"
  /** Unread activity count for the bell badge — PR 8 wires the live polling. */
  unreadCount?: number
  /** Bell click handler — PR 8 opens the alert popover. */
  onOpenBell?: () => void
  className?: string
}

export function ConsoleHeader({
  operatorName,
  role,
  unreadCount = 0,
  onOpenBell,
  className,
}: ConsoleHeaderProps) {
  const { onOpenCommand } = useOperatorNav()
  const router = useRouter()
  const handleBellClick = onOpenBell ?? (() => router.push("/op/activity"))

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6",
        className
      )}
    >
      <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
        <Breadcrumbs />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <EnvBadge />

        <button
          type="button"
          aria-label="Mở bảng lệnh"
          aria-keyshortcuts="Meta+K Control+K"
          onClick={onOpenCommand}
          disabled={!onOpenCommand}
          className={cn(
            "hidden items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:inline-flex"
          )}
        >
          <SearchIcon aria-hidden="true" className="size-3.5" />
          <span>Tìm lệnh…</span>
          <kbd className="ml-1 rounded border border-border bg-muted px-1 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : "Thông báo"
          }
          onClick={handleBellClick}
          className={cn(
            "relative inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          )}
        >
          <BellIcon aria-hidden="true" className="size-4" />
          {unreadCount > 0 ? (
            <Badge
              variant="count"
              className="absolute -top-1.5 -right-1.5 min-w-4 justify-center px-1 py-0 text-[10px] leading-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </button>

        <OperatorPillMenu name={operatorName} role={role} />
      </div>
    </header>
  )
}
