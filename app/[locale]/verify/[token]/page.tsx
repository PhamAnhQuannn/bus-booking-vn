/**
 * Issue 072 — /verify/[token] — PUBLIC boarding verification page.
 *
 * Audience: a boarding checker (driver / operator staff) scanning the ticket QR
 * (Issue 071). The [token] is a signed, tamper-evident ticket JWT — NOT a
 * session. No login, no auth cookie. proxy.ts guards only /op/* and /admin/* —
 * /verify/* is public by default (it still receives the bb_csrf + bb_sid cookies
 * on GET, but no auth gate runs).
 *
 * SOURCE OF TRUTH (AC3): every trip fact rendered here — plate, bus type, route,
 * departure, operator — is read LIVE from the CURRENT Trip via getTicketVerification.
 * A bus reassignment or trip edit after the QR was printed is reflected here at
 * boarding time. The token carries none of these; it is only a lookup pointer.
 *
 * Server component: calls getTicketVerification in-process — NEVER self-fetches
 * its own API (Mistake Log 2026-05-17, Issues 002/003). No Date.now() in the
 * render body (Issue 016 RSC purity) — it formats DB-sourced Date strings only.
 *
 * RECEIPT (2026-08-11): the page doubles as a payment receipt reached by scanning the
 * QR, so it shows the buyer NAME + a MASKED phone (last 4 only) and the payment facts
 * (amount, method, paid time). Safe because the token is a 192-bit capability (only the
 * QR-holder opens it) and the phone is masked; buyerEmail is still never read. An
 * invalid/tampered/unknown token → notFound() (generic 404, no existence leak).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckCircle2, XCircle, Ticket, Receipt, UserCheck } from 'lucide-react';
import { getTicketVerification } from '@/lib/ticketing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TripDetailCard } from '@/components/ticket/TripDetailCard';

export const runtime = 'nodejs';

// Per-ticket boarding page reachable only via the signed token QR — never indexed.
export const metadata: Metadata = {
  title: 'Xác thực vé | BBVN',
  robots: { index: false, follow: false },
};

interface VerifyPageProps {
  params: Promise<{ token: string }>;
}

/** Format a DB-sourced ISO instant as HH:MM in Asia/Ho_Chi_Minh (pure given input). */
function formatBoardingTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Full VN-local date+time for the receipt paid instant. */
function formatPaidAt(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Chuyển khoản',
  cash: 'Tiền mặt',
  vnpay: 'VNPay',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  card: 'Thẻ',
};

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { token } = await params;

  const view = await getTicketVerification(token);
  if (!view) {
    // Invalid / tampered / unknown token — generic 404, no existence leak (AC2).
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      {/* Prominent PAID / UNPAID status — the primary boarding signal. */}
      <header className="flex flex-col items-center gap-3 text-center">
        <span
          className={`flex size-14 items-center justify-center rounded-full ${
            view.isPaid
              ? 'bg-success text-success-foreground'
              : 'bg-warning text-warning-foreground'
          }`}
        >
          {view.isPaid ? (
            <CheckCircle2 className="size-8" aria-hidden="true" />
          ) : (
            <XCircle className="size-8" aria-hidden="true" />
          )}
        </span>
        <h1 className="text-2xl font-bold">Xác thực vé</h1>
        <Badge variant={view.isPaid ? 'success' : 'pending'}>
          {view.isPaid ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN'}
        </Badge>
      </header>

      {/* Booking ref */}
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-4 text-center">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Mã đặt vé</span>
        <span className="font-mono text-2xl font-bold tracking-widest text-primary">
          {view.bookingRef}
        </span>
      </div>

      {/* Live trip facts — shared presentation with the confirmation page (AC5). */}
      <TripDetailCard
        origin={view.route.origin}
        destination={view.route.destination}
        departureAt={new Date(view.departureAt)}
        busPlate={view.busPlate}
        busType={view.busType}
        operatorName={view.operatorName}
      />

      {/* Payment receipt — the "toàn bộ thông tin chuyển khoản" a scanner sees. */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Biên nhận thanh toán</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Khách hàng</dt>
              <dd className="text-right font-medium">{view.buyerName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Số điện thoại</dt>
              <dd className="text-right font-mono">{view.buyerPhoneMasked}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Số tiền</dt>
              <dd className="text-right font-semibold text-primary">
                {view.totalVnd.toLocaleString('vi-VN')}đ
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Phương thức</dt>
              <dd className="text-right">
                {PAYMENT_METHOD_LABEL[view.paymentMethod] ?? view.paymentMethod}
              </dd>
            </div>
            {view.paidAt ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Thời điểm thanh toán</dt>
                <dd className="text-right tabular-nums">{formatPaidAt(view.paidAt)}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {/* Boarding info */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Thông tin lên xe</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="inline-flex items-center gap-2 text-muted-foreground">
                <Ticket className="size-4" aria-hidden="true" />
                Số vé
              </dt>
              <dd className="text-right">{view.ticketCount}</dd>
            </div>
            {view.providerTxnId ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <Receipt className="size-4" aria-hidden="true" />
                  Mã giao dịch
                </dt>
                <dd className="text-right font-mono break-all">{view.providerTxnId}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <dt className="inline-flex items-center gap-2 text-muted-foreground">
                <UserCheck className="size-4" aria-hidden="true" />
                Trạng thái lên xe
              </dt>
              {/* Issue 073: live boarding state from the operator scan/check-in. */}
              {view.checkIn.checkedInAt ? (
                <dd className="text-right font-medium text-success">
                  Đã lên xe lúc {formatBoardingTime(view.checkIn.checkedInAt)}
                </dd>
              ) : view.checkIn.noShowAt ? (
                <dd className="text-right font-medium text-warning-foreground">Vắng mặt</dd>
              ) : (
                <dd className="text-right text-muted-foreground">Chưa lên xe</dd>
              )}
            </div>
          </dl>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Trang này là nguồn dữ liệu chính xác nhất (cập nhật trực tiếp): biển số xe và giờ khởi
        hành luôn phản ánh chuyến đi hiện tại.
      </p>
    </main>
  );
}
