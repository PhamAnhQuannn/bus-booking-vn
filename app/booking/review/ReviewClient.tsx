'use client';

/**
 * ReviewClient — client component for the review/confirmation step.
 *
 * Displays hold details fetched from GET /api/holds/[id] server-side (passed as props).
 * Shows total formatted as ###.###đ (Vietnamese currency style).
 * Includes HoldTimer + HoldExpiryModal.
 *
 * On "Xác nhận thanh toán" click, POSTs to /api/bookings/initiate with
 * { holdId, paymentMethod }. Cash → 200 { confirmationToken } → router.push
 * to the confirmation page. Online (momo|zalopay|card) → 200 { payUrl } →
 * window.location to the gateway (real MoMo sandbox or local stub-pay). The
 * bb_hold cookie travels automatically via same-origin credentials.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHoldTimerStore } from '@/lib/state/holdTimerStore';
import { HoldTimer } from '@/components/HoldTimer';
import { HoldExpiryModal } from '@/components/HoldExpiryModal';
import { readCsrfToken } from '@/lib/auth/csrfClient';

export interface HoldDetails {
  holdId: string;
  tripId: string;
  ticketCount: number;
  expiresAt: string;
  totalVND: number;
}

interface ReviewClientProps {
  holdDetails: HoldDetails;
}

function formatVND(amount: number): string {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + 'đ'
  );
}

const ERROR_LABEL: Record<string, string> = {
  HOLD_EXPIRED: 'Hết thời gian giữ chỗ. Vui lòng đặt lại.',
  TRIP_DEPARTED: 'Chuyến đã khởi hành. Vui lòng chọn chuyến khác.',
  NOT_FOUND: 'Không tìm thấy giữ chỗ. Vui lòng đặt lại.',
  FORBIDDEN: 'Phiên giữ chỗ không hợp lệ. Vui lòng đặt lại.',
  INVALID: 'Yêu cầu không hợp lệ.',
  TOO_MANY_REQUESTS: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  UNAVAILABLE: 'Hệ thống tạm thời bận. Vui lòng thử lại.',
  GATEWAY_ERROR: 'Cổng thanh toán gặp lỗi. Vui lòng thử lại.',
};

type PaymentMethod = 'cash' | 'momo' | 'zalopay' | 'card';

const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'momo', label: 'MoMo' },
  { value: 'zalopay', label: 'ZaloPay' },
  { value: 'card', label: 'Thẻ' },
];

export function ReviewClient({ holdDetails }: ReviewClientProps) {
  const router = useRouter();
  const { holdId, expiresAt, totalVND, ticketCount, tripId } = holdDetails;
  const { startTimer } = useHoldTimerStore();

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTimer(expiresAt);
  }, [expiresAt, startTimer]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/initiate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-CSRF-Token': readCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ holdId, paymentMethod: method }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && method === 'cash' && data?.confirmationToken) {
        router.push(`/booking/confirmation/${data.confirmationToken}`);
        return;
      }
      if (res.ok && method !== 'cash' && data?.payUrl) {
        window.location.href = data.payUrl;
        return;
      }
      const code = typeof data?.error === 'string' ? data.error : 'UNAVAILABLE';
      setError(ERROR_LABEL[code] ?? ERROR_LABEL.UNAVAILABLE);
      setSubmitting(false);
    } catch {
      setError(ERROR_LABEL.UNAVAILABLE);
      setSubmitting(false);
    }
  }

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

      <fieldset className="bg-white border rounded-lg p-4 space-y-2">
        <legend className="text-sm font-semibold px-1">Phương thức thanh toán</legend>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.value}
              className={`flex items-center gap-2 border rounded px-3 py-2 cursor-pointer text-sm ${
                method === m.value
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={m.value}
                checked={method === m.value}
                onChange={() => setMethod(m.value)}
                disabled={submitting}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 rounded px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-green-600 text-white rounded px-4 py-2 font-semibold hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
      >
        {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
      </button>
    </div>
  );
}
