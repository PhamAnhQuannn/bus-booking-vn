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
import { getEnv } from '@/lib/config/env';
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
    <main className="max-w-md mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Cổng thanh toán thử (DEV)</h1>
        <p className="text-sm text-gray-600">
          Fake <span className="font-mono">{adapter}</span> gateway — no real money moves.
        </p>
      </header>

      <section className="bg-white border rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Mã đơn</span>
          <span className="font-mono">{orderId}</span>
        </div>
        <div className="flex justify-between font-semibold text-lg border-t pt-2">
          <span>Số tiền</span>
          <span className="text-blue-700">{formatVND(amount)}</span>
        </div>
      </section>

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
          className="flex-1 bg-green-700 text-white text-sm font-medium px-4 py-3 rounded-md hover:bg-green-800"
        >
          Pay success
        </button>
        <button
          type="submit"
          name="outcome"
          value="fail"
          formAction={submitStubPayment}
          className="flex-1 bg-red-700 text-white text-sm font-medium px-4 py-3 rounded-md hover:bg-red-800"
        >
          Pay fail
        </button>
      </form>
    </main>
  );
}
