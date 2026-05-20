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
import { STATUS_LABEL, STATUS_COLOR } from '../bookingStatus';
import type { CustomerBookingDetail } from '@/lib/booking/getCustomerBookingDetail';

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
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 15, marginTop: 2 }}>{children}</div>
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
    <main style={{ maxWidth: 560, margin: '40px auto', padding: '0 16px' }}>
      <Link href="/account/bookings" style={{ color: '#1a1a1a', textDecoration: 'none', fontSize: 14 }}>
        ← Lịch sử đặt vé
      </Link>

      {loading && <p style={{ marginTop: 24 }}>Đang tải...</p>}
      {error && <p style={{ color: 'red', marginTop: 24 }}>{error}</p>}

      {booking && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '24px 0 8px',
            }}
          >
            <h1 style={{ fontSize: 22, margin: 0 }}>
              {booking.route.origin} → {booking.route.destination}
            </h1>
            <span
              style={{
                background: STATUS_COLOR[booking.status],
                color: '#fff',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 13,
                whiteSpace: 'nowrap',
              }}
            >
              {STATUS_LABEL[booking.status]}
            </span>
          </div>
          <div style={{ color: '#555', marginBottom: 24 }}>{booking.bookingRef}</div>

          <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 20 }}>
            <Field label="Khởi hành">{dateFmt.format(new Date(booking.departureAt))}</Field>
            <Field label="Số vé">{booking.ticketCount}</Field>
            <Field label="Tổng tiền">{vnd(booking.totalVnd)}</Field>
            <Field label="Biển số xe">{booking.busLicensePlate}</Field>

            <div style={{ borderTop: '1px solid #e0e0e0', margin: '16px 0' }} />

            <Field label="Người đặt">{booking.buyerName}</Field>
            <Field label="Số điện thoại">{booking.buyerPhone}</Field>

            <div style={{ borderTop: '1px solid #e0e0e0', margin: '16px 0' }} />

            <Field label="Nhà xe">{booking.operator.legalName}</Field>
            <Field label="Liên hệ nhà xe">{booking.operator.contactPhone}</Field>
          </div>

          {TICKETABLE.has(booking.status) && (
            <button
              onClick={() => void downloadTicket()}
              disabled={downloading}
              style={{
                marginTop: 20,
                padding: '12px 20px',
                border: 'none',
                borderRadius: 8,
                background: '#1a1a1a',
                color: '#fff',
                fontSize: 15,
                cursor: downloading ? 'default' : 'pointer',
                opacity: downloading ? 0.6 : 1,
              }}
            >
              {downloading ? 'Đang tải...' : 'Tải vé PDF'}
            </button>
          )}
        </>
      )}
    </main>
  );
}
