"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import {
  CalendarPlus,
  ClipboardList,
  LogOut,
  SearchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { NAV_ITEMS, visibleNavItems, type NavRole } from "@/components/op/navConfig"
import { useOperatorNav } from "@/components/op/OperatorNavContext"
import { normalizeVi } from "@/lib/text"
import { readCsrfToken } from "@/lib/auth/csrfClient"
import { cn } from "@/lib/utils"

interface Command {
  id: string
  group: "pages" | "actions" | "recent"
  groupLabel: string
  label: string
  description?: string
  /** Search index — diacritic-stripped concat of label + keywords. */
  index: string
  icon: LucideIcon
  /** Either an href (navigation) or an onSelect handler. */
  href?: string
  onSelect?: () => void | Promise<void>
}

interface CommandPaletteProps {
  role: NavRole
}

const RECENT_KEY = "op:cmdk-recent"
const RECENT_MAX = 5

function readRecent(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function pushRecent(id: string) {
  if (typeof window === "undefined") return
  try {
    const cur = readRecent().filter((x) => x !== id)
    cur.unshift(id)
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(cur.slice(0, RECENT_MAX))
    )
  } catch {
    // ignore
  }
}

export function CommandPalette({ role }: CommandPaletteProps) {
  const router = useRouter()
  const { setOnOpenCommand } = useOperatorNav()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIdx, setActiveIdx] = React.useState(0)
  const listRef = React.useRef<HTMLUListElement>(null)

  // Build base commands once per render of (role, open).
  const commands = React.useMemo<Command[]>(() => {
    const navItems = visibleNavItems(role)

    const pages: Command[] = navItems.map((item) => ({
      id: `nav:${item.id}`,
      group: "pages",
      groupLabel: "Trang",
      label: item.label,
      index: normalizeVi(
        [item.label, ...(item.keywords ?? []), item.href].join(" ")
      ),
      icon: item.icon,
      href: item.href,
    }))

    const actions: Command[] = [
      {
        id: "action:create-trip",
        group: "actions",
        groupLabel: "Hành động",
        label: "Tạo chuyến mới",
        description: "Mở trang quản lý chuyến",
        index: normalizeVi("Tạo chuyến mới create trip new"),
        icon: CalendarPlus,
        href: "/op/trips",
      },
      {
        id: "action:fleet",
        group: "actions",
        groupLabel: "Hành động",
        label: "Quản lý đội xe",
        description: "Mở fleet",
        index: normalizeVi("Quản lý đội xe fleet buses"),
        icon: ClipboardList,
        href: "/op/buses",
      },
      {
        id: "action:logout",
        group: "actions",
        groupLabel: "Hành động",
        label: "Đăng xuất",
        description: "Thoát khỏi tài khoản",
        index: normalizeVi("Đăng xuất logout sign out"),
        icon: LogOut,
        onSelect: async () => {
          try {
            await fetch("/api/op/auth/logout", {
              method: "POST",
              headers: { "X-CSRF-Token": readCsrfToken() },
              credentials: "same-origin",
            })
          } catch {
            // ignore — clear-cookie idempotent
          }
          router.push("/op/login")
          router.refresh()
        },
      },
    ]

    const recentIds = readRecent()
    const recent: Command[] = recentIds
      .map((id): Command | null => {
        const navItem = NAV_ITEMS.find((n) => `nav:${n.id}` === id)
        if (!navItem) return null
        return {
          id: `recent:${navItem.id}`,
          group: "recent",
          groupLabel: "Gần đây",
          label: navItem.label,
          index: normalizeVi(navItem.label),
          icon: navItem.icon,
          href: navItem.href,
        }
      })
      .filter((c): c is Command => c !== null)

    // Recent first, then pages, then actions.
    return [...recent, ...pages, ...actions]
  }, [role, router])

  // Filter by query (token-prefix match) — empty query shows everything.
  const filtered = React.useMemo(() => {
    if (!query.trim()) return commands
    const tokens = normalizeVi(query).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return commands
    return commands.filter((c) => tokens.every((t) => c.index.includes(t)))
  }, [commands, query])

  // Register the open() handler with the nav context so the topbar trigger + sidebar
  // search button can drive us. Reset query + activeIdx on open here (not in a
  // separate effect — react-hooks/set-state-in-effect rule).
  React.useEffect(() => {
    const handler = () => {
      setQuery("")
      setActiveIdx(0)
      setOpen(true)
    }
    setOnOpenCommand(handler)
    return () => setOnOpenCommand(undefined)
  }, [setOnOpenCommand])

  // Global Cmd/Ctrl+K + `/` binding. Skip when input/textarea focused (so users
  // can type `/` into URL filters etc.). IME-composition aware.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.isComposing) return
      const t = document.activeElement as HTMLElement | null
      const inInput =
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((prev) => {
          if (!prev) {
            setQuery("")
            setActiveIdx(0)
          }
          return !prev
        })
      } else if (e.key === "/" && !inInput && !open) {
        e.preventDefault()
        setQuery("")
        setActiveIdx(0)
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Arrow-key navigation inside the listbox.
  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((idx) => (filtered.length === 0 ? 0 : (idx + 1) % filtered.length))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((idx) =>
        filtered.length === 0 ? 0 : (idx - 1 + filtered.length) % filtered.length
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      const cmd = filtered[activeIdx]
      if (cmd) invoke(cmd)
    }
  }

  async function invoke(cmd: Command) {
    setOpen(false)
    // Track recent (pages only).
    if (cmd.group === "pages") pushRecent(cmd.id)
    if (cmd.href) {
      router.push(cmd.href)
    } else if (cmd.onSelect) {
      await cmd.onSelect()
    }
  }

  // Group rendering: split by groupLabel preserving display order.
  const groups = React.useMemo(() => {
    const out: { label: string; items: { cmd: Command; idx: number }[] }[] = []
    filtered.forEach((cmd, idx) => {
      const last = out[out.length - 1]
      if (!last || last.label !== cmd.groupLabel) {
        out.push({ label: cmd.groupLabel, items: [{ cmd, idx }] })
      } else {
        last.items.push({ cmd, idx })
      }
    })
    return out
  }, [filtered])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed top-[15%] left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 gap-2 rounded-xl border border-border bg-card p-2 text-card-foreground shadow-e4 outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0"
          )}
        >
          <Dialog.Title className="sr-only">Bảng lệnh</Dialog.Title>
          <Dialog.Description className="sr-only">
            Tìm trang và hành động. Dùng phím mũi tên + Enter.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="op-cmdk-list"
              aria-activedescendant={
                filtered[activeIdx] ? `op-cmdk-item-${activeIdx}` : undefined
              }
              aria-autocomplete="list"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIdx(0)
              }}
              onKeyDown={handleSearchKey}
              placeholder="Tìm trang hoặc hành động…"
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Dialog.Close
              aria-label="Đóng"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon aria-hidden="true" className="size-4" />
            </Dialog.Close>
          </div>

          <ul
            id="op-cmdk-list"
            ref={listRef}
            role="listbox"
            className="max-h-[60vh] overflow-y-auto px-1 pb-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Không tìm thấy lệnh nào.
              </li>
            ) : (
              groups.map((group) => (
                <li key={group.label} role="presentation">
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {group.label}
                  </div>
                  <ul role="presentation">
                    {group.items.map(({ cmd, idx }) => {
                      const active = idx === activeIdx
                      return (
                        <li
                          key={cmd.id}
                          id={`op-cmdk-item-${idx}`}
                          role="option"
                          aria-selected={active}
                        >
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => invoke(cmd)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm outline-none transition-colors",
                              active
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:bg-muted/60"
                            )}
                          >
                            <cmd.icon aria-hidden="true" className="size-4 shrink-0" />
                            <span className="flex-1 truncate text-foreground">
                              {cmd.label}
                            </span>
                            {cmd.description ? (
                              <span className="hidden text-xs text-muted-foreground sm:inline">
                                {cmd.description}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>

          <div
            aria-live="polite"
            className="sr-only"
          >
            {`${filtered.length} kết quả`}
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 pt-2 pb-1 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-muted px-1 font-mono">↑↓</kbd> điều hướng ·{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono">Enter</kbd> chọn
            </span>
            <span>
              <kbd className="rounded border border-border bg-muted px-1 font-mono">Esc</kbd> đóng
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
