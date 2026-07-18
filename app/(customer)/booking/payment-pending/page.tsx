/**
 * /booking/payment-pending?ref=<bookingRef>&code=<vnp_ResponseCode> — VNPay
 * non-success return destination (signature valid but responseCode !== '00').
 *
 * The IPN webhook is authoritative; a "pending" browser return does not mean the
 * payment failed. We resolve the ref to the canonical result page (which polls
 * for the real state) when possible, and otherwise offer home / support links.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getBookingByRef } from '@/lib/booking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Đang xử lý thanh toán | BBVN',
  robots: { index: false, follow: false },
};

interface PendingPageProps {
  searchParams: Promise<{ ref?: string; code?: string }>;
}

export default async function VnpayPendingPage({ searchParams }: PendingPageProps) {
  const { ref, code } = await searchParams;
  const booking = ref ? await getBookingByRef(ref) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle as="h2">Thanh toán chưa hoàn tất</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            Giao dịch VNPay chưa được xác nhận hoàn tất. Nếu bạn đã thanh toán, hệ thống sẽ tự
            động cập nhật trạng thái trong giây lát.
          </p>
          {ref && (
            <p>
              Mã đặt vé: <span className="font-mono font-medium">{ref}</span>
            </p>
          )}
          {code && <p className="text-muted-foreground">Mã phản hồi VNPay: {code}</p>}
          <div className="mt-2 flex flex-wrap gap-3">
            {booking ? (
              <Link
                href={`/booking/result/${booking.confirmationToken}`}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Kiểm tra trạng thái đặt vé
              </Link>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Về trang chủ
              </Link>
            )}
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
