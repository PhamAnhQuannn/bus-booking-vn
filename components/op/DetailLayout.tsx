import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface DetailLayoutProps {
  /** Typically a <PageHeader />. */
  header: ReactNode
  /** Optional top-of-page alert / error / success banner. */
  alert?: ReactNode
  /** Main column — stack of section Cards. */
  main: ReactNode
  /** Sticky aside on lg+ — status, primary lifecycle CTA, destructive secondary. */
  aside?: ReactNode
  /** Mobile-only fixed action bar at viewport bottom. Repeats the aside's primary CTA. */
  stickyMobileBar?: ReactNode
  className?: string
}

export function DetailLayout({
  header,
  alert,
  main,
  aside,
  stickyMobileBar,
  className,
}: DetailLayoutProps) {
  const hasAside = Boolean(aside)
  return (
    <>
      <div
        className={cn(
          // Mobile bottom-bar reserve when both stickyMobileBar AND aside are present.
          stickyMobileBar ? "pb-24 lg:pb-0" : null,
          className
        )}
      >
        {header}
        {alert ? <div className="mb-4">{alert}</div> : null}
        <div
          className={cn(
            "grid gap-6",
            hasAside ? "lg:grid-cols-[1fr_320px]" : "lg:grid-cols-1"
          )}
        >
          <div className="flex min-w-0 flex-col gap-4">{main}</div>
          {hasAside ? (
            <aside
              aria-label="Hành động"
              className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start"
            >
              {aside}
            </aside>
          ) : null}
        </div>
      </div>
      {stickyMobileBar ? (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 py-3 shadow-e3 lg:hidden"
          )}
        >
          {stickyMobileBar}
        </div>
      ) : null}
    </>
  )
}
