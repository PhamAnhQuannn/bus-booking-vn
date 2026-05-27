"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { alertVariants } from "@/components/ui/alert"

// Mount <ToastProvider> high in the tree (operator layout) and render <Toaster />
// inside it. Surfaces enqueue via useToast().add({ title, description, type }).
const ToastProvider = ToastPrimitive.Provider
const useToast = ToastPrimitive.useToastManager

// Toast type → Alert variant. Defaults to "info".
const TYPE_TO_VARIANT: Record<string, "info" | "success" | "warning" | "error"> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
}

function Toaster() {
  const { toasts } = useToast()
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-[100] mx-auto flex w-full max-w-sm flex-col gap-2 p-4 sm:right-4 sm:bottom-4">
        {toasts.map((toast) => {
          const variant = TYPE_TO_VARIANT[toast.type ?? "info"] ?? "info"
          return (
            <ToastPrimitive.Root
              key={toast.id}
              toast={toast}
              className={cn(
                alertVariants({ variant }),
                "pr-9 shadow-md transition-all duration-200 ease-out data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0"
              )}
            >
              <ToastPrimitive.Title className="col-start-1 font-medium tracking-tight" />
              <ToastPrimitive.Description className="col-start-1 text-sm" />
              <ToastPrimitive.Close
                aria-label="Đóng thông báo"
                className="absolute top-2.5 right-2.5 rounded-sm opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4"
              >
                <XIcon />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          )
        })}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

export { ToastProvider, Toaster, useToast }
