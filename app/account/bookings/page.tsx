'use client';

/**
 * /account/bookings — authenticated customer's booking history (Issue 009,
 * PRD story 15). Upcoming / Past tabs, status badges, cursor "load more".
 *
 * Access token lives in client memory (module store in the register page); a
 * page reload loses it, so a missing token redirects to login with returnTo.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/app/auth/register/page';
import { STATUS_LABEL, STATUS_COLOR } from './bookingStatus';
import type { CustomerBookingRow } from '@/lib/booking/listCustomerBookings';

type Tab = 'upcoming' | 'past';

const vnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function Badge({ status }: { status: CustomerBookingRow['status'] }) {
  return (
    <span
      style={{
        background: STATUS_COLOR[status],
        color: '#fff',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function BookingsHistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [rows, setRows] = useState<CustomerBookingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (activeTab: Tab, cursor: string | null) => {
      const token = getAccessToken();
      if (!token) {
        router.push('/auth/login?returnTo=/account/bookings');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ tab: activeTab });
        if (cursor) qs.set('cursor', cursor);
        const res = await fetch(`/api/bookings?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.push('/auth/login?returnTo=/account/bookings');
          return;
        }
        if (!res.ok) {
          setError('Không thể tải lịch sử đặt vé.');
          return;
        }
        const json = (await res.json()) as { rows: CustomerBookingRow[]; nextCursor: string | null };
        setRows((prev) => (cursor ? [...prev, ...json.rows] : json.rows));
        setNextCursor(json.nextCursor);
      } catch {
        setError('Lỗi kết nối. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab, null);
  }, [tab, load]);

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 16px' }}>
      <h1>Lịch sử đặt vé</h1>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0', borderBottom: '1px solid #e0e0e0' }}>
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: tab === t ? '2px solid #1a1a1a' : '2px solid transparent',
              background: 'none',
              fontWeight: tab === t ? 'bold' : 'normal',
              cursor: 'pointer',
            }}
          >
            {t === 'upcoming' ? 'Sắp tới' : 'Đã qua'}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && rows.length === 0 && !error && <p>Chưa có vé nào.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((b) => (
          <li
            key={b.id}
            style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, marginBottom: 12 }}
          >
            <a href={`/account/bookings/${b.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 16 }}>
                  {b.route.origin} → {b.route.destination}
                </strong>
                <Badge status={b.status} />
              </div>
              <div style={{ color: '#555', marginTop: 4 }}>{dateFmt.format(new Date(b.departureAt))}</div>
              <div style={{ color: '#555', marginTop: 4 }}>
                {b.ticketCount} vé · {vnd(b.totalVnd)} · {b.bookingRef}
              </div>
            </a>
          </li>
        ))}
      </ul>

      {loading && <p>Đang tải...</p>}
      {nextCursor && !loading && (
        <button onClick={() => void load(tab, nextCursor)} style={{ marginTop: 8 }}>
          Tải thêm
        </button>
      )}
    </main>
  );
}
