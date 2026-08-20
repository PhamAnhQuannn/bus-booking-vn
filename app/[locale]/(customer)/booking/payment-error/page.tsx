/**
 * /booking/payment-error?ref=<bookingRef>&reason=<reason> — VNPay error return
 * destination (invalid signature, zero-amount tamper, or a hard failure).
 *
 * Browser-UX only; the IPN webhook is authoritative for the booking state. This
 * page surfaces a friendly message and a path back to retry / contact support.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Thanh toán thất bại | BBVN',
  robots: { index: false, follow: false },
};

const REASON_KEY: Record<string, string> = {
  sig_invalid: 'paymentStatus.reasonSigInvalid',
  invalid_amount: 'paymentStatus.reasonInvalidAmount',
};

interface ErrorPageProps {
  searchParams: Promise<{ ref?: string; reason?: string }>;
}

export default async function VnpayErrorPage({ searchParams }: ErrorPageProps) {
  const { ref, reason } = await searchParams;
  const t = await getTranslations('booking');
  const detail = reason && REASON_KEY[reason] ? t(REASON_KEY[reason]) : t('paymentStatus.reasonGeneric');

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('paymentStatus.errorTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">{detail}</p>
          {ref && (
            <p>
              {t('page.bookingRef')} <span className="font-mono font-medium">{ref}</span>
            </p>
          )}
          <p className="text-muted-foreground">
            {t('paymentStatus.refundNote')}
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('paymentStatus.bookAgain')}
            </Link>
            <Link
              href="/lien-he-dat-xe"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary/30"
            >
              {t('page.contactSupport')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
