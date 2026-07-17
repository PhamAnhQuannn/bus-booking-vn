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
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBookingByRef, getBookingByConfirmationToken } from '@/lib/booking';
import { getEnv } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingSummaryRail } from '@/components/booking/BookingSummaryRail';
import { BankTransferClient } from './BankTransferClient';
import { CopyButton } from './CopyButton';
import { QrImage } from './QrImage';
import { PaymentDeadline } from './PaymentDeadline';

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

// Payment window a bank-transfer booking stays payable before the reconciliation
// sweeper resolves it (lib/jobs/reconcilePayments.ts RECONCILE_THRESHOLD_MINUTES).
// Kept as a display-only mirror here — not imported cross-domain, keep in sync
// if the sweeper threshold changes.
const PAYMENT_WINDOW_MINUTES = 30;

function formatVND(amount: number): string {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + 'đ'
  );
}

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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:grid md:grid-cols-[1fr_20rem] md:items-start">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Thanh toán chuyển khoản</h1>
          <p className="text-sm text-muted-foreground">
            Quét mã QR hoặc chuyển khoản thủ công theo thông tin bên dưới
          </p>
          {fullBooking && (
            <PaymentDeadline
              deadlineIso={new Date(fullBooking.createdAt.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString()}
            />
          )}
        </header>

        <div className="flex flex-col items-center gap-4">
          <QrImage src={qrUrl} alt={`Mã QR thanh toán ${bookingRef}`} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Thông tin chuyển khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Ngân hàng</dt>
                <dd className="text-right font-medium">{bankName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Số tài khoản</dt>
                <dd className="flex items-center gap-1 font-mono font-medium">
                  {accountNumber}
                  <CopyButton value={accountNumber} label="số tài khoản" />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Chủ tài khoản</dt>
                <dd className="text-right font-medium">{accountName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Nội dung CK</dt>
                <dd className="flex items-center gap-1 font-mono font-semibold text-primary">
                  {bookingRef}
                  <CopyButton value={bookingRef} label="nội dung chuyển khoản" showLabel />
                </dd>
              </div>
              <div className="mt-1 flex items-center justify-between gap-4 border-t border-border pt-3 text-lg font-semibold">
                <dt>Số tiền</dt>
                <dd className="flex items-center gap-1 font-mono text-primary">
                  {formatVND(amount)}
                  <CopyButton value={String(amount)} label="số tiền" />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <BankTransferClient
          bookingRef={bookingRef}
          confirmationToken={booking.confirmationToken}
          redirectUrl={redirectUrl}
        />

        <p className="text-center text-sm text-muted-foreground">
          Đã chuyển khoản mà chưa thấy cập nhật?{' '}
          <Link href="/lien-he-dat-xe" className="font-medium text-primary underline">
            Liên hệ hỗ trợ
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
