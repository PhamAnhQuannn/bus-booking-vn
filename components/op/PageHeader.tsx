import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  /** Optional breadcrumb chain rendered above the title. Final crumb is text-only. */
  breadcrumb?: BreadcrumbItem[]
  /** Page <h1>. Only one PageHeader per page. */
  title: string
  /** Optional sub-title under the title. */
  subtitle?: ReactNode
  /** Optional inline node next to the title (Badge for counts, status pill, etc.). */
  badge?: ReactNode
  /** Right-aligned action cluster (Button group, CSV link, etc.). */
  actions?: ReactNode
  /** Optional second row for filter chips / FilterBar. */
  filters?: ReactNode
  /** Mobile back-affordance for detail pages (href to parent list). */
  backHref?: string
  className?: string
}

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  badge,
  actions,
  filters,
  backHref,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-3 border-b border-border pb-4",
        className
      )}
    >
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Đường dẫn" className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            {breadcrumb.map((crumb, idx) => {
              const isLast = idx === breadcrumb.length - 1
              return (
                <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-foreground hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={isLast ? "text-foreground" : undefined}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast ? (
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-3 shrink-0 text-muted-foreground/60"
                    />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
            >
              <ChevronRightIcon
                aria-hidden="true"
                className="size-4 rotate-180"
              />
              Trở lại
            </Link>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle ? (
            typeof subtitle === "string" ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : (
              subtitle
            )
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {filters ? <div className="pt-1">{filters}</div> : null}
    </header>
  )
}
