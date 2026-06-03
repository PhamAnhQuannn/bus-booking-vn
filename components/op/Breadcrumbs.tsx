"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"

import { findNavItem, NAV_ITEMS } from "@/components/op/navConfig"
import { cn } from "@/lib/utils"

/**
 * Breadcrumbs derived from the current pathname + navConfig.
 *
 * Heuristic: split the pathname, walk segment-by-segment, render a crumb whenever
 * the accumulated prefix matches a nav item's href (or its match prefix). The final
 * segment renders as plain text. Dynamic [id] segments fall through as raw text.
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname() || ""
  if (!pathname.startsWith("/op")) return null

  const segments = pathname.split("/").filter(Boolean)
  const crumbs: { label: string; href?: string; isLast: boolean }[] = []
  let acc = ""

  segments.forEach((seg, idx) => {
    acc = `${acc}/${seg}`
    const isLast = idx === segments.length - 1

    // Resolve label from navConfig where possible.
    const navMatch = NAV_ITEMS.find(
      (n) => n.href === acc || (n.match && acc === n.match)
    )
    if (navMatch) {
      crumbs.push({ label: navMatch.label, href: isLast ? undefined : acc, isLast })
      return
    }

    // Suppress the `/op` prefix itself (sidebar implies operator context).
    if (acc === "/op") return

    // Dynamic segment fallback — show the segment verbatim (typically an ID).
    crumbs.push({
      label: decodeURIComponent(seg).slice(0, 16),
      href: isLast ? undefined : acc,
      isLast,
    })
  })

  // Single-crumb breadcrumb is noise; skip rendering.
  if (crumbs.length <= 1) return null

  return (
    <nav
      aria-label="Đường dẫn"
      className={cn("text-xs text-muted-foreground", className)}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {/* Home anchor — link to dashboard. */}
        <li>
          <Link href="/op/dashboard" className="hover:text-foreground hover:underline">
            {findNavItem("overview")?.label ?? "Tổng quan"}
          </Link>
        </li>
        {crumbs.map((c, idx) => (
          <Fragment key={`${c.label}-${idx}`}>
            <li aria-hidden="true">
              <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/60" />
            </li>
            <li>
              {c.href ? (
                <Link href={c.href} className="hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {c.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
