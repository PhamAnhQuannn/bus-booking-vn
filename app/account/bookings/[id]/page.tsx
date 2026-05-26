'use client';

/**
 * /account/bookings/:id — authenticated customer's booking detail (Issue 009,
 * PRD story 16). Shows route, departure, ticket count, buyer info, total,
 * status, operator contact phone, and a PDF-ticket download button.
 *
 * Access token lives in client memory (module store in the register page); a
 * missing token redirects to login with returnTo. The download button must
 * fetch the ticket route with the Bearer header and stream the blob — a plain
 * <a href> can't carry the Authorization header.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getAccessToken } from '@/app/auth/register/page';
import { STATUS_LABEL, STATUS_VARIANT } from '../bookingStatus';
import type { CustomerBookingDetail } from '@/lib/booking/getCustomerBookingDetail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const TICKETABLE = new Set(['pending_cash_payment', 'paid_operator_notified', 'completed', 'no_show']);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

export default function BookingDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [booking, setBooking] = useState<CustomerBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const loginRedirect = useCallback(() => {
    router.push(`/auth/login?returnTo=/account/bookings/${id}`);
  }, [router, id]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      loginRedirect();
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/bookings/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!active) return;
        if (res.status === 401) {
          loginRedirect();
          return;
        }
        if (res.status === 404) {
          setError('Không tìm thấy vé.');
          return;
        }
        if (!res.ok) {
          setError('Không thể tải chi tiết vé.');
          return;
        }
        const json = (await res.json()) as { booking: CustomerBookingDetail };
        setBooking(json.booking);
      } catch {
        if (active) setError('Lỗi kết nối. Vui lòng thử lại.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, loginRedirect]);

  const downloadTicket = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      loginRedirect();
      return;
    }
    setDownloading(true);
    setError('');
    try {
      const res = await fetch(`/api/bookings/${id}/ticket`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        loginRedirect();
        return;
      }
      if (!res.ok) {
        setError('Không thể tải vé PDF.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticket-${booking?.bookingRef ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setDownloading(false);
    }
  }, [id, booking, loginRedirect]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-10">
      <Link
        href="/account/bookings"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Lịch sử đặt vé
      </Link>

      {loading && <p className="text-sm text-muted-foreground">Đang tải...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {booking && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">
              {booking.route.origin} → {booking.route.destination}
            </h1>
            <Badge variant={STATUS_VARIANT[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
          </div>
          <div className="font-mono text-sm text-muted-foreground">{booking.bookingRef}</div>

          <Card>
            <CardContent className="flex flex-col gap-3">
              <Field label="Khởi hành">{dateFmt.format(new Date(booking.departureAt))}</Field>
              <Field label="Số vé">{booking.ticketCount}</Field>
              <Field label="Tổng tiền">{vnd(booking.totalVnd)}</Field>
              <Field label="Biển số xe">{booking.busLicensePlate}</Field>

              <div className="border-t border-border" />

              <Field label="Người đặt">{booking.buyerName}</Field>
              <Field label="Số điện thoại">{booking.buyerPhone}</Field>

              <div className="border-t border-border" />

              <Field label="Nhà xe">{booking.operator.legalName}</Field>
              <Field label="Liên hệ nhà xe">{booking.operator.contactPhone}</Field>
            </CardContent>
          </Card>

          {TICKETABLE.has(booking.status) && (
            <Button
              size="lg"
              className="self-start"
              onClick={() => void downloadTicket()}
              disabled={downloading}
            >
              {downloading ? 'Đang tải...' : 'Tải vé PDF'}
            </Button>
          )}
        </>
      )}
    </main>
  );
}
