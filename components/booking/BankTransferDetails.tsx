/**
 * BankTransferDetails — the "Thông tin chuyển khoản" panel: bank/account/holder +
 * transfer memo (bookingRef) + amount, with the VietQR image beside it.
 *
 * Shared by the standalone /booking/bank-transfer page and the merged checkout
 * page's inline payment reveal so both render identical markup from one source.
 * The memo (Nội dung CK) is the bookingRef — a hand-transcription typo breaks
 * SePay reconciliation, so every copyable field carries a CopyButton (audit F4).
 *
 * Presentational + client-safe (QrImage / CopyButton are client components); no
 * 'use client' directive so a server component can render it too.
 */

import { useTranslations } from 'next-intl';
import { QrImage } from '@/app/[locale]/(customer)/booking/bank-transfer/QrImage';
import { CopyButton } from '@/app/[locale]/(customer)/booking/bank-transfer/CopyButton';

function formatVND(amount: number): string {
  return (
    new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + 'đ'
  );
}

export interface BankTransferDetailsProps {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bookingRef: string;
  amount: number;
  qrUrl: string;
}

export function BankTransferDetails({
  bankName,
  accountNumber,
  accountName,
  bookingRef,
  amount,
  qrUrl,
}: BankTransferDetailsProps) {
  const t = useTranslations('booking');
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-start sm:justify-between">
      <dl className="flex flex-1 flex-col gap-3 text-sm">
        <p className="text-sm font-semibold text-primary">{t('bankTransfer.title')}</p>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t('bankTransfer.bank')}</dt>
          <dd className="text-right font-medium">{bankName}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t('bankTransfer.accountNumber')}</dt>
          <dd className="flex items-center gap-1 font-mono font-medium">
            {accountNumber}
            <CopyButton value={accountNumber} label={t('bankTransfer.copyAccountNumber')} />
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{t('bankTransfer.accountName')}</dt>
          <dd className="text-right font-medium">{accountName}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t('bankTransfer.memo')}</dt>
          <dd className="flex items-center gap-1 font-mono font-semibold text-primary">
            {bookingRef}
            <CopyButton value={bookingRef} label={t('bankTransfer.copyMemo')} showLabel />
          </dd>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-primary/20 pt-3 text-base font-semibold">
          <dt>{t('bankTransfer.amount')}</dt>
          <dd className="flex items-center gap-1 font-mono text-primary">
            {formatVND(amount)}
            <CopyButton value={String(amount)} label={t('bankTransfer.copyAmount')} />
          </dd>
        </div>
      </dl>

      <div className="flex shrink-0 flex-col items-center gap-1.5 self-center sm:self-start">
        <QrImage src={qrUrl} alt={t('bankTransfer.qrAlt', { ref: bookingRef })} />
        <span className="text-xs text-muted-foreground">{t('bankTransfer.scanToPay')}</span>
      </div>
    </div>
  );
}
