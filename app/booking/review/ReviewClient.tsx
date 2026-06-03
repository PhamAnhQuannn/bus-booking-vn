'use client';

/**
 * ReviewClient — client component for the review/confirmation step.
 *
 * Displays hold details fetched from GET /api/holds/[id] server-side (passed as props).
 * Shows total formatted as ###.###đ (Vietnamese currency style).
 * Includes HoldTimer + HoldExpiryModal.
 *
 * On "Xác nhận thanh toán" click, POSTs to /api/bookings/initiate with
 * { holdId, paymentMethod }. Online-only (Issue 039): momo|zalopay|card → 200
 * { payUrl } → window.location to the gateway (real MoMo sandbox or local
 * stub-pay). The bb_hold cookie travels automatically via same-origin
 * credentials.
 */

import { useEffect, useState } from 'react';
import { Wallet, Smartphone, CreditCard } from 'lucide-react';
import { useHoldTimerStore } from '@/lib/state/holdTimerStore';
import { HoldExpiryModal } from '@/components/HoldExpiryModal';
import { BookingSteps } from '@/components/booking/BookingSteps';
import { BookingSummaryRail } from '@/components/booking/BookingSummaryRail';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { readCsrfToken } from '@/lib/auth/csrfClient';
import { getAccessToken } from '@/app/auth/register/page';
import { CONSENT_TEXT, CONSENT_VERSION } from '@/lib/booking/consent';
import { cn } from '@/lib/utils';

export interface HoldDetails {
  holdId: string;
  tripId: string;
  ticketCount: number;
  expiresAt: string;
  unitPriceVND: number;
  totalVND: number;
  routeOrigin: string;
  routeDestination: string;
  departureAt: string;
  operatorLegalName: string;
}

interface ReviewClientProps {
  holdDetails: HoldDetails;
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
  consent_required: 'Vui lòng đồng ý cả hai điều khoản trước khi thanh toán.',
};

type PaymentMethod = 'momo' | 'zalopay' | 'card';

const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string; icon: typeof Wallet }> = [
  { value: 'momo', label: 'MoMo', icon: Wallet },
  { value: 'zalopay', label: 'ZaloPay', icon: Smartphone },
  { value: 'card', label: 'Thẻ', icon: CreditCard },
];

export function ReviewClient({ holdDetails }: ReviewClientProps) {
  const { holdId, expiresAt } = holdDetails;
  const { startTimer } = useHoldTimerStore();

  const [method, setMethod] = useState<PaymentMethod>('momo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Issue 089: both consents must be accepted before initiate is enabled.
  const [noRefund, setNoRefund] = useState(false);
  const [piiStorage, setPiiStorage] = useState(false);
  const consented = noRefund && piiStorage;

  useEffect(() => {
    startTimer(expiresAt);
  }, [expiresAt, startTimer]);

  async function handleSubmit() {
    if (submitting || !consented) return;
    setSubmitting(true);
    setError(null);
    try {
      // Forward the in-memory access token when signed in (Issue 031) so the
      // booking is stamped with the buyer's customerId at creation. Guests omit
      // it and book anonymously. CSRF + bb_hold cookie travel as before.
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'X-CSRF-Token': readCsrfToken(),
      };
      const accessToken = getAccessToken();
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch('/api/bookings/initiate', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          holdId,
          paymentMethod: method,
          consents: { noRefund, piiStorage, version: CONSENT_VERSION },
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.payUrl) {
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
    <div className="flex flex-col-reverse gap-6 md:grid md:grid-cols-[1fr_20rem] md:items-start">
      <HoldExpiryModal />

      {/* Left: steps + payment method + submit */}
      <div className="flex flex-col gap-6">
        <BookingSteps current={2} />

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

        {/* Issue 089: required consent block — both must be checked to enable pay */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Điều khoản đặt vé</CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Điều khoản đặt vé bắt buộc</legend>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="consent-no-refund"
                  checked={noRefund}
                  onChange={(e) => setNoRefund(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>{CONSENT_TEXT.noRefund}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="consent-pii-storage"
                  checked={piiStorage}
                  onChange={(e) => setPiiStorage(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>{CONSENT_TEXT.piiStorage}</span>
              </label>
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

        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting || !consented}
        >
          {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
        </Button>
      </div>

      {/* Right: sticky order summary (PTN-07) */}
      <BookingSummaryRail
        summary={{
          routeOrigin: holdDetails.routeOrigin,
          routeDestination: holdDetails.routeDestination,
          departureAt: holdDetails.departureAt,
          operatorLegalName: holdDetails.operatorLegalName,
          ticketCount: holdDetails.ticketCount,
          unitPriceVND: holdDetails.unitPriceVND,
          totalVND: holdDetails.totalVND,
        }}
      />
    </div>
  );
}
