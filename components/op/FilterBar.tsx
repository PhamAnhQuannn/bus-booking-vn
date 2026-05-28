"use client"

import type { FormEvent, ReactNode } from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ActiveFilter {
  id: string
  label: string
  onRemove: () => void
}

interface FilterBarProps {
  /** Label/Input/Select pairs — placed in a responsive grid (1/2/4 cols). */
  children: ReactNode
  /** When form-style — submit handler. Omit for live-filter (url-driven) usage. */
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  /** Active-filter chip strip. Renders below the form when length > 0. */
  activeFilters?: ActiveFilter[]
  /** Clear-all callback. Renders only when ≥2 active filters. */
  onClearAll?: () => void
  clearLabel?: string
  submitLabel?: string
  /** Loading flag — submit button shows pending state. */
  loading?: boolean
  /** Right-aligned extra action (e.g. CSV download anchor) inside the submit row. */
  extraAction?: ReactNode
  className?: string
}

export function FilterBar({
  children,
  onSubmit,
  activeFilters,
  onClearAll,
  clearLabel = "Xoá hết bộ lọc",
  submitLabel = "Lọc",
  loading = false,
  extraAction,
  className,
}: FilterBarProps) {
  const hasActiveChips = (activeFilters?.length ?? 0) > 0
  const showClearAll = (activeFilters?.length ?? 0) >= 2 && onClearAll

  return (
    <Card className={className}>
      <CardContent>
        <form
          onSubmit={onSubmit}
          aria-label="Bộ lọc"
          className="flex flex-col gap-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
          {onSubmit ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {extraAction}
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Đang lọc…" : submitLabel}
              </Button>
            </div>
          ) : null}
        </form>

        {hasActiveChips ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {activeFilters!.map((f) => (
              <span
                key={f.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                )}
              >
                {f.label}
                <button
                  type="button"
                  aria-label={`Bỏ lọc ${f.label}`}
                  onClick={f.onRemove}
                  className="rounded-full p-0.5 transition-colors hover:bg-muted-foreground/20"
                >
                  <XIcon aria-hidden="true" className="size-3" />
                </button>
              </span>
            ))}
            {showClearAll ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={onClearAll}
              >
                {clearLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
