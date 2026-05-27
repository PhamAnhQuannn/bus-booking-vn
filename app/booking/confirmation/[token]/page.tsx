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
import { CheckCircle2, Phone, Clock, Bus, MapPin, Wallet, CalendarPlus } from 'lucide-react';
import { getBookingByConfirmationToken } from '@/lib/db/bookingRepo';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

/** UTC timestamp in iCalendar basic format (YYYYMMDDTHHMMSSZ). */
function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Build a downloadable .ics data URI for the trip departure (2h default block). */
function buildCalendarHref(opts: { ref: string; origin: string; destination: string; departure: Date }): string {
  const end = new Date(opts.departure.getTime() + 2 * 3600 * 1000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BBVN//Booking//VI',
    'BEGIN:VEVENT',
    `UID:${opts.ref}@bbvn`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(opts.departure)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:Chuyến xe ${opts.origin} → ${opts.destination}`,
    `DESCRIPTION:Mã đặt vé ${opts.ref}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
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

const STATUS_VARIANT: Record<string, 'success' | 'pending' | 'danger' | 'neutral'> = {
  awaiting_payment: 'pending',
  pending_cash_payment: 'pending',
  paid_operator_notified: 'success',
  completed: 'success',
  cancelled: 'neutral',
  trip_cancelled: 'danger',
  no_show: 'danger',
  payment_failed_expired: 'danger',
};

function Row({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { token } = await params;

  const booking = await getBookingByConfirmationToken(token);
  if (!booking) {
    notFound();
  }

  const { trip } = booking;
  const isCashPending = booking.status === 'pending_cash_payment';

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      {/* Success header */}
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold">Đặt vé thành công</h1>
        <Badge variant={STATUS_VARIANT[booking.status] ?? 'neutral'}>
          {STATUS_LABEL[booking.status] ?? booking.status}
        </Badge>
      </header>

      {/* Prominent e-ticket ref */}
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-center">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Mã đặt vé</span>
        <span className="font-mono text-2xl font-bold tracking-widest text-primary">{booking.bookingRef}</span>
        <a
          href={buildCalendarHref({
            ref: booking.bookingRef,
            origin: trip.route.origin,
            destination: trip.route.destination,
            departure: trip.departureAt,
          })}
          download={`chuyen-xe-${booking.bookingRef}.ics`}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-2' })}
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          Thêm vào lịch
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Chi tiết chuyến đi</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2.5">
            <Row icon={MapPin} label="Tuyến">
              {trip.route.origin} → {trip.route.destination}
            </Row>
            <Row icon={Clock} label="Khởi hành">{formatDeparture(trip.departureAt)}</Row>
            <Row icon={Bus} label="Xe"><span className="font-mono">{trip.bus.licensePlate}</span></Row>
            <Row icon={Bus} label="Nhà xe">{trip.bus.operator.legalName}</Row>
            <Row icon={Phone} label="Hotline nhà xe">
              <a href={`tel:${trip.bus.operator.contactPhone}`} className="font-mono text-primary hover:underline">
                {trip.bus.operator.contactPhone}
              </a>
            </Row>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Thông tin đặt vé</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hành khách</dt>
              <dd>{booking.buyerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số điện thoại</dt>
              <dd className="font-mono">{booking.buyerPhone}</dd>
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

      {isCashPending && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning-border bg-warning p-4">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-warning-foreground">
            <Wallet className="size-4" aria-hidden="true" />
            Thanh toán tiền mặt khi lên xe
          </h2>
          <p className="text-sm text-warning-foreground">
            Vui lòng thanh toán trực tiếp cho nhà xe khi lên xe. Hãy đến điểm đón trước giờ khởi
            hành ít nhất 15 phút. Tin nhắn xác nhận đã được gửi tới số điện thoại của bạn.
          </p>
        </div>
      )}
    </main>
  );
}
