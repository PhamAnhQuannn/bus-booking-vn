import type { ReactNode } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export interface QuickAction {
  id: string
  label: string
  href: string
  icon: ReactNode
  /** Optional subtitle / hint below the label. */
  description?: string
}

interface QuickActionGridProps {
  actions: QuickAction[]
  className?: string
}

/**
 * Verb-first action shortcuts on the dashboard landing. Icon-LEFT-of-label
 * (not floating-icon) per anti-generic check — operator users prefer dense
 * labelled buttons over decorative tiles.
 */
export function QuickActionGrid({ actions, className }: QuickActionGridProps) {
  return (
    <ul
      role="list"
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {actions.map((action) => (
        <li key={action.id}>
          <Link
            href={action.href}
            className={cn(
              "group flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-e1 outline-none transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-e2 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0"
            )}
          >
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5"
            >
              {action.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {action.label}
              </span>
              {action.description ? (
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
