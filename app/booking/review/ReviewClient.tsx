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
import { Wallet, Smartphone, CreditCard, Banknote } from 'lucide-react';
import { useHoldTimerStore } from '@/lib/state/holdTimerStore';
import { HoldTimer } from '@/components/HoldTimer';
import { HoldExpiryModal } from '@/components/HoldExpiryModal';
import { BookingSteps } from '@/components/booking/BookingSteps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { cn } from '@/lib/utils';

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

const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string; icon: typeof Wallet }> = [
  { value: 'cash', label: 'Tiền mặt', icon: Banknote },
  { value: 'momo', label: 'MoMo', icon: Wallet },
  { value: 'zalopay', label: 'ZaloPay', icon: Smartphone },
  { value: 'card', label: 'Thẻ', icon: CreditCard },
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
    <div className="flex flex-col gap-6">
      <HoldExpiryModal />
      <BookingSteps current={2} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Chi tiết đặt chỗ</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Mã chuyến</dt>
              <dd className="truncate font-mono text-xs">{tripId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số vé</dt>
              <dd>{ticketCount}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-lg font-semibold">
              <dt>Tổng cộng</dt>
              <dd className="font-mono text-primary">{formatVND(totalVND)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <HoldTimer />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Phương thức thanh toán</CardTitle>
        </CardHeader>
        <CardContent>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Phương thức thanh toán</legend>
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.icon;
              const selected = method === m.value;
              return (
                <label
                  key={m.value}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m.value}
                    checked={selected}
                    onChange={() => setMethod(m.value)}
                    disabled={submitting}
                    className="sr-only"
                  />
                  <Icon className="size-4" aria-hidden="true" />
                  {m.label}
                </label>
              );
            })}
          </fieldset>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Button type="button" size="lg" className="w-full" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
      </Button>
    </div>
  );
}
