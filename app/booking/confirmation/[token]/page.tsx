/**
 * /booking/confirmation/[token] — Booking confirmation page.
 *
 * No auth — the confirmationToken in the URL is itself the access key
 * (192-bit random, base64url, unique-indexed at the DB layer). Anyone
 * with the link can view the booking. Customers reach this page via:
 *   - immediate router.push after a successful POST /api/bookings/initiate
 *   - the link inside the bookingPendingCash SMS
 *   - "My bookings" history (future, Issue 009)
 *
 * Server component: calls getBookingByConfirmationToken in-process — NEVER
 * self-fetches its own API (Mistake Log 2026-05-17). Returns notFound() if
 * the token does not match any booking row.
 */

import { notFound } from 'next/navigation';
import { getBookingByConfirmationToken } from '@/lib/db/bookingRepo';

interface ConfirmationPageProps {
  params: Promise<{ token: string }>;
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

function formatDeparture(d: Date): string {
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Chờ thanh toán',
  pending_cash_payment: 'Chờ thanh toán tiền mặt',
  paid_operator_notified: 'Đã thanh toán',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  trip_cancelled: 'Chuyến đã hủy',
  no_show: 'Không có mặt',
  payment_failed_expired: 'Thanh toán thất bại',
};

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { token } = await params;

  const booking = await getBookingByConfirmationToken(token);
  if (!booking) {
    notFound();
  }

  const { trip } = booking;
  const isCashPending = booking.status === 'pending_cash_payment';

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Đặt vé thành công</h1>
        <p className="text-sm text-gray-600">
          Mã đặt chỗ: <span className="font-mono font-semibold">{booking.bookingRef}</span>
        </p>
        <p className="text-sm">
          Trạng thái:{' '}
          <span className="font-semibold text-amber-700">
            {STATUS_LABEL[booking.status] ?? booking.status}
          </span>
        </p>
      </header>

      <section className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Chi tiết chuyến đi</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Tuyến</dt>
            <dd className="text-right">
              {trip.route.origin} → {trip.route.destination}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Khởi hành</dt>
            <dd className="text-right">{formatDeparture(trip.departureAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Xe</dt>
            <dd className="text-right font-mono">{trip.bus.licensePlate}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Nhà xe</dt>
            <dd className="text-right">{trip.bus.operator.legalName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-600">Hotline nhà xe</dt>
            <dd className="text-right font-mono">{trip.bus.operator.contactPhone}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Thông tin đặt vé</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Hành khách</dt>
            <dd>{booking.buyerName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Số điện thoại</dt>
            <dd className="font-mono">{booking.buyerPhone}</dd>
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

      {isCashPending && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <h2 className="text-base font-semibold text-amber-900">
            Thanh toán tiền mặt khi lên xe
          </h2>
          <p className="text-sm text-amber-900">
            Vui lòng thanh toán trực tiếp cho nhà xe khi lên xe. Hãy đến điểm đón
            trước giờ khởi hành ít nhất 15 phút. Tin nhắn xác nhận đã được gửi tới
            số điện thoại của bạn.
          </p>
        </section>
      )}
    </main>
  );
}
