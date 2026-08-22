/**
 * /booking/customer — merged "Xác nhận thông tin & thanh toán" step.
 *
 * Two render modes:
 *  - Form mode (?tripId=...): passenger info + trip info + payment method + consent,
 *    all on one page (CheckoutClient). Fetches trip facts via getTripDetails.
 *  - Payment mode (?bookingRef=...): reached after CheckoutClient runs initiate and
 *    swaps the URL to ?bookingRef (refresh-durable). Re-hydrates the VietQR transfer
 *    details + status polling from getBookingByRef — mirrors the standalone
 *    /booking/bank-transfer page.
 */

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getTripDetails } from '@/lib/trips';
import { getBookingByRef, getBookingByConfirmationToken } from '@/lib/booking';
import { getEnv } from '@/lib/config';
import { PSP_WINDOW_MINUTES } from '@/lib/core/db/pspWindow';
import { BookingSteps } from '@/components/booking/BookingSteps';
import { BookingSummaryRail } from '@/components/booking/BookingSummaryRail';
import { CheckoutTrustBadges } from '@/components/booking/CheckoutTrustBadges';
import { BankTransferDetails } from '@/components/booking/BankTransferDetails';
import { CheckoutClient } from './CheckoutClient';
import { BankTransferClient } from '../bank-transfer/BankTransferClient';

export const metadata: Metadata = {
  title: 'Xác nhận & thanh toán | BBVN',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    tripId?: string;
    ticketCount?: string;
    boardingPoint?: string;
    boardingTime?: string;
    bookingRef?: string;
    redirectUrl?: string;
  }>;
}

export default async function CheckoutPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // Payment mode — after initiate (refresh-durable ?bookingRef landing).
  if (sp.bookingRef) {
    return <PaymentModeView bookingRef={sp.bookingRef} redirectUrl={sp.redirectUrl} />;
  }

  // Form mode.
  const tripId = sp.tripId;
  const ticketCount = Math.max(1, Number(sp.ticketCount) || 1);
  // Guard redirects go to the customer home. next/navigation redirect() returns `never`
  // (narrows tripId/trip below); an error-path drop to the vi home is acceptable.
  if (!tripId) redirect('/');

  const trip = await getTripDetails(tripId);
  if (!trip) redirect('/');

  const [tb, ts] = await Promise.all([getTranslations('booking'), getTranslations('search')]);
  const boardingPoint = sp.boardingPoint ?? null;
  const boardingTime = sp.boardingTime ?? null;
  const total = trip.price * ticketCount;
  const env = getEnv();
  const vehicleLabel = `${ts(`busType.${trip.busType}`)} ${trip.capacity} ${tb('page.seats')}`;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <BookingSteps current={2} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{tb('page.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {tb('page.subtitle')}
        </p>
      </div>

      <div className="flex flex-col-reverse gap-6 md:grid md:grid-cols-[1fr_20rem] md:items-start">
        <CheckoutClient
          tripId={tripId}
          ticketCount={ticketCount}
          boardingPoint={boardingPoint}
          boardingTime={boardingTime}
          trip={{
            routeOrigin: trip.routeOrigin,
            routeDestination: trip.routeDestination,
            departureAt: trip.departureAt,
            operatorLegalName: trip.operatorLegalName,
            vehicleLabel,
          }}
          pspWindowMinutes={PSP_WINDOW_MINUTES}
          vietqr={{
            bankBin: env.VIETQR_BANK_BIN,
            accountNumber: env.VIETQR_ACCOUNT_NUMBER,
            accountName: env.VIETQR_ACCOUNT_NAME,
            bankName: env.VIETQR_BANK_NAME,
            template: env.VIETQR_TEMPLATE,
          }}
        />

        <aside className="flex flex-col gap-5 md:sticky md:top-20">
          <BookingSummaryRail
            showHoldTimer={false}
            summary={{
              routeOrigin: trip.routeOrigin,
              routeDestination: trip.routeDestination,
              departureAt: trip.departureAt,
              operatorLegalName: trip.operatorLegalName,
              ticketCount,
              unitPriceVND: trip.price,
              totalVND: total,
            }}
          />
          <div className="rounded-xl border border-border bg-card p-5 shadow-e1">
            <CheckoutTrustBadges />
          </div>
        </aside>
      </div>
    </main>
  );
}

async function PaymentModeView({
  bookingRef,
  redirectUrl,
}: {
  bookingRef: string;
  redirectUrl?: string;
}) {
  // Reject an absolute / protocol-relative redirect (open-redirect guard — same
  // check the standalone bank-transfer page applies).
  const safeRedirect =
    redirectUrl && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')
      ? redirectUrl
      : undefined;

  const booking = await getBookingByRef(bookingRef);
  if (!booking) notFound();

  const fullBooking = await getBookingByConfirmationToken(booking.confirmationToken);
  if (!fullBooking) notFound();

  const tb = await getTranslations('booking');
  const env = getEnv();
  const amount = fullBooking.totalVnd;
  const qrUrl = `https://img.vietqr.io/image/${env.VIETQR_BANK_BIN}-${env.VIETQR_ACCOUNT_NUMBER}-${env.VIETQR_TEMPLATE}.png?amount=${amount}&addInfo=${encodeURIComponent(bookingRef)}`;
  // Transfer deadline = booking creation + payment window (derived from booking
  // data, not Date.now(), so the RSC render stays pure).
  const deadlineIso = new Date(
    fullBooking.createdAt.getTime() + PSP_WINDOW_MINUTES * 60_000,
  ).toISOString();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:grid md:grid-cols-[1fr_20rem] md:items-start">
      <div className="flex flex-col gap-6">
        <BookingSteps current={2} />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">{tb('page.paymentTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {tb('page.paymentSubtitle')}
          </p>
        </div>

        <BankTransferDetails
          bankName={env.VIETQR_BANK_NAME}
          accountNumber={env.VIETQR_ACCOUNT_NUMBER}
          accountName={env.VIETQR_ACCOUNT_NAME}
          bookingRef={bookingRef}
          amount={amount}
          qrUrl={qrUrl}
        />

        <BankTransferClient
          bookingRef={bookingRef}
          confirmationToken={booking.confirmationToken}
          redirectUrl={safeRedirect}
          deadlineIso={deadlineIso}
          windowMinutes={PSP_WINDOW_MINUTES}
        />

        <p className="text-center text-sm text-muted-foreground">
          {tb('page.notUpdated')}{' '}
          <Link href="/lien-he-dat-xe" className="font-medium text-primary underline">
            {tb('page.contactSupport')}
          </Link>
        </p>
      </div>

      <BookingSummaryRail
        showHoldTimer={false}
        summary={{
          routeOrigin: fullBooking.trip.route.origin,
          routeDestination: fullBooking.trip.route.destination,
          departureAt: fullBooking.trip.departureAt.toISOString(),
          operatorLegalName: fullBooking.trip.bus.operator.legalName,
          ticketCount: fullBooking.ticketCount,
          unitPriceVND: fullBooking.trip.price,
          totalVND: fullBooking.totalVnd,
        }}
      />
    </main>
  );
}
