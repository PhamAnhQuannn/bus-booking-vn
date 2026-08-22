/**
 * /booking/bank-transfer — VietQR code display + payment status polling.
 *
 * Reached after initiateOnlineBooking with method='bank_transfer'. URL params
 * carry the bank details and booking ref needed to render the QR code and poll
 * for payment confirmation.
 *
 * Server component renders the static layout; BankTransferPoller (client)
 * handles the auto-refresh polling via meta refresh (same pattern as
 * /booking/result/[token]).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getBookingByRef, getBookingByConfirmationToken } from '@/lib/booking';
import { PSP_WINDOW_MINUTES } from '@/lib/core/db/pspWindow';
import { getEnv } from '@/lib/config';
import { BookingSummaryRail } from '@/components/booking/BookingSummaryRail';
import { BankTransferDetails } from '@/components/booking/BankTransferDetails';
import { BankTransferClient } from './BankTransferClient';

export const metadata: Metadata = {
  title: 'Thanh toán chuyển khoản | BBVN',
  robots: { index: false, follow: false },
};

interface BankTransferPageProps {
  searchParams: Promise<{
    bookingRef?: string;
    amount?: string;
    redirectUrl?: string;
  }>;
}

// Payment window = the true capacity-protection / expiry bound (PSP_WINDOW_MINUTES,
// lib/core/db/holdRepo). Imported (lib/core is barrel-exempt) instead of a hand-synced
// literal so the customer countdown can never drift from when the booking actually dies.
const PAYMENT_WINDOW_MINUTES = PSP_WINDOW_MINUTES;

export default async function BankTransferPage({ searchParams }: BankTransferPageProps) {
  const sp = await searchParams;
  const { bookingRef, amount: amountStr, redirectUrl } = sp;

  const env = getEnv();
  const bankBin = env.VIETQR_BANK_BIN;
  const accountNumber = env.VIETQR_ACCOUNT_NUMBER;
  const accountName = env.VIETQR_ACCOUNT_NAME;
  const bankName = env.VIETQR_BANK_NAME;
  const template = env.VIETQR_TEMPLATE;

  if (!bookingRef || !amountStr) {
    notFound();
  }

  if (redirectUrl && (!redirectUrl.startsWith('/') || redirectUrl.startsWith('//'))) {
    notFound();
  }

  const amount = parseInt(amountStr, 10);
  if (!amount || amount <= 0) {
    notFound();
  }

  const booking = await getBookingByRef(bookingRef);
  if (!booking) {
    notFound();
  }

  // Full trip/route context for the order-summary rail (audit F4) — the same
  // select the review step and result page already use, one extra in-process
  // lookup keyed on the token we just resolved (never a self-fetch).
  const fullBooking = await getBookingByConfirmationToken(booking.confirmationToken);

  const qrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(bookingRef)}`;

  // Transfer deadline = booking creation + payment window. Derived from booking data
  // (not Date.now()) so the RSC render stays pure.
  const deadlineIso = fullBooking
    ? new Date(fullBooking.createdAt.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString()
    : undefined;

  const t = await getTranslations('booking');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:grid md:grid-cols-[1fr_20rem] md:items-start">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">{t('page.paymentTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('page.paymentSubtitle')}
          </p>
        </header>

        <BankTransferDetails
          bankName={bankName}
          accountNumber={accountNumber}
          accountName={accountName}
          bookingRef={bookingRef}
          amount={amount}
          qrUrl={qrUrl}
        />

        <BankTransferClient
          bookingRef={bookingRef}
          confirmationToken={booking.confirmationToken}
          redirectUrl={redirectUrl}
          deadlineIso={deadlineIso}
          windowMinutes={PAYMENT_WINDOW_MINUTES}
        />

        <p className="text-center text-sm text-muted-foreground">
          {t('page.notUpdated')}{' '}
          <Link href="/lien-he-dat-xe" className="font-medium text-primary underline">
            {t('page.contactSupport')}
          </Link>
        </p>
      </div>

      {fullBooking && (
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
      )}
    </main>
  );
}
