"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** Plain string description rendered above the consequence list. */
  description?: string
  /** Bullet list of consequences. Each item is a separate <li>. */
  consequences?: ReactNode[]
  /** Extra rich content slot between description and consequences (e.g. an Alert). */
  extra?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** When true — confirm button gets variant=destructive. */
  destructive?: boolean
  /** When true — confirm button is disabled + shows "Đang xử lý…". */
  busy?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  consequences,
  extra,
  confirmLabel,
  cancelLabel = "Huỷ bỏ",
  destructive = true,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {extra}
        {consequences && consequences.length > 0 ? (
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
            {consequences.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
