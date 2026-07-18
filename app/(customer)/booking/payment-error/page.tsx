/**
 * /booking/payment-error?ref=<bookingRef>&reason=<reason> — VNPay error return
 * destination (invalid signature, zero-amount tamper, or a hard failure).
 *
 * Browser-UX only; the IPN webhook is authoritative for the booking state. This
 * page surfaces a friendly message and a path back to retry / contact support.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Thanh toán thất bại | BBVN',
  robots: { index: false, follow: false },
};

const REASON_LABEL: Record<string, string> = {
  sig_invalid: 'Không xác thực được giao dịch từ VNPay.',
  invalid_amount: 'Số tiền giao dịch không hợp lệ.',
};

interface ErrorPageProps {
  searchParams: Promise<{ ref?: string; reason?: string }>;
}

export default async function VnpayErrorPage({ searchParams }: ErrorPageProps) {
  const { ref, reason } = await searchParams;
  const detail = (reason && REASON_LABEL[reason]) || 'Giao dịch VNPay không thành công.';

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Thanh toán thất bại</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">{detail}</p>
          {ref && (
            <p>
              Mã đặt vé: <span className="font-mono font-medium">{ref}</span>
            </p>
          )}
          <p className="text-muted-foreground">
            Nếu tài khoản của bạn đã bị trừ tiền, vui lòng liên hệ hỗ trợ — chúng tôi sẽ kiểm tra
            và hoàn tiền nếu cần.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Đặt vé lại
            </Link>
            <Link
              href="/lien-he-dat-xe"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary/30"
            >
              Liên hệ hỗ trợ
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
