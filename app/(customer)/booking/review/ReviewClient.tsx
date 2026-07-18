'use client';

/**
 * ReviewClient — client component for the review/confirmation step.
 *
 * Phase 1: bank transfer only. Payment method is hardcoded to 'bank_transfer'.
 * MoMo/ZaloPay/Card payment method selector removed — restore when Phase 2
 * multi-payment is enabled.
 */

import { useEffect, useState } from 'react';
import { useHoldTimerStore } from '@/lib/state';
import { HoldExpiryModal } from '@/components/HoldExpiryModal';
import { BookingSteps } from '@/components/booking/BookingSteps';
import { BookingSummaryRail } from '@/components/booking/BookingSummaryRail';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/lib/auth/clientSession';
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
  pickupKind: 'station' | 'custom';
  pickupDetail: string | null;
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

export function ReviewClient({ holdDetails }: ReviewClientProps) {
  const { holdId, expiresAt } = holdDetails;
  const { startTimer } = useHoldTimerStore();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Payment method selection — bank transfer (VietQR/SePay) or VNPay (card/ATM).
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'vnpay'>('bank_transfer');
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
      // it and book anonymously. authFetch attaches Bearer + CSRF and retries
      // once on a 401 (Issue 168 — proactive/reactive token refresh).
      const res = await authFetch('/api/bookings/initiate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          holdId,
          paymentMethod,
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
            <fieldset className="flex flex-col gap-3" disabled={submitting}>
              <legend className="sr-only">Chọn phương thức thanh toán</legend>

              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  paymentMethod === 'bank_transfer'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank_transfer"
                  checked={paymentMethod === 'bank_transfer'}
                  onChange={() => setPaymentMethod('bank_transfer')}
                  disabled={submitting}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Chuyển khoản ngân hàng (VietQR)</span>
                  <span className="text-sm text-muted-foreground">
                    Quét mã QR và chuyển khoản, xác nhận tự động trong vài phút
                  </span>
                </span>
              </label>

              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  paymentMethod === 'vnpay'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="vnpay"
                  checked={paymentMethod === 'vnpay'}
                  onChange={() => setPaymentMethod('vnpay')}
                  disabled={submitting}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">VNPay (thẻ ATM / thẻ quốc tế / QR)</span>
                  <span className="text-sm text-muted-foreground">
                    Bạn sẽ được chuyển đến trang thanh toán của VNPay
                  </span>
                </span>
              </label>
            </fieldset>
          </CardContent>
        </Card>

        {/* Issue 107: traveler pickup selection (read-only summary) */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Điểm đón</CardTitle>
          </CardHeader>
          <CardContent>
            {holdDetails.pickupKind === 'custom' ? (
              <p className="text-sm" data-testid="review-pickup">
                <span className="text-warning font-medium">Điểm đón khác (chờ nhà xe xác nhận): </span>
                {holdDetails.pickupDetail}
              </p>
            ) : (
              <p className="text-sm" data-testid="review-pickup">
                Tại bến xe
              </p>
            )}
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
                <span>
                  {CONSENT_TEXT.noRefund}{' '}
                  <a
                    href="/chinh-sach-huy-ve-hoan-tien"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Xem chi tiết
                  </a>
                </span>
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
                <span>
                  {CONSENT_TEXT.piiStorage}{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Xem chi tiết
                  </a>
                </span>
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
          className="w-full bg-primary-strong hover:bg-primary-strong/90"
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
