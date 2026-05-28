import { cn } from "@/lib/utils"

/**
 * EnvBadge — small chip in the ConsoleHeader indicating non-production environments.
 *
 * Hidden in production. Uses `process.env.NEXT_PUBLIC_APP_ENV` if set, otherwise
 * derives from NODE_ENV.
 */
export function EnvBadge({ className }: { className?: string }) {
  const explicit = process.env.NEXT_PUBLIC_APP_ENV
  const env = explicit ?? process.env.NODE_ENV ?? "development"
  if (env === "production" && explicit !== "staging") return null

  const isStaging = env === "staging" || explicit === "staging"
  const label = isStaging ? "STAGING" : "DEV"
  const palette = isStaging
    ? "border-warning-border bg-warning text-warning-foreground"
    : "border-info-border bg-info text-info-foreground"

  return (
    <span
      aria-label={`Môi trường ${label}`}
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        palette,
        className
      )}
    >
      {label}
    </span>
  )
}
