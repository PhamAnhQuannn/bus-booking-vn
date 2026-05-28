"use client"

import type { ReactNode } from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/op/EmptyState"

export interface ColumnDef<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** `end` aligns right + applies tabular-nums (numeric / currency columns). */
  align?: "start" | "end"
  thClassName?: string
  tdClassName?: string
  /** Label shown in stacked mobile card mode. Defaults to `header` if string. */
  mobileLabel?: ReactNode
  /** Hide this column in mobile card mode. */
  mobileHidden?: boolean
  /** Hide on small viewports (table mode); show in card mode. */
  hideOnDesktop?: never  // reserved
}

export interface DataTableExpandable<T> {
  isExpanded: (row: T) => boolean
  onToggle: (row: T) => void
  render: (row: T) => ReactNode
  /** Aria label for the toggle button. Receives row. */
  toggleLabel?: (row: T) => string
}

export interface DataTablePagination {
  nextCursor: string | null
  onLoadMore: () => void
  loading: boolean
  loadMoreTestId?: string
}

interface DataTableProps<T> {
  /** Screen-reader-only caption identifying the table. */
  caption: string
  columns: ColumnDef<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Optional data-testid factory for each row. */
  rowTestId?: (row: T) => string
  /** Apply per-row className (e.g. escalation tint). */
  rowClassName?: (row: T) => string | undefined
  /** Optional expandable disclosure panel. */
  expandable?: DataTableExpandable<T>
  /** True while initial load or refresh — replaces body with skeletons. */
  loading?: boolean
  /** Rendered when rows is empty and !loading. */
  emptyState?: ReactNode
  /** Cursor pagination (renders Tải thêm). */
  pagination?: DataTablePagination
  /** Optional table-footer (totals row). Rendered inside <TableFooter> on desktop. */
  footer?: ReactNode
  /** Compact density toggle — used when ≥10 rows or by caller preference. */
  density?: "comfortable" | "compact"
  /** Outer Card wrapping (default true). */
  wrapInCard?: boolean
  testId?: string
  className?: string
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowTestId,
  rowClassName,
  expandable,
  loading = false,
  emptyState,
  pagination,
  footer,
  density = "comfortable",
  wrapInCard = true,
  testId,
  className,
}: DataTableProps<T>) {
  const colCount = columns.length + (expandable ? 1 : 0)
  const isEmpty = !loading && rows.length === 0
  const cellPad = density === "compact" ? "py-1.5" : "py-2.5"

  const body = (
    <>
      {/* Desktop table */}
      <div className={cn("hidden md:block", className)}>
        <Table data-testid={testId} aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {expandable ? <TableHead className="w-8" aria-hidden="true" /> : null}
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    col.align === "end" ? "text-right" : "text-left",
                    col.thClassName
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <TableRow key={`skel-${idx}`}>
                  {expandable ? (
                    <TableCell className={cellPad}>
                      <Skeleton className="size-4" />
                    </TableCell>
                  ) : null}
                  {columns.map((col) => (
                    <TableCell key={col.id} className={cn(cellPad, col.tdClassName)}>
                      <Skeleton className="h-4 w-full max-w-[10rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isEmpty ? (
              <TableRow>
                <TableCell colSpan={colCount} className="py-0">
                  {emptyState ?? (
                    <EmptyState title="Không có dữ liệu" variant="inline" />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const expanded = expandable?.isExpanded(row) ?? false
                return (
                  <RowFragment
                    key={rowKey(row)}
                    row={row}
                    columns={columns}
                    expandable={expandable}
                    expanded={expanded}
                    rowTestId={rowTestId}
                    rowClassName={rowClassName}
                    cellPad={cellPad}
                    colCount={colCount}
                  />
                )
              })
            )}
          </TableBody>
          {footer ? (
            <tfoot className="border-t border-border bg-muted/50 font-medium">
              {footer}
            </tfoot>
          ) : null}
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <Card key={`m-skel-${idx}`} className="px-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          ))
        ) : isEmpty ? (
          emptyState ?? <EmptyState title="Không có dữ liệu" variant="card" />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {rows.map((row) => {
              const visible = columns.filter((c) => !c.mobileHidden)
              const expanded = expandable?.isExpanded(row) ?? false
              return (
                <li
                  key={rowKey(row)}
                  data-testid={rowTestId?.(row)}
                  className={cn(
                    "rounded-xl border border-border bg-card p-4 shadow-e1",
                    rowClassName?.(row)
                  )}
                >
                  <dl className="grid gap-2">
                    {visible.map((col) => (
                      <div
                        key={col.id}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <dt className="shrink-0 font-medium text-muted-foreground">
                          {col.mobileLabel ?? col.header}
                        </dt>
                        <dd
                          className={cn(
                            "min-w-0 text-right",
                            col.align === "end" ? "tabular-nums" : undefined,
                            col.tdClassName
                          )}
                        >
                          {col.cell(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {expandable ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => expandable.onToggle(row)}
                        aria-expanded={expanded}
                        aria-label={expandable.toggleLabel?.(row)}
                      >
                        {expanded ? (
                          <ChevronDownIcon aria-hidden="true" />
                        ) : (
                          <ChevronRightIcon aria-hidden="true" />
                        )}
                        {expanded ? "Thu gọn" : "Xem thêm"}
                      </Button>
                      {expanded ? (
                        <div className="mt-3">{expandable.render(row)}</div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {loading ? "Đang tải dữ liệu" : `${rows.length} hàng`}
      </div>

      {pagination && pagination.nextCursor ? (
        <div className="flex justify-center pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pagination.onLoadMore}
            disabled={pagination.loading}
            data-testid={pagination.loadMoreTestId ?? "load-more-btn"}
          >
            {pagination.loading ? "Đang tải..." : "Tải thêm"}
          </Button>
        </div>
      ) : null}
    </>
  )

  if (wrapInCard) {
    return <Card className="overflow-hidden py-0 px-0 md:px-0">{body}</Card>
  }
  return <div>{body}</div>
}

// Inner row component — handles expandable disclosure row on desktop.
function RowFragment<T>({
  row,
  columns,
  expandable,
  expanded,
  rowTestId,
  rowClassName,
  cellPad,
  colCount,
}: {
  row: T
  columns: ColumnDef<T>[]
  expandable?: DataTableExpandable<T>
  expanded: boolean
  rowTestId?: (row: T) => string
  rowClassName?: (row: T) => string | undefined
  cellPad: string
  colCount: number
}) {
  return (
    <>
      <TableRow
        data-testid={rowTestId?.(row)}
        className={rowClassName?.(row)}
      >
        {expandable ? (
          <TableCell className={cn(cellPad, "w-8")}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => expandable.onToggle(row)}
              aria-expanded={expanded}
              aria-label={expandable.toggleLabel?.(row) ?? "Mở/đóng chi tiết"}
            >
              {expanded ? (
                <ChevronDownIcon aria-hidden="true" />
              ) : (
                <ChevronRightIcon aria-hidden="true" />
              )}
            </Button>
          </TableCell>
        ) : null}
        {columns.map((col) => (
          <TableCell
            key={col.id}
            className={cn(
              cellPad,
              col.align === "end" ? "text-right tabular-nums" : undefined,
              col.tdClassName
            )}
          >
            {col.cell(row)}
          </TableCell>
        ))}
      </TableRow>
      {expandable && expanded ? (
        <TableRow>
          <TableCell colSpan={colCount} className="bg-muted/30">
            {expandable.render(row)}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}
