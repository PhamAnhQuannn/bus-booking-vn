"use client"

import * as React from "react"

interface OperatorNavCtx {
  /** Mobile drawer open state. */
  drawerOpen: boolean
  setDrawerOpen: (v: boolean) => void
  /** Sidebar collapsed (icon-only) on desktop. Persisted to localStorage. */
  collapsed: boolean
  toggleCollapsed: () => void
  /** Optional Cmd+K trigger — wired by CommandPaletteProvider in PR 7. */
  onOpenCommand?: () => void
  setOnOpenCommand: (fn: (() => void) | undefined) => void
}

const Ctx = React.createContext<OperatorNavCtx | null>(null)

const STORAGE_KEY = "op:nav-collapsed"

/** External-store subscribe for the localStorage collapsed flag. */
function subscribeCollapsed(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function readCollapsedSnapshot(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function readCollapsedServerSnapshot(): boolean {
  return false
}

export function OperatorNavProvider({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // useSyncExternalStore avoids setState-in-effect (react-hooks/set-state-in-effect).
  const storedCollapsed = React.useSyncExternalStore(
    subscribeCollapsed,
    readCollapsedSnapshot,
    readCollapsedServerSnapshot
  )
  // Track the bump count so toggleCollapsed forces a re-read of the snapshot.
  const [, bumpCollapsed] = React.useReducer((n: number) => n + 1, 0)

  const collapsed = storedCollapsed

  const toggleCollapsed = React.useCallback(() => {
    try {
      const next = !readCollapsedSnapshot()
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      // Cross-tab storage events fire on OTHER tabs only — bump locally.
      bumpCollapsed()
    } catch {
      // ignore
    }
  }, [])

  const [onOpenCommand, setOnOpenCommandState] = React.useState<
    (() => void) | undefined
  >(undefined)
  const setOnOpenCommand = React.useCallback(
    (fn: (() => void) | undefined) => setOnOpenCommandState(() => fn),
    []
  )

  const value = React.useMemo<OperatorNavCtx>(
    () => ({
      drawerOpen,
      setDrawerOpen,
      collapsed,
      toggleCollapsed,
      onOpenCommand,
      setOnOpenCommand,
    }),
    [drawerOpen, collapsed, toggleCollapsed, onOpenCommand, setOnOpenCommand]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useOperatorNav(): OperatorNavCtx {
  const ctx = React.useContext(Ctx)
  if (!ctx) {
    throw new Error(
      "useOperatorNav must be used inside <OperatorNavProvider> (operator console layout)"
    )
  }
  return ctx
}
