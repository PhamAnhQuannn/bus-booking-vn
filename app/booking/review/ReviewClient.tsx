'use client';

/**
 * ReviewClient — client component for the review/confirmation step.
 *
 * Displays hold details fetched from GET /api/holds/[id] server-side (passed as props).
 * Shows total formatted as ###.###đ (Vietnamese currency style).
 * Includes HoldTimer + HoldExpiryModal.
 */

import { useEffect } from 'react';
import { useHoldTimerStore } from '@/lib/state/holdTimerStore';
import { HoldTimer } from '@/components/HoldTimer';
import { HoldExpiryModal } from '@/components/HoldExpiryModal';

export interface HoldDetails {
  tripId: string;
  ticketCount: number;
  expiresAt: string;
  totalVND: number;
}

interface ReviewClientProps {
  holdDetails: HoldDetails;
}

/**
 * Format a number as Vietnamese Dong: 300000 → "300.000đ"
 */
function formatVND(amount: number): string {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + 'đ'
  );
}

export function ReviewClient({ holdDetails }: ReviewClientProps) {
  const { expiresAt, totalVND, ticketCount, tripId } = holdDetails;
  const { startTimer } = useHoldTimerStore();

  useEffect(() => {
    startTimer(expiresAt);
  }, [expiresAt, startTimer]);

  return (
    <div className="space-y-6">
      <HoldExpiryModal />

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Chi tiết đặt chỗ</h2>
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-gray-600">Mã chuyến</dt>
            <dd className="font-mono text-sm">{tripId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Số vé</dt>
            <dd>{ticketCount}</dd>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t pt-2">
            <dt>Tổng cộng</dt>
            <dd className="text-blue-700">{formatVND(totalVND)}</dd>
          </div>
        </dl>
      </div>

      <HoldTimer />

      <button
        type="button"
        className="w-full bg-green-600 text-white rounded px-4 py-2 font-semibold hover:bg-green-700"
      >
        Xác nhận thanh toán
      </button>
    </div>
  );
}
