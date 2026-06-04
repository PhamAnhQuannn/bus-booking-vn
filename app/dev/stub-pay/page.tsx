/**
 * /dev/stub-pay — local fake-gateway pay page (Phase 1, no real PSP).
 *
 * Reachable only when PAYMENTS_STUB is on; 404s otherwise. Stands in for the
 * hosted MoMo/ZaloPay/Card checkout: shows the order summary and two buttons —
 * "Pay success" / "Pay fail" — each submitting the shared submitStubPayment
 * server action, which signs an IPN and runs it through processPaymentWebhook.
 *
 * Carries adapter/orderId/amount/redirectUrl forward via query string (set by
 * the stub adapter's createPayment payUrl).
 */

import { notFound } from 'next/navigation';
import { getEnv } from '@/lib/config';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { submitStubPayment } from './actions';

interface StubPayPageProps {
  searchParams: Promise<{
    adapter?: string;
    orderId?: string;
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

export default async function StubPayPage({ searchParams }: StubPayPageProps) {
  if (!getEnv().PAYMENTS_STUB) {
    notFound();
  }

  const sp = await searchParams;
  const adapter = sp.adapter ?? '';
  const orderId = sp.orderId ?? '';
  const amount = Number(sp.amount ?? 0);
  const redirectUrl = sp.redirectUrl ?? '';

  if (!adapter || !orderId || !redirectUrl) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">Cổng thanh toán thử (DEV)</h1>
        <p className="text-sm text-muted-foreground">
          Fake <span className="font-mono">{adapter}</span> gateway — no real money moves.
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Mã đơn</span>
            <span className="font-mono">{orderId}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-semibold">
            <span>Số tiền</span>
            <span className="font-mono text-primary">{formatVND(amount)}</span>
          </div>
        </CardContent>
      </Card>

      <form className="flex gap-3">
        <input type="hidden" name="adapter" value={adapter} />
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="amount" value={amount} />
        <input type="hidden" name="redirectUrl" value={redirectUrl} />
        <button
          type="submit"
          name="outcome"
          value="success"
          formAction={submitStubPayment}
          className={buttonVariants({ variant: 'default', size: 'lg', className: 'flex-1' })}
        >
          Thanh toán
        </button>
        <button
          type="submit"
          name="outcome"
          value="fail"
          formAction={submitStubPayment}
          className={buttonVariants({ variant: 'destructive', size: 'lg', className: 'flex-1' })}
        >
          Thất bại
        </button>
      </form>
    </main>
  );
}
