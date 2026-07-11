'use client';

/**
 * HoldExpiryModal — non-dismissible modal shown when the seat hold expires.
 *
 * On appear: automatically redirects to /search after a short delay,
 * or on button click.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHoldTimerStore } from '@/lib/state';
import { useBookingStore } from '@/lib/state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

export function HoldExpiryModal() {
  const router = useRouter();
  const { isExpired } = useHoldTimerStore();
  const { clearBooking } = useBookingStore();

  useEffect(() => {
    if (!isExpired) return;
    // Clear booking state on expiry
    clearBooking();
  }, [isExpired, clearBooking]);

  function handleGoToSearch() {
    router.replace('/');
  }

  // Controlled open with no onOpenChange handler → Esc/backdrop cannot close it; expiry forces re-search.
  return (
    <Dialog open={isExpired}>
      <DialogContent showCloseButton={false} className="max-w-sm text-center">
        <div className="text-4xl" aria-hidden="true">
          ⏰
        </div>
        <DialogTitle className="text-xl font-bold">Chỗ giữ đã hết hạn</DialogTitle>
        <DialogDescription>
          Chỗ ngồi của bạn đã được giải phóng. Vui lòng tìm kiếm và chọn chuyến xe mới.
        </DialogDescription>
        <Button size="lg" className="w-full" onClick={handleGoToSearch}>
          Tìm chuyến xe mới
        </Button>
      </DialogContent>
    </Dialog>
  );
}
