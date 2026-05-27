import * as React from "react"

import { cn } from "@/lib/utils"

// Continuous pulse while loading; collapses to a static muted block under
// prefers-reduced-motion (motion spec). Shape still conveys loading.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
