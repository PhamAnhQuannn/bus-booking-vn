/**
 * /booking/result/[token] — MoMo payment result / polling page.
 *
 * Status-based rendering:
 *   awaiting_payment      → "Đang chờ thanh toán" + auto-refresh every 5s
 *                           (capped at 24 refreshes ≈ 2 min via ?r= counter)
 *   paid_operator_notified → Success banner + link to /booking/confirmation/[token]
 *   payment_failed_expired → Failure banner + retry CTA to /search
 *   other statuses         → Fallback (e.g. booking cancelled)
 *
 * Server component: calls getBookingByConfirmationToken in-process — NEVER
 * self-fetches its own API (Mistake Log 2026-05-17).
 *
 * Auto-refresh uses <meta httpEquiv="refresh"> rendered directly in the page
 * (Next.js docs state meta http-equiv is not supported via generateMetadata —
 * render the tag inline in the component tree instead).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBookingByConfirmationToken } from '@/lib/db/bookingRepo';

interface ResultPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}

const MAX_AUTO_REFRESH = 24; // ~2 min at 5s interval

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
  const sp = await searchParams;
  const refreshCount = Math.min(parseInt(sp.r ?? '0', 10) || 0, MAX_AUTO_REFRESH);

  const booking = await getBookingByConfirmationToken(token);
  if (!booking) {
    notFound();
  }

  const isPending = booking.status === 'awaiting_payment';
  const isPaid = booking.status === 'paid_operator_notified' || booking.status === 'completed';
  const isFailed = booking.status === 'payment_failed_expired';

  // Auto-refresh URL increments counter until cap
  const nextRefreshCount = refreshCount + 1;
  const shouldAutoRefresh = isPending && refreshCount < MAX_AUTO_REFRESH;
  const refreshUrl = `/booking/result/${token}?r=${nextRefreshCount}`;

  return (
    <>
      {shouldAutoRefresh && (
        // Render meta refresh inline — not supported via generateMetadata API
        <meta httpEquiv="refresh" content={`5;url=${refreshUrl}`} />
      )}

      <main className="max-w-md mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">
            {isPaid
              ? 'Thanh toán thành công'
              : isPending
                ? 'Đang xử lý thanh toán'
                : isFailed
                  ? 'Thanh toán thất bại'
                  : 'Kết quả đặt vé'}
          </h1>
          <p className="text-sm text-gray-600">
            Mã đặt chỗ: <span className="font-mono font-semibold">{booking.bookingRef}</span>
          </p>
        </header>

        {/* Awaiting payment — polling banner */}
        {isPending && (
          <section className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <h2 className="text-base font-semibold text-amber-900">
              Đang chờ xác nhận thanh toán MoMo
            </h2>
            <p className="text-sm text-amber-800">
              Vui lòng hoàn tất thanh toán trong ứng dụng MoMo. Trang này tự động
              cập nhật sau 5 giây.
            </p>
            {refreshCount >= MAX_AUTO_REFRESH && (
              <p className="text-sm text-amber-700 font-medium">
                Trang đã dừng tự động làm mới.{' '}
                <a href={`/booking/result/${token}`} className="underline">
                  Tải lại trang
                </a>{' '}
                để kiểm tra trạng thái.
              </p>
            )}
          </section>
        )}

        {/* Paid / success */}
        {isPaid && (
          <section className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
            <h2 className="text-base font-semibold text-green-900">
              Đặt vé và thanh toán thành công!
            </h2>
            <p className="text-sm text-green-800">
              Cảm ơn bạn đã đặt vé qua BusBookVN. Vui lòng xem thông tin xác nhận để
              biết chi tiết chuyến đi.
            </p>
            <Link
              href={`/booking/confirmation/${token}`}
              className="inline-block bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-green-800"
            >
              Xem thông tin đặt vé
            </Link>
          </section>
        )}

        {/* Failed */}
        {isFailed && (
          <section className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <h2 className="text-base font-semibold text-red-900">
              Thanh toán không thành công
            </h2>
            <p className="text-sm text-red-800">
              Giao dịch MoMo của bạn chưa hoàn tất hoặc đã bị hủy. Vui lòng thử lại
              với chuyến xe khác.
            </p>
            <Link
              href="/search"
              className="inline-block bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-red-800"
            >
              Tìm chuyến khác
            </Link>
          </section>
        )}

        {/* Generic fallback for unexpected statuses */}
        {!isPending && !isPaid && !isFailed && (
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              Đặt vé của bạn đang được xử lý. Vui lòng liên hệ hỗ trợ nếu cần trợ giúp.
            </p>
          </section>
        )}

        {/* Booking summary */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="text-lg font-semibold">Thông tin đặt vé</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Tuyến</dt>
              <dd className="text-right">
                {booking.trip.route.origin} → {booking.trip.route.destination}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Số vé</dt>
              <dd>{booking.ticketCount}</dd>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <dt>Tổng cộng</dt>
              <dd className="text-blue-700">{formatVND(booking.totalVnd)}</dd>
            </div>
          </dl>
        </section>
      </main>
    </>
  );
}
