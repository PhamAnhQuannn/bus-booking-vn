import type { ReactNode } from "react"

import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  /** Optional lucide-react icon node (rendered inside a muted circle, size-6). */
  icon?: ReactNode
  title: string
  description?: string
  /** Optional CTA — `href` renders an anchor styled as Button; `onClick` renders a Button. */
  action?:
    | { label: string; href: string }
    | { label: string; onClick: () => void }
  /** `inline` = bare flex column (used inside DataTable empty row).
   *  `card` = wrapped in <Card> for standalone page-level empty states. */
  variant?: "inline" | "card"
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "inline",
  className,
}: EmptyStateProps) {
  const body = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-base font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <div className="mt-2">
          {"href" in action ? (
            <Link href={action.href} className={buttonVariants({ size: "sm" })}>
              {action.label}
            </Link>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )

  if (variant === "card") {
    return (
      <Card>
        <CardContent>{body}</CardContent>
      </Card>
    )
  }
  return body
}
