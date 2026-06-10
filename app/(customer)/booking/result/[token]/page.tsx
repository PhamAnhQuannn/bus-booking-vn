/**
 * /booking/result/[token] — MoMo payment result / polling page.
 *
 * Status-based rendering:
 *   awaiting_payment       → "Đang chờ thanh toán" + auto-refresh every 5s
 *                            (capped at 24 refreshes ≈ 2 min via ?r= counter)
 *   paid → Success banner + link to /booking/confirmation/[token]
 *   payment_failed_expired → Failure banner + retry CTA to /search
 *   other statuses         → Fallback (e.g. booking cancelled)
 *
 * Server component: calls getBookingByConfirmationToken in-process — NEVER
 * self-fetches its own API (Mistake Log 2026-05-17).
 *
 * Reachable via the MoMo return URL with no prior bookingStore state, so
 * /booking/layout.tsx whitelists this prefix to bypass its tripId guard.
 *
 * Auto-refresh uses <meta httpEquiv="refresh"> rendered inline in the tree
 * (Next.js does not support meta http-equiv via generateMetadata).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { getBookingByConfirmationToken } from '@/lib/booking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

// Private, per-booking payment-result page reachable only via the token link.
export const metadata: Metadata = {
  title: 'Kết quả thanh toán | BBVN',
  robots: { index: false, follow: false },
};

interface ResultPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}

const MAX_AUTO_REFRESH = 24; // ~2 min at 5s interval

const GATEWAY_LABEL: Record<string, string> = {
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  card: 'thẻ',
};

function formatVND(amount: number): string {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + 'đ'
  );
}

export default async function ResultPage({ params, searchParams }: ResultPageProps) {
  const { token } = await params;

  const booking = await getBookingByConfirmationToken(token);
  if (!booking) {
    notFound();
  }

  const sp = await searchParams;
  const refreshCount = Math.min(parseInt(sp.r ?? '0', 10) || 0, MAX_AUTO_REFRESH);

  const isPending = booking.status === 'awaiting_payment';
  const isPaid = booking.status === 'paid' || booking.status === 'completed';
  const isFailed = booking.status === 'payment_failed_expired';
  const gatewayLabel = GATEWAY_LABEL[booking.paymentMethod] ?? 'trực tuyến';

  const nextRefreshCount = refreshCount + 1;
  const shouldAutoRefresh = isPending && refreshCount < MAX_AUTO_REFRESH;
  const refreshUrl = `/booking/result/${token}?r=${nextRefreshCount}`;

  return (
    <>
      {shouldAutoRefresh && <meta httpEquiv="refresh" content={`5;url=${refreshUrl}`} />}
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <span
            className={
              isPaid
                ? 'flex size-14 items-center justify-center rounded-full bg-success text-success-foreground'
                : isFailed
                  ? 'flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive'
                  : 'flex size-14 items-center justify-center rounded-full bg-warning text-warning-foreground'
            }
          >
            {isPaid ? (
              <CheckCircle2 className="size-8" aria-hidden="true" />
            ) : isFailed ? (
              <XCircle className="size-8" aria-hidden="true" />
            ) : (
              <Loader2 className="size-8 motion-safe:animate-spin" aria-hidden="true" />
            )}
          </span>
          <h1 className="text-2xl font-bold">
            {isPaid
              ? 'Thanh toán thành công'
              : isPending
                ? 'Đang xử lý thanh toán'
                : isFailed
                  ? 'Thanh toán thất bại'
                  : 'Kết quả đặt vé'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Mã đặt chỗ: <span className="font-mono font-semibold text-foreground">{booking.bookingRef}</span>
          </p>
        </header>

        {/* Awaiting payment — polling banner */}
        {isPending && (
          <div className="flex flex-col gap-2 rounded-xl border border-warning-border bg-warning p-4">
            <h2 className="text-base font-semibold text-warning-foreground">
              Đang chờ xác nhận thanh toán {gatewayLabel}
            </h2>
            <p className="text-sm text-warning-foreground">
              Vui lòng hoàn tất thanh toán {gatewayLabel}. Trang này tự động cập nhật sau 5 giây.
            </p>
            {refreshCount >= MAX_AUTO_REFRESH && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-warning-foreground">
                  Trang đã dừng tự động làm mới.{' '}
                  <a href={`/booking/result/${token}`} className="underline">
                    Tải lại trang
                  </a>{' '}
                  để kiểm tra trạng thái.
                </p>
                <Link
                  href="/lien-he-dat-xe"
                  className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' self-start'}
                >
                  Liên hệ hỗ trợ
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Paid / success */}
        {isPaid && (
          <div className="flex flex-col gap-3 rounded-xl border border-success-border bg-success p-4">
            <p className="text-sm text-success-foreground">
              Cảm ơn bạn đã đặt vé qua BBVN. Vui lòng xem thông tin xác nhận để biết chi tiết chuyến đi.
            </p>
            <Link
              href={`/booking/confirmation/${token}`}
              className={buttonVariants({ variant: 'default', size: 'default' }) + ' self-start'}
            >
              Xem thông tin đặt vé
            </Link>
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Giao dịch {gatewayLabel} của bạn chưa hoàn tất hoặc đã bị hủy. Vui lòng thử lại với chuyến xe khác.
            </p>
            <Link href="/search" className={buttonVariants({ variant: 'default', size: 'default' }) + ' self-start'}>
              Tìm chuyến khác
            </Link>
          </div>
        )}

        {/* Generic fallback for unexpected statuses */}
        {!isPending && !isPaid && !isFailed && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Đặt vé của bạn đang được xử lý. Vui lòng liên hệ hỗ trợ nếu cần trợ giúp.
            </p>
            <Link
              href="/lien-he-dat-xe"
              className={buttonVariants({ variant: 'outline', size: 'default' }) + ' self-start'}
            >
              Liên hệ hỗ trợ
            </Link>
          </div>
        )}

        {/* Booking summary */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Thông tin đặt vé</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tuyến</dt>
                <dd className="text-right">
                  {booking.trip.route.origin} → {booking.trip.route.destination}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Số vé</dt>
                <dd>{booking.ticketCount}</dd>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-lg font-semibold">
                <dt>Tổng cộng</dt>
                <dd className="font-mono text-primary">{formatVND(booking.totalVnd)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
