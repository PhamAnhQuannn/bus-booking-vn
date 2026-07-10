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
import { getBookingByRef } from '@/lib/booking';
import { getEnv } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const qrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(bookingRef)}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Thanh toán chuyển khoản</h1>
        <p className="text-sm text-muted-foreground">
          Quét mã QR hoặc chuyển khoản thủ công theo thông tin bên dưới
        </p>
      </header>

      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt={`Mã QR thanh toán ${bookingRef}`}
          width={300}
          height={300}
          className="rounded-lg border border-border"
        />
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
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Số tài khoản</dt>
              <dd className="font-mono font-medium">{accountNumber}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Chủ tài khoản</dt>
              <dd className="text-right font-medium">{accountName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Nội dung CK</dt>
              <dd className="font-mono font-semibold text-primary">{bookingRef}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-lg font-semibold">
              <dt>Số tiền</dt>
              <dd className="font-mono text-primary">{formatVND(amount)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <BankTransferClient
        bookingRef={bookingRef}
        confirmationToken={booking.confirmationToken}
        redirectUrl={redirectUrl}
      />
    </main>
  );
}
