'use client';

/**
 * CancelTripDialog — confirm-and-collect-reason modal for trip cancellation
 * (Issue 013). Replaces the old prompt()/confirm() pair with a Dialog primitive
 * (focus trap + Esc + backdrop owned by base-ui).
 *
 * The reason must be ≥10 chars (server enforces; we gate the submit button too).
 * Mounted only while open; onOpenChange(false) → onClose.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
  disabled: boolean;
}

const MIN_REASON = 10;

export default function CancelTripDialog({ onConfirm, onClose, disabled }: Props) {
  const [reason, setReason] = useState('');
  const tooShort = reason.trim().length < MIN_REASON;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (tooShort) return;
    await onConfirm(reason.trim());
  }

  return (
    <Dialog
      open
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid="cancel-trip-dialog">
        <DialogHeader>
          <DialogTitle>Huỷ chuyến</DialogTitle>
          <DialogDescription>
            Hành động không thể hoàn tác. Mọi đặt vé và giữ chỗ sẽ bị huỷ và hành khách được
            thông báo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">Lý do huỷ (tối thiểu {MIN_REASON} ký tự)</Label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={MIN_REASON}
              rows={3}
              disabled={disabled}
              data-testid="cancel-reason"
              className={cn(
                'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
              )}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={disabled}
              data-testid="cancel-trip-abort"
            >
              Đóng
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={disabled || tooShort}
              data-testid="cancel-trip-confirm"
            >
              {disabled ? 'Đang xử lý...' : 'Xác nhận huỷ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
