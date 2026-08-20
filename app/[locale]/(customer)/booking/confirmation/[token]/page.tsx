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

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CheckCircle2, CalendarPlus } from 'lucide-react';
import { getBookingByConfirmationToken } from '@/lib/booking';
import { mintTicketToken, ticketQrDataUrl } from '@/lib/ticketing';
import { bookingStatusDisplay } from '@/lib/op/statusLabels';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookingSummaryRail } from '@/components/booking/BookingSummaryRail';

// Private, per-booking page reachable only via the token link — never indexed.
export const metadata: Metadata = {
  title: 'Xác nhận đặt vé | BBVN',
  robots: { index: false, follow: false },
};

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

/** UTC timestamp in iCalendar basic format (YYYYMMDDTHHMMSSZ). */
function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Build a downloadable .ics data URI for the trip departure (2h default block).
 *  `summary`/`description` are pre-localized by the caller. */
function buildCalendarHref(opts: { ref: string; departure: Date; summary: string; description: string }): string {
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
    `SUMMARY:${opts.summary}`,
    `DESCRIPTION:${opts.description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { token } = await params;

  const booking = await getBookingByConfirmationToken(token);
  if (!booking) {
    notFound();
  }

  const { trip } = booking;

  const unitPrice = trip.price;
  const t = await getTranslations('booking');

  // Receipt QR shown DIRECTLY on the page (right after payment): scanning it opens the
  // public /verify receipt. Rendered as an inline SVG data-URI — web isn't subject to
  // the mail-client image stripping the email path works around, so no hosted PNG
  // needed. Absolute origin from the request headers so the QR is scannable on
  // whatever host served the page (devtunnel / prod).
  const receiptToken = await mintTicketToken({
    bookingRef: booking.bookingRef,
    confirmationToken: token,
  });
  const hdrs = await headers();
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  const host = hdrs.get('host') ?? '';
  const receiptQrDataUrl = host
    ? ticketQrDataUrl(`${proto}://${host}/verify/${receiptToken}`, { size: 200 })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col-reverse gap-6 px-4 py-8 md:grid md:grid-cols-[1fr_20rem] md:items-start">
      <div className="flex flex-col gap-6">
        {/* Success header */}
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success text-success-foreground">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold">{t('confirm.success')}</h1>
          <Badge variant={bookingStatusDisplay(booking.status).variant}>
            {bookingStatusDisplay(booking.status).label}
          </Badge>
        </header>

        {/* Prominent e-ticket ref */}
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-center">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('confirm.bookingRefLabel')}</span>
          <span className="font-mono text-2xl font-bold tracking-widest text-primary">{booking.bookingRef}</span>
          <a
            href={buildCalendarHref({
              ref: booking.bookingRef,
              departure: trip.departureAt,
              summary: t('confirm.icsSummary', { origin: trip.route.origin, destination: trip.route.destination }),
              description: t('confirm.icsDesc', { ref: booking.bookingRef }),
            })}
            download={`chuyen-xe-${booking.bookingRef}.ics`}
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-2' })}
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            {t('confirm.addToCalendar')}
          </a>
        </div>

        <Card>
          <CardHeader>
            <CardTitle as="h2">{t('confirm.bookingInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('confirm.passenger')}</dt>
                <dd>{booking.buyerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('checkout.phone')}</dt>
                <dd className="font-mono">{booking.buyerPhone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('confirm.ticketCount')}</dt>
                <dd>{booking.ticketCount}</dd>
              </div>
              {booking.boardingPoint ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t('checkout.pickup')}</dt>
                  <dd className="text-right">
                    {booking.boardingPoint}
                    {booking.boardingTime ? ` · ${booking.boardingTime}` : ''}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('confirm.licensePlate')}</dt>
                <dd className="font-mono">{trip.bus.licensePlate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('confirm.operatorHotline')}</dt>
                <dd>
                  <a href={`tel:${trip.bus.operator.contactPhone}`} className="font-mono text-primary hover:underline">
                    {trip.bus.operator.contactPhone}
                  </a>
                </dd>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-lg font-semibold">
                <dt>{t('summary.total')}</dt>
                <dd className="font-mono text-primary">{formatVND(booking.totalVnd)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Receipt QR — scannable proof of payment, shown directly on-screen. */}
        {receiptQrDataUrl ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data-URI, not an optimizable asset */}
            <img
              src={receiptQrDataUrl}
              alt={t('confirm.receiptQrAlt')}
              width={180}
              height={180}
              className="size-44"
            />
            <p className="text-center text-sm text-muted-foreground">
              {t('confirm.scanReceipt')}
            </p>
          </div>
        ) : null}

        {/* Issue 112: pickup is locked at hold; no self-serve edit. Point travelers to the operator. */}
        <p className="text-center text-sm text-muted-foreground" data-testid="pickup-edit-hint">
          {t('confirm.changePickup')}
          {trip.bus.operator.contactPhone ? (
            <>
              {': '}
              <a
                href={`tel:${trip.bus.operator.contactPhone}`}
                className="font-medium text-primary hover:underline"
              >
                {trip.bus.operator.contactPhone}
              </a>
            </>
          ) : (
            '.'
          )}
        </p>

        {/* Forward CTAs — no post-payment dead-end. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/" className={buttonVariants({ variant: 'default', className: 'flex-1' })}>
            {t('paymentStatus.goHome')}
          </Link>
          <Link href="/" className={buttonVariants({ variant: 'outline', className: 'flex-1' })}>
            {t('transfer.findOther')}
          </Link>
        </div>
      </div>

      <BookingSummaryRail
        showHoldTimer={false}
        summary={{
          routeOrigin: trip.route.origin,
          routeDestination: trip.route.destination,
          departureAt: trip.departureAt.toISOString(),
          operatorLegalName: trip.bus.operator.legalName,
          ticketCount: booking.ticketCount,
          unitPriceVND: unitPrice,
          totalVND: booking.totalVnd,
        }}
      />
    </main>
  );
}
