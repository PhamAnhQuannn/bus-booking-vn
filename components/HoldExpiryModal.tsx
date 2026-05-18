'use client';

/**
 * HoldExpiryModal — non-dismissible modal shown when the seat hold expires.
 *
 * On appear: automatically redirects to /search after a short delay,
 * or on button click.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHoldTimerStore } from '@/lib/state/holdTimerStore';
import { useBookingStore } from '@/lib/state/bookingStore';

export function HoldExpiryModal() {
  const router = useRouter();
  const { isExpired } = useHoldTimerStore();
  const { clearBooking } = useBookingStore();

  useEffect(() => {
    if (!isExpired) return;
    // Clear booking state on expiry
    clearBooking();
  }, [isExpired, clearBooking]);

  if (!isExpired) return null;

  function handleGoToSearch() {
    router.replace('/search');
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="expiry-modal-title"
      aria-describedby="expiry-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 text-center space-y-4">
        <div className="text-4xl">⏰</div>
        <h2 id="expiry-modal-title" className="text-xl font-bold text-gray-900">
          Chỗ giữ đã hết hạn
        </h2>
        <p id="expiry-modal-desc" className="text-gray-600">
          Chỗ ngồi của bạn đã được giải phóng. Vui lòng tìm kiếm và chọn chuyến xe mới.
        </p>
        <button
          type="button"
          onClick={handleGoToSearch}
          className="w-full bg-blue-600 text-white rounded px-4 py-2 font-semibold hover:bg-blue-700"
        >
          Tìm chuyến xe mới
        </button>
      </div>
    </div>
  );
}
